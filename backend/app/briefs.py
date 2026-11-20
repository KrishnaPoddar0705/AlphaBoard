"""
Daily and weekly Command Center briefs for org admins.

    daily   08:00 IST every day     logs created in the 24 hours before
    weekly  08:00 IST on Mondays    logs created in the 7 days before

For each organization a brief is: a one-line headline, 4-6 bullets (8-10 for the
weekly), counts worked out in code (log types, House View tally, latest view per stock),
and a two-host podcast (30-45 s daily, 1-2 min weekly). It is written to cc_briefs,
with the audio in the private cc-briefs bucket. Both are readable by that org's admins
only (database/migration_command_center_briefs.sql).

Credential: prod's SUPABASE_SERVICE_KEY is the anon key (see commit 681441e), so the
shared client in db.py cannot see any organization's entries. This module talks to
PostgREST and Storage itself with BRIEF_SERVICE_KEY, or SUMMARY_CACHE_KEY when that is
not set -- both a real service-role key. With neither, briefs are skipped and the
startup log says so.

Slots are anchored to 08:00 IST, not to when the job happens to run, so the startup
catch-up (a deploy at 07:59 would otherwise skip the morning) and a manual rerun both
produce the same window. (organization_id, kind, brief_date) is unique: a rerun
replaces the slot's brief rather than adding one.
"""
import json
import os
import struct
import threading
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx

from .db import url as _RAW_URL
from .llm import make_openai_client, trace

SUPABASE_URL = (_RAW_URL or "").strip().rstrip("/")
SERVICE_KEY = (os.getenv("BRIEF_SERVICE_KEY") or os.getenv("SUMMARY_CACHE_KEY") or "").strip()

# India has no daylight saving, so a fixed offset is exact and needs no tz database.
IST = timezone(timedelta(hours=5, minutes=30))
SLOT_HOUR = 8

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
MODEL = os.getenv("BRIEF_MODEL") or os.getenv("SUMMARY_MODEL") or "anthropic/claude-haiku-5.5"
# Voices also come from OpenRouter (its OpenAI-compatible /audio/speech). Gemini Flash
# TTS: natural, cheap, and returns raw PCM. Override with BRIEF_TTS_MODEL; the voice
# names are the model's own.
TTS_MODEL = os.getenv("BRIEF_TTS_MODEL", "google/gemini-3.8-flash-tts")
BUCKET = "cc-briefs"

# Two hosts with clearly different voices.
HOSTS = {"Asha": os.getenv("BRIEF_VOICE_A", "Kore"), "Dev": os.getenv("BRIEF_VOICE_B", "Puck")}

# "pcm" output: raw 24 kHz, 16-bit, mono little-endian samples. Raw PCM joins
# cleanly; joined MP3s carry the first segment's length header, so players show the
# wrong duration and some stop early.
SAMPLE_RATE = 24_000
TURN_GAP = b"\x00\x00" * int(SAMPLE_RATE * 0.25)

KIND_LABELS = {
    "management_meeting": "Management meeting",
    "concall": "Concall",
    "annual_report": "Annual report",
    "broker_report": "Broker report",
    "agm": "AGM",
    "other": "Other",
}
SUBTYPE_LABELS = {
    "1:1": "1:1", "plant_visit": "Plant visit", "conference": "Conference",
    "group_meeting": "Group meeting", "call": "Call", "site_visit": "Site visit",
}
RATING_LABELS = {
    "strong_buy": "STRONG BUY", "buy": "BUY", "neutral": "NEUTRAL",
    "sell": "SELL", "strong_sell": "STRONG SELL",
}

SPEC = {
    "daily": {
        "window": timedelta(hours=24),
        "bullets": "4 to 6",
        "max_bullets": 6,
        "words": "about 100 words in total, 6 to 8 turns (30-45 seconds read aloud)",
        "per_entry_chars": 1500,
        "max_input_chars": 40_000,
        "max_tokens": 1800,
        "noun": "the last 24 hours",
    },
    "weekly": {
        "window": timedelta(days=7),
        "bullets": "8 to 10",
        "max_bullets": 10,
        "words": "about 300 words in total, 10 to 14 turns (about 90 seconds read aloud; never under 260 words)",
        "per_entry_chars": 700,
        "max_input_chars": 70_000,
        "max_tokens": 3000,
        "noun": "the past week",
    },
}

