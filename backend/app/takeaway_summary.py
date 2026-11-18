"""
AI summary (Claude Haiku via OpenRouter) of a Command Center entry's key takeaways:
3-4 bullets, cached per entry.

Reads: the frontend reads cc_event_summaries itself, under RLS, and only calls this
module on a miss (database/migration_command_center_kta_summary_read.sql). So this is
the generation path, and it is built to finish in a couple of seconds:

  * the RLS visibility check and the cache re-check run in parallel;
  * the model is called with reasoning off -- Haiku otherwise thinks first, which on
    a "condense into 4 bullets" task adds latency and, under a token cap, truncates
    the JSON (measured: 363 of 500 tokens spent reasoning, reply cut off);
  * the cache write happens after the response, off the request path.

Visibility: the service-role client skips RLS, so the entry is first read from
cc_activity_feed with the *caller's* access token. PostgREST applies the caller's RLS
(the bearer JWT sets the role, not the apikey), so a caller can only summarise what
they can already open.

Cache key: sha256 of the trimmed takeaways alone, so the frontend can compute the same
hash and tell a current summary from a stale one without asking the backend.
"""
import hashlib
import json
import os
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Optional

import httpx
from fastapi import HTTPException

from .db import supabase, key as SERVICE_KEY, url as SUPABASE_URL
from .llm import make_openai_client, trace

# Claude Haiku through OpenRouter (OpenAI-compatible API). Override with SUMMARY_MODEL.
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
MODEL = os.getenv("SUMMARY_MODEL", "anthropic/claude-haiku-5.5")
# Short takeaways are already a summary; condensing two sentences into bullets only
# repeats them. Below this many characters, no summary is made. Mirrored in the
# frontend (SUMMARY_MIN_CHARS) so short entries never make a request.
MIN_CHARS = 280
# Enough for a long concall note; beyond it the tail adds little and costs tokens.
MAX_INPUT_CHARS = 24_000

SYSTEM_PROMPT = """You summarise an equity research analyst's notes for a fund's research desk.

Respond with only a JSON object, no prose and no code fence: {"bullets": ["...", "..."]} with 3 or 4 bullets covering the most decision-relevant takeaways.

Rules:
- Each bullet is one sentence, at most 30 words, and leads with the point, not a label.
- Keep the specific numbers (growth rates, margins, targets, estimates, multiples, dates) exactly as written.
- Only state what the notes say. No outside facts, no advice, no hedging filler.
- Prefer what changed and what matters for the investment case over background.
- Plain text: no markdown, no leading dashes or numbering."""

# Pooled connections: a fresh TLS handshake to Supabase or OpenRouter per request is a
# few hundred ms each on its own.
_http = httpx.Client(timeout=10)


def _describe_key(k: str) -> str:
    """What kind of Supabase key this is -- never the key itself."""
    if not k:
        return "missing"
    if k.startswith("sb_secret_"):
        return "new-format secret key (sb_secret_)"
    if k.startswith("sb_publishable_"):
        return "new-format PUBLISHABLE key (sb_publishable_) -- not a service key"
    if k.count(".") == 2:
        import base64
        try:
            body = k.split(".")[1]
            claims = json.loads(base64.urlsafe_b64decode(body + "=" * (-len(body) % 4)))
            return f"legacy JWT, role={claims.get('role')!r}"
        except Exception:
            return "JWT-shaped, unreadable claims"
    return f"unrecognised format ({len(k)} chars)"


# One line at startup, so a wrong key (an anon key in the service slot) shows in the logs.
print(f"[kta_summary] service key: {_describe_key(SERVICE_KEY)}")
_pool = ThreadPoolExecutor(max_workers=8, thread_name_prefix="kta-summary")
_llm = None


class SummaryUnavailable(Exception):
    """The summary could not be made (no API key, or the model failed)."""


def _client():
    global _llm
    if _llm is None:
        api_key = os.getenv("OPENROUTER_API_KEY")
        if not api_key:
            raise SummaryUnavailable("AI summaries are not configured.")
        _llm = make_openai_client(
            api_key=api_key,
            base_url=OPENROUTER_BASE_URL,
            # Optional OpenRouter attribution headers; they only label usage in its dashboard.
            default_headers={"HTTP-Referer": "https://alphaboard.theunicornlabs.com", "X-Title": "AlphaBoard"},
            timeout=20,
            max_retries=1,
        )
    return _llm


def _source_text(row: dict) -> str:
    return (row.get("kta") or "").strip()


