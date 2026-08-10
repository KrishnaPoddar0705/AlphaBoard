# syntax=docker/dockerfile:1.7
#
# AlphaBoard WhatsApp bot — FastAPI on Fly.io
#
# Unlike the backend, this service is stateless: no scheduler, no in-process
# cron. It is safe to stop when idle and safe to run in multiple copies.

# ---------- stage 1: build the virtualenv ----------
FROM python:3.13-slim AS builder

# Pinned to the same uv version that generated requirements.lock.
COPY --from=ghcr.io/astral-sh/uv:0.11.17 /uv /usr/local/bin/uv

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never

WORKDIR /app

COPY requirements.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv venv /opt/venv && \
    uv pip install --python /opt/venv/bin/python --requirement requirements.lock

# ---------- stage 2: runtime ----------
FROM python:3.13-slim AS runtime

RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

RUN groupadd --system --gid 1001 app && \
    useradd --system --uid 1001 --gid app --create-home app

COPY --from=builder /opt/venv /opt/venv

ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8001 \
    ENVIRONMENT=prod

WORKDIR /app
COPY --chown=app:app src ./src

USER app

EXPOSE 8001

# src.main:app matches start.sh, which resolves the module as `src.main` from
# the whatsapp-bot directory. WORKDIR /app with src/ copied in preserves that
# import path, so config.py and the routers resolve exactly as they do locally.
#
# ENVIRONMENT=prod above also disables /docs and /redoc (main.py:79), which is
# the behaviour you want on a publicly reachable webhook endpoint.
#
# The value must be exactly `prod` — config.py:174 types it as
# Literal["local", "dev", "prod"], so anything else (e.g. "production") fails
# pydantic validation at startup and crash-loops the machine.
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8001"]
