"""One place that builds the OpenAI client, so every LLM call is traced the same way.

With POSTHOG_API_KEY set, the client is PostHog's drop-in wrapper: each completion is
recorded as an `$ai_generation` event (model, tokens, cost, latency, errors) in PostHog's
LLM analytics. Without it -- local development, or the key simply not configured -- this
returns the plain OpenAI client and nothing is sent anywhere.

Set POSTHOG_LLM_PRIVACY_MODE=true to record the metadata but not the prompt and
response text.
"""
import atexit
import os

from dotenv import load_dotenv
from openai import OpenAI

# Imported before the modules that call load_dotenv() themselves, so do it here too.
load_dotenv()

POSTHOG_API_KEY = os.getenv("POSTHOG_API_KEY")
POSTHOG_HOST = os.getenv("POSTHOG_HOST", "https://us.i.posthog.com")

_posthog = None
if POSTHOG_API_KEY:
    try:
        from posthog import Posthog

        _posthog = Posthog(POSTHOG_API_KEY, host=POSTHOG_HOST)
        _posthog.privacy_mode = os.getenv("POSTHOG_LLM_PRIVACY_MODE", "").lower() == "true"
        # Events are batched in a background thread; flush what is left on shutdown.
        atexit.register(_posthog.shutdown)
    except Exception as exc:  # analytics must never stop the API from starting
        print(f"[llm] PostHog disabled: {exc}")
        _posthog = None


def make_openai_client(api_key: str | None = None) -> OpenAI:
    """An OpenAI client, traced to PostHog when configured."""
    api_key = api_key or os.getenv("OPENAI_API_KEY")
    if _posthog is not None:
        from posthog.ai.openai import OpenAI as TracedOpenAI

        return TracedOpenAI(api_key=api_key, posthog_client=_posthog)
    return OpenAI(api_key=api_key)


def trace(feature: str, **properties) -> dict:
    """Extra keyword arguments for a traced completion call.

    `client.chat.completions.create(..., **trace("news_summary", ticker=t))` tags the
    generation with which feature made it. Returns nothing when tracing is off, because
    the plain OpenAI client rejects the posthog_* arguments.
    """
    if _posthog is None:
        return {}
    return {"posthog_properties": {"feature": feature, **properties}}