def source_hash(text: str) -> str:
    """sha256 hex of the trimmed takeaways. The frontend computes the same (useEntrySummary)."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _read_visible_entry(event_id: str, access_token: str) -> dict:
    """The entry as the caller sees it under RLS, or 404 if they cannot see it."""
    try:
        res = _http.get(
            f"{SUPABASE_URL}/rest/v1/cc_activity_feed",
            params={"event_id": f"eq.{event_id}", "select": "event_id,ticker,company_name,kind,title,kta"},
            headers={"apikey": SERVICE_KEY, "Authorization": f"Bearer {access_token}"},
        )
    except httpx.HTTPError as exc:
        print(f"[kta_summary] visibility check failed: {type(exc).__name__}: {exc}")
        raise HTTPException(status_code=502, detail="Could not reach the database.")
    if res.status_code == 401:
        raise HTTPException(status_code=401, detail="Your session has expired. Reload and try again.")
    if res.status_code >= 400:
        print(f"[kta_summary] visibility check HTTP {res.status_code}: {res.text[:200]}")
        raise HTTPException(status_code=502, detail="Could not read that entry.")
    rows = res.json()
    if not rows:
        raise HTTPException(status_code=404, detail="Entry not found.")
    return rows[0]


def _cached_row(event_id: str) -> Optional[dict]:
    try:
        res = (
            supabase.table("cc_event_summaries")
            .select("bullets,source_hash")
            .eq("event_id", event_id)
            .limit(1)
            .execute()
        )
    except Exception as exc:  # table missing (migration not applied) -> just regenerate
        print(f"[kta_summary] cache read failed: {exc}")
        return None
    return res.data[0] if res.data else None


def _store(event_id: str, digest: str, bullets: list) -> None:
    try:
        supabase.table("cc_event_summaries").upsert(
            {"event_id": event_id, "source_hash": digest, "bullets": bullets, "model": MODEL,
             "created_at": datetime.now(timezone.utc).isoformat()},
            on_conflict="event_id",
        ).execute()
    except Exception as exc:  # a failed cache write must not fail the response
        print(f"[kta_summary] cache write failed: {exc}")


def _parse_json(text: str) -> dict:
    """The JSON object in a reply, tolerating a code fence or stray prose around it --
    response_format is not guaranteed for every model behind OpenRouter."""
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end <= start:
        raise ValueError(f"no JSON object in reply: {text[:120]!r}")
    return json.loads(text[start:end + 1])


def _generate(row: dict, text: str) -> list:
    context = f"Company: {row.get('company_name') or row.get('ticker')} ({row.get('ticker')})\n" \
              f"Entry: {row.get('title')}\n\nNotes:\n{text[:MAX_INPUT_CHARS]}"
    client = _client()
    try:
        resp = client.chat.completions.create(
            model=MODEL,
            temperature=0.2,
            # ~250 tokens is typical; headroom so a long note never truncates the JSON.
            max_tokens=800,
            messages=[{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": context}],
            # No extended thinking: it doubled latency and ate the token budget.
            extra_body={"reasoning": {"enabled": False}},
            **trace("cc_kta_summary", ticker=row.get("ticker"), kind=row.get("kind")),
        )
        choice = resp.choices[0]
        if choice.finish_reason == "length":
            raise ValueError("reply hit the token limit")
        data = _parse_json(choice.message.content or "")
    except Exception as exc:
        print(f"[kta_summary] generation failed: {exc}")
        raise SummaryUnavailable("The summary could not be generated. Try again.")

    bullets = [
        b.strip().lstrip("-•* ").strip()
        for b in (data.get("bullets") or [])
        if isinstance(b, str) and b.strip()
    ][:4]
    if not bullets:
        raise SummaryUnavailable("The summary came back empty. Try again.")
    return bullets


def summarize_entry(event_id: str, access_token: str) -> dict:
    """{"bullets": [...] | None, "cached": bool}. bullets is None when the takeaways are too short."""
    # Visibility check and cache lookup are independent round trips: run them together.
    cached_future = _pool.submit(_cached_row, event_id)
    row = _read_visible_entry(event_id, access_token)   # raises 401/404 before anything is returned
    text = _source_text(row)
    if len(text) < MIN_CHARS:
        return {"bullets": None, "cached": False}

    digest = source_hash(text)
    hit = cached_future.result()
    if hit and hit.get("source_hash") == digest:
        return {"bullets": hit["bullets"], "cached": True}

    bullets = _generate(row, text)
    _pool.submit(_store, event_id, digest, bullets)      # off the request path
    return {"bullets": bullets, "cached": False}
