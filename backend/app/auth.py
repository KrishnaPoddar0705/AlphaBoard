"""
Real caller verification for routes that spend money or scrape on a user's behalf.

The rest of this API trusts a client-supplied user_id (see main.py around L195). That
is not acceptable for the Thinking Board connectors: each Drishti call costs credits and
each Screener fetch is a scrape, so an open endpoint is a free proxy for anyone who
finds it. Routes that depend on require_supabase_user only run for a caller holding a
live Supabase access token -- the same token the frontend already uses for every
Command Center read and write under RLS.
"""
import time
from typing import Dict, Tuple

from fastapi import HTTPException, Request

from .db import supabase

# token -> (user_id, expires_at). Verifying costs a round trip to Supabase Auth, and the
# board fires several connector pulls in a burst, so a short cache keeps that to one.
_TOKEN_CACHE: Dict[str, Tuple[str, float]] = {}
_TOKEN_TTL = 60
_TOKEN_CACHE_MAX = 2048


def require_supabase_user(request: Request) -> str:
    """FastAPI dependency: returns the Supabase user id or raises 401."""
    header = request.headers.get("authorization") or ""
    scheme, _, token = header.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=401, detail="Sign in to pull research data.")

    now = time.time()
    hit = _TOKEN_CACHE.get(token)
    if hit and hit[1] > now:
        return hit[0]

    try:
        # get_user(jwt) only reads; it does not touch the service client's own session.
        res = supabase.auth.get_user(token)
        user = getattr(res, "user", None)
    except Exception:
        user = None
    if not user or not getattr(user, "id", None):
        raise HTTPException(status_code=401, detail="Your session has expired. Reload and try again.")

    if len(_TOKEN_CACHE) >= _TOKEN_CACHE_MAX:
        for k in [k for k, (_, exp) in _TOKEN_CACHE.items() if exp <= now] or list(_TOKEN_CACHE)[:256]:
            _TOKEN_CACHE.pop(k, None)
    _TOKEN_CACHE[token] = (user.id, now + _TOKEN_TTL)
    return user.id


# Per-user sliding window. One process (CLAUDE.md: the backend is a single machine), so
# an in-memory window is exact rather than approximate.
_RATE: Dict[str, list] = {}


def enforce_rate_limit(user_id: str, limit: int = 60, window: int = 60) -> None:
    now = time.time()
    hits = [t for t in _RATE.get(user_id, []) if t > now - window]
    if len(hits) >= limit:
        raise HTTPException(status_code=429, detail="Too many data pulls in a minute. Give it a moment.")
    hits.append(now)
    _RATE[user_id] = hits