SYSTEM_PROMPT = """You write the {kind} brief for the head of an equity research desk, covering everything the desk's analysts logged in {noun}.

Respond with only a JSON object, no prose and no code fence:
{{"headline": "...", "bullets": ["...", "..."], "script": [{{"speaker": "Asha", "text": "..."}}, {{"speaker": "Dev", "text": "..."}}]}}

headline: one line, at most 14 words, the single most important thing that happened.

bullets: {bullets} bullets, together covering:
- the mix of activity (which log types, how many, by whom) -- use the counts given, never recount;
- the key takeaways that matter for the investment case, grouped across stocks where a theme repeats, each credited to the analyst who logged it;
- the House View (the desk's BUY / SELL / NEUTRAL call) and Org View (the analyst's written opinion) on the stocks that carry one, and any stock where views disagree or turned;
- what to look at next: open questions, negative thesis impact, or a stock with heavy activity.
Each bullet is one or two sentences, at most 45 words, leads with the point, names tickers, and names the analyst behind every stock it mentions, as written after "by" in the entry (e.g. "BIOCON.NS (lisaf): ..."). Never drop the analyst from a takeaway.

script: a two-host podcast between Asha and Dev, {words}. Alternate speakers. Open with a one-line hook, cover the biggest moves with tickers, House Views and who logged each one ("lisaf flagged...", "from ankurp's concall notes..."), close with a short sign-off. Written for the ear: short sentences, no bullet lists, no URLs, say "percent" not "%".

Rules:
- Only state what the logs say. Keep numbers exactly as written. No outside facts, no advice, no predictions.
- Plain text inside the JSON: no markdown, no leading dashes or numbering."""


class BriefsUnavailable(Exception):
    pass


_http = httpx.Client(timeout=30)
_llm = None
_locks: dict = {}
_locks_guard = threading.Lock()
_voice_lock = threading.Lock()

if not SERVICE_KEY:
    print("[briefs] no BRIEF_SERVICE_KEY or SUMMARY_CACHE_KEY: daily/weekly briefs are off")


# ---------------------------------------------------------------------------
# Slots
# ---------------------------------------------------------------------------

def slot_end(kind: str, now: Optional[datetime] = None) -> datetime:
    """The most recent 08:00 IST slot of this kind at or before `now`."""
    local = (now or datetime.now(timezone.utc)).astimezone(IST)
    end = local.replace(hour=SLOT_HOUR, minute=0, second=0, microsecond=0)
    if kind == "weekly":
        end -= timedelta(days=end.weekday())          # back to Monday
        if end > local:
            end -= timedelta(days=7)
    elif end > local:
        end -= timedelta(days=1)
    return end


# ---------------------------------------------------------------------------
# Supabase (service role, over REST)
# ---------------------------------------------------------------------------

def _headers(extra: Optional[dict] = None) -> dict:
    if not SERVICE_KEY:
        raise BriefsUnavailable("Briefs need BRIEF_SERVICE_KEY or SUMMARY_CACHE_KEY.")
    return {"apikey": SERVICE_KEY, "Authorization": f"Bearer {SERVICE_KEY}", **(extra or {})}


def _get(table: str, params: dict) -> list:
    res = _http.get(f"{SUPABASE_URL}/rest/v1/{table}", params=params, headers=_headers())
    res.raise_for_status()
    return res.json()


def _organizations(org_id: Optional[str]) -> list:
    params = {"select": "id,name"}
    if org_id:
        params["id"] = f"eq.{org_id}"
    return _get("organizations", params)


def admin_org_of(user_id: str) -> Optional[str]:
    """The organization this user is an admin of, or None."""
    rows = _get("user_organization_membership", {
        "user_id": f"eq.{user_id}", "role": "eq.admin", "select": "organization_id", "limit": "1",
    })
    return rows[0]["organization_id"] if rows else None


