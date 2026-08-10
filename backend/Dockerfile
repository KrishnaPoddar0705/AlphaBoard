# syntax=docker/dockerfile:1.7
#
# AlphaBoard backend — FastAPI on Fly.io
#
# Two stages so the compiler toolchain never reaches the runtime image.
# Python 3.13 matches the local venv (backend/venv/lib/python3.13).

# ---------- stage 1: build the virtualenv ----------
FROM python:3.13-slim AS builder

# uv resolves and installs an order of magnitude faster than pip, which matters
# because pandas/numpy/lxml dominate this dependency tree.
#
# Pinned to the same uv version that generated requirements.lock, so the
# resolver reading the lock is the one that wrote it.
COPY --from=ghcr.io/astral-sh/uv:0.11.17 /uv /usr/local/bin/uv

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never

WORKDIR /app

# Only the lock file lands in this layer, so dependency installs stay cached
# across application code changes.
COPY requirements.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv venv /opt/venv && \
    uv pip install --python /opt/venv/bin/python --requirement requirements.lock

# ---------- stage 2: runtime ----------
FROM python:3.13-slim AS runtime

# curl is used by the Fly health check fallback and for debugging via `fly ssh`.
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

# Run as an unprivileged user. Fly machines are single-tenant VMs, but a non-root
# process still limits what a compromised dependency can reach.
RUN groupadd --system --gid 1001 app && \
    useradd --system --uid 1001 --gid app --create-home app

COPY --from=builder /opt/venv /opt/venv

ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000

WORKDIR /app
COPY --chown=app:app app ./app

USER app

EXPOSE 8000

# One uvicorn worker, deliberately.
#
# app/main.py starts an in-process APScheduler (main.py:53) with two daily cron
# jobs at 10:00 UTC. Every additional worker process would start its own
# scheduler and fire those jobs a second time — duplicating the price update and
# the performance-cache refresh. Concurrency here comes from asyncio within the
# single worker, and horizontal scale is capped at one machine in fly.toml.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