def _ts(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _entries(org_id: str, start: datetime, end: datetime) -> list:
    return _get("cc_activity_feed", {
        "organization_id": f"eq.{org_id}",
        "is_scheduled": "eq.false",
        "and": f"(created_at.gte.{_ts(start)},created_at.lt.{_ts(end)})",
        "select": "event_id,ticker,company_name,sector,kind,subtype,title,period_label,broker_name,"
                  "thesis_impact,kta,open_questions,svan_view,svan_rating,analyst_username,"
                  "created_by_username,created_at",
        "order": "created_at.asc",
        "limit": "1000",
    })


def _summaries(event_ids: list) -> dict:
    """event_id -> AI takeaway bullets, for the entries that have one."""
    out = {}
    for i in range(0, len(event_ids), 100):
        chunk = event_ids[i:i + 100]
        for row in _get("cc_event_summaries", {
            "event_id": f"in.({','.join(chunk)})", "select": "event_id,bullets",
        }):
            if isinstance(row.get("bullets"), list):
                out[row["event_id"]] = row["bullets"]
    return out


def _existing(org_ids: list, kind: str, brief_date: str) -> set:
    if not org_ids:
        return set()
    rows = _get("cc_briefs", {
        "organization_id": f"in.({','.join(org_ids)})", "kind": f"eq.{kind}",
        "brief_date": f"eq.{brief_date}", "select": "organization_id",
    })
    return {r["organization_id"] for r in rows}


def _upsert(row: dict) -> None:
    res = _http.post(
        f"{SUPABASE_URL}/rest/v1/cc_briefs",
        params={"on_conflict": "organization_id,kind,brief_date"},
        headers=_headers({"Prefer": "resolution=merge-duplicates,return=minimal"}),
        json=row,
    )
    res.raise_for_status()


def _upload_audio(path: str, wav: bytes) -> None:
    res = _http.post(
        f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{path}",
        headers=_headers({"Content-Type": "audio/wav", "x-upsert": "true"}),
        content=wav,
        timeout=120,
    )
    res.raise_for_status()


# ---------------------------------------------------------------------------
# Counting (in code -- the model is told these numbers, never asked for them)
# ---------------------------------------------------------------------------

def _author(e: dict) -> str:
    return e.get("analyst_username") or e.get("created_by_username") or "unknown"


def _type_label(e: dict) -> str:
    if e.get("kind") == "management_meeting" and e.get("subtype"):
        return SUBTYPE_LABELS.get(e["subtype"], "Management meeting")
    return KIND_LABELS.get(e.get("kind") or "other", "Other")


def _tally(values) -> dict:
    out: dict = {}
    for v in values:
        out[v] = out.get(v, 0) + 1
    return dict(sorted(out.items(), key=lambda kv: -kv[1]))


def _stats(entries: list) -> dict:
    # Latest rating per stock: entries arrive oldest first, so later ones overwrite.
    views: dict = {}
    for e in entries:
        if e.get("svan_rating"):
            views[e["ticker"]] = {"ticker": e["ticker"], "rating": e["svan_rating"], "analyst": _author(e)}
    return {
        "entries": len(entries),
        "companies": len({e["ticker"] for e in entries}),
        "analysts": len({_author(e) for e in entries}),
        "by_type": _tally(_type_label(e) for e in entries),
        "by_analyst": _tally(_author(e) for e in entries),
        "by_rating": _tally(e["svan_rating"] for e in entries if e.get("svan_rating")),
        "by_impact": _tally(e["thesis_impact"] for e in entries if e.get("thesis_impact")),
        "top_tickers": list(_tally(e["ticker"] for e in entries).keys())[:8],
        "views": list(views.values()),
    }


# ---------------------------------------------------------------------------
# Writing: bullets and script (Claude Haiku via OpenRouter)
# ---------------------------------------------------------------------------

def _llm_client():
    global _llm
    if _llm is None:
        key = os.getenv("OPENROUTER_API_KEY")
        if not key:
            raise BriefsUnavailable("OPENROUTER_API_KEY is not set.")
        _llm = make_openai_client(
            api_key=key, base_url=OPENROUTER_BASE_URL, timeout=90, max_retries=1,
            default_headers={"HTTP-Referer": "https://alphaboard.theunicornlabs.com", "X-Title": "AlphaBoard"},
        )
    return _llm


def _entry_block(i: int, e: dict, bullets: Optional[list], cap: int) -> str:
    head = f"[{i}] {e['ticker']}"
    if e.get("company_name"):
        head += f" ({e['company_name']})"
    head += f" | {_type_label(e)}"
    if e.get("broker_name"):
        head += f" from {e['broker_name']}"
    if e.get("period_label"):
        head += f" {e['period_label']}"
    head += f" | by {_author(e)}"
    lines = [head, f"Title: {e.get('title') or ''}"]
    if e.get("svan_rating"):
        lines.append(f"House View: {RATING_LABELS.get(e['svan_rating'], e['svan_rating'])}")
    if e.get("svan_view"):
        lines.append(f"Org View: {e['svan_view'].strip()[:500]}")
    if e.get("thesis_impact"):
        lines.append(f"Thesis impact: {e['thesis_impact']}")
    if bullets:
        lines.append("Takeaways (AI summary): " + " ".join(f"- {b}" for b in bullets))
    elif (e.get("kta") or "").strip():
        lines.append(f"Takeaways: {e['kta'].strip()[:cap]}")
    if (e.get("open_questions") or "").strip():
        lines.append(f"Open questions: {e['open_questions'].strip()[:300]}")
    return "\n".join(lines)


def _parse_json(text: str) -> dict:
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end <= start:
        raise ValueError(f"no JSON object in reply: {text[:120]!r}")
    return json.loads(text[start:end + 1])


def _compose(kind: str, org_name: str, entries: list, summaries: dict, stats: dict) -> dict:
    spec = SPEC[kind]
    blocks, used = [], 0
    for i, e in enumerate(entries, 1):
        block = _entry_block(i, e, summaries.get(e["event_id"]), spec["per_entry_chars"])
        if used + len(block) > spec["max_input_chars"]:
            blocks.append(f"... and {len(entries) - i + 1} more entries not shown (counted above).")
            break
        blocks.append(block)
        used += len(block)

    counts = {k: stats[k] for k in ("entries", "companies", "analysts", "by_type", "by_analyst", "by_rating", "by_impact")}
    user = (
        f"Desk: {org_name}\nPeriod: {spec['noun']}\n\n"
        f"Counts (exact, use these):\n{json.dumps(counts)}\n\n"
        f"Entries:\n\n" + "\n\n".join(blocks)
    )
    system = SYSTEM_PROMPT.format(kind=kind, noun=spec["noun"], bullets=spec["bullets"], words=spec["words"])

    resp = _llm_client().chat.completions.create(
        model=MODEL,
        temperature=0.3,
        max_tokens=spec["max_tokens"],
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
        extra_body={"reasoning": {"enabled": False}},
        **trace("cc_brief", kind=kind, entries=len(entries)),
    )
    choice = resp.choices[0]
    if choice.finish_reason == "length":
        raise ValueError("brief hit the token limit")
    data = _parse_json(choice.message.content or "")

    bullets = [b.strip().lstrip("-•* ").strip() for b in data.get("bullets") or [] if isinstance(b, str) and b.strip()]
    script = [
        {"speaker": t["speaker"] if t.get("speaker") in HOSTS else list(HOSTS)[i % 2], "text": t["text"].strip()}
        for i, t in enumerate(data.get("script") or [])
        if isinstance(t, dict) and isinstance(t.get("text"), str) and t["text"].strip()
    ]
    if not bullets:
        raise ValueError("brief came back with no bullets")
    return {
        "headline": (data.get("headline") or "").strip() or None,
        "bullets": bullets[:spec["max_bullets"]],
        "script": script,
    }


# ---------------------------------------------------------------------------
# Voicing: one TTS call per turn (OpenRouter), joined into a WAV
# ---------------------------------------------------------------------------

def _speak(turn: dict) -> bytes:
    """Raw PCM for one turn. Retries rate limits and server errors with backoff --
    OpenRouter 429s a quick burst of speech calls."""
    key = os.getenv("OPENROUTER_API_KEY")
    if not key:
        raise BriefsUnavailable("OPENROUTER_API_KEY is not set.")
    body = {"model": TTS_MODEL, "input": turn["text"], "voice": HOSTS.get(turn["speaker"], "Kore"),
            "response_format": "pcm"}
    delays = (3, 6, 12, 24, 30)                       # ~75 s in all before giving up
    for attempt in range(len(delays) + 1):
        res = _http.post(f"{OPENROUTER_BASE_URL}/audio/speech", json=body, timeout=90,
                         headers={"Authorization": f"Bearer {key}", "X-Title": "AlphaBoard"})
        if res.status_code == 200 and res.headers.get("content-type", "").startswith("audio/"):
            if f"rate={SAMPLE_RATE}" not in res.headers["content-type"]:
                raise ValueError(f"unexpected audio format: {res.headers['content-type']}")
            return res.content
        if res.status_code in (429, 500, 502, 503, 504) and attempt < len(delays):
            time.sleep(delays[attempt])
            continue
        raise ValueError(f"TTS HTTP {res.status_code}: {res.text[:200]}")
    raise ValueError("TTS retries exhausted")


def _wav(pcm: bytes) -> bytes:
    header = b"RIFF" + struct.pack("<I", 36 + len(pcm)) + b"WAVE"
    header += b"fmt " + struct.pack("<IHHIIHH", 16, 1, 1, SAMPLE_RATE, SAMPLE_RATE * 2, 2, 16)
    header += b"data" + struct.pack("<I", len(pcm))
    return header + pcm


def _voice(script: list) -> tuple:
    """(wav bytes, seconds). One turn at a time, and one podcast at a time across the
    process (Monday's daily and weekly run together) -- the TTS provider rate-limits
    bursts."""
    parts = []
    with _voice_lock:
        for i, turn in enumerate(script):
            if i:
                time.sleep(1)
            parts.append(_speak(turn))
    pcm = TURN_GAP.join(parts)
    return _wav(pcm), round(len(pcm) / (SAMPLE_RATE * 2), 1)


# ---------------------------------------------------------------------------
# One org, one slot
# ---------------------------------------------------------------------------

def _lock(key: str) -> threading.Lock:
    with _locks_guard:
        return _locks.setdefault(key, threading.Lock())


def _build(kind: str, org: dict, end: datetime) -> bool:
    """Make and store one brief. False (and nothing done) when the window has no logs."""
    start = end - SPEC[kind]["window"]
    brief_date = end.date().isoformat()
    entries = _entries(org["id"], start, end)
    if not entries:
        # Nothing logged: no summary, no podcast, no AI call, and no row -- the panel
        # simply shows the briefs that exist.
        return False
    stats = _stats(entries)
    written = _compose(kind, org.get("name") or "The desk", entries,
                       _summaries([e["event_id"] for e in entries]), stats)
    row = {
        "organization_id": org["id"], "kind": kind, "brief_date": brief_date,
        "period_start": start.astimezone(timezone.utc).isoformat(),
        "period_end": end.astimezone(timezone.utc).isoformat(),
        "stats": stats, "headline": written["headline"], "bullets": written["bullets"],
        "script": written["script"], "audio_path": None, "audio_seconds": None, "model": MODEL,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    if written["script"]:
        try:
            wav, seconds = _voice(written["script"])
            path = f"{org['id']}/{kind}-{brief_date}.wav"
            _upload_audio(path, wav)
            row.update(audio_path=path, audio_seconds=seconds)
        except Exception as exc:  # the written brief is still worth saving without audio
            print(f"[briefs] audio failed for {org['id']} {kind} {brief_date}: {type(exc).__name__}: {exc}")
    _upsert(row)
    print(f"[briefs] {kind} {brief_date} org={org['id']} entries={len(entries)} audio={bool(row['audio_path'])}")
    return True


def run(kind: str, org_id: Optional[str] = None, force: bool = False, now: Optional[datetime] = None) -> dict:
    """Make this slot's brief for every org (or one). Skips orgs that already have it
    unless `force`. Safe to call concurrently: one build per (org, kind, slot)."""
    if kind not in SPEC:
        raise ValueError(f"unknown brief kind {kind!r}")
    if not SERVICE_KEY:
        return {"made": 0, "skipped": "no service key"}
    end = slot_end(kind, now)
    brief_date = end.date().isoformat()
    orgs = _organizations(org_id)
    done = set() if force else _existing([o["id"] for o in orgs], kind, brief_date)
    made, failed = 0, 0
    for org in orgs:
        if org["id"] in done:
            continue
        lock = _lock(f"{org['id']}:{kind}:{brief_date}")
        if not lock.acquire(blocking=False):
            continue                                   # already being built
        try:
            if _build(kind, org, end):
                made += 1
        except Exception as exc:
            failed += 1
            print(f"[briefs] {kind} {brief_date} org={org['id']} failed: {type(exc).__name__}: {exc}")
        finally:
            lock.release()
    return {"kind": kind, "brief_date": brief_date, "made": made, "failed": failed}


def run_daily() -> None:
    print(f"[briefs] daily run: {run('daily')}")


def run_weekly() -> None:
    print(f"[briefs] weekly run: {run('weekly')}")


def catch_up(delay: float = 30) -> None:
    """At startup: make any brief whose 08:00 slot has passed but is missing -- the
    machine was down or restarting at 08:00. Delayed so it never slows boot."""
    def _go():
        time.sleep(delay)
        for kind in ("daily", "weekly"):
            try:
                print(f"[briefs] catch-up {kind}: {run(kind)}")
            except Exception as exc:
                print(f"[briefs] catch-up {kind} failed: {type(exc).__name__}: {exc}")
    threading.Thread(target=_go, name="briefs-catch-up", daemon=True).start()
