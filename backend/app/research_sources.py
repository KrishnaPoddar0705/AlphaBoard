"""
Thinking Board connectors: one normalised payload per connector, from the first
source in its chain that answers.

    concall       Drishti concall analysis (+ transcript URL) -> Screener concall list
    events        Drishti announcements -> Screener announcements + annual reports + ratings
    news          Drishti news -> news.aggregate_news (Yahoo / Google RSS)
    results       Drishti earnings detail -> Screener quarters -> yfinance quarterly
    pnl/balance/cashflow  Screener -> yfinance
    ratios/shareholding   Screener

Drishti has no statements and no free-text search, which is why the chains are split.
With DRISHTI_API_KEY unset (or rejected) the fallbacks serve, and the payload says why
in `fallback_note`. The key is read per request, so adding it needs no restart.

Payload shape (mirrored in frontend/src/lib/commandCenter/boardTypes.ts):
    {connector, source, source_url, fetched_at, title, subtitle,
     table: {columns, rows} | None, chart: {type, series} | None,
     items: [{date, title, summary, url, tag, sentiment}] | None,
     sections: [{heading, bullets}] | None}
"""
import os
import re
import threading
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import httpx
import pandas as pd
from dotenv import load_dotenv

from . import screener
from .market import get_ticker_obj

load_dotenv()

DRISHTI_BASE = "https://developers.manasija.in/v1"

# Why Drishti was passed over on this request, shown on the card ("Drishti answered 401,
# showing Screener.in"). Thread-local: FastAPI runs sync routes on a threadpool.
_drishti_status = threading.local()

# A fallback served because Drishti was unavailable is cached briefly, so adding the key
# (or Drishti recovering) shows up within a minute instead of after the normal TTL.
FALLBACK_TTL = 60


def _drishti_key() -> Optional[str]:
    """Read per call, not at import: uvicorn --reload watches .py files, not .env, so a key
    added to backend/.env would otherwise need a manual restart to be seen."""
    load_dotenv()
    return os.getenv("DRISHTI_API_KEY") or None


def _note_drishti(reason: str) -> None:
    if not getattr(_drishti_status, "reason", None):
        _drishti_status.reason = reason

DRISHTI_CONNECTORS = ("concall", "events", "news", "results")
CONNECTORS = ("concall", "events", "news", "results", "pnl", "balance", "cashflow", "ratios", "shareholding")

TTL = {
    "news": 600, "events": 1800, "concall": 3600, "results": 3600,
    "pnl": 6 * 3600, "balance": 6 * 3600, "cashflow": 6 * 3600,
    "ratios": 6 * 3600, "shareholding": 6 * 3600,
}

_CACHE: Dict[str, Dict[str, Any]] = {}


class NoSourceData(Exception):
    pass


# ---------------------------------------------------------------------------
# Ticker identity
# ---------------------------------------------------------------------------

def normalize_ticker(ticker: str) -> Dict[str, Optional[str]]:
    """'RELIANCE.NS' -> symbol RELIANCE; '500325.BO' -> scrip_code 500325; 'AAPL' -> US."""
    t = ticker.strip().upper()
    base, _, suffix = t.partition(".")
    indian = suffix in ("NS", "BO")
    symbol = base if indian and not base.isdigit() else None
    scrip = base if indian and base.isdigit() else None
    return {
        "yahoo": t,
        "symbol": symbol,
        "scrip_code": scrip,
        "screener": symbol or scrip,
        "indian": "1" if indian else None,
    }


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _payload(connector: str, source: str, title: str, **kw) -> Dict[str, Any]:
    return {
        "connector": connector, "source": source, "fetched_at": _now(), "title": title,
        "source_url": kw.get("source_url"), "subtitle": kw.get("subtitle"),
        "table": kw.get("table"), "chart": kw.get("chart"),
        "items": kw.get("items"), "sections": kw.get("sections"),
    }


# ---------------------------------------------------------------------------
# Drishti
# ---------------------------------------------------------------------------

def _drishti(path: str, params: Dict[str, Any]) -> Optional[Any]:
    key = _drishti_key()
    if not key:
        _note_drishti("Drishti is not set up on the server (DRISHTI_API_KEY missing)")
        return None
    try:
        with httpx.Client(timeout=15.0) as client:
            res = client.get(f"{DRISHTI_BASE}{path}", params={k: v for k, v in params.items() if v is not None},
                             headers={"X-API-Key": key, "Accept": "application/json"})
        print(f"[drishti] GET {path} {params} -> {res.status_code}")
        if res.status_code != 200:
            print(f"[drishti] body: {res.text[:300]}")
            if res.status_code == 404 and params.get("quarter"):
                _note_drishti(f"Drishti has no {_quarter_label(params['quarter'])} filing for this stock")
            else:
                hint = {401: "key rejected", 402: "out of credits", 403: "key not allowed",
                        404: "nothing found", 429: "rate limited"}.get(res.status_code, "error")
                _note_drishti(f"Drishti answered {res.status_code} ({hint})")
            return None
        return res.json()
    except (httpx.HTTPError, ValueError) as e:
        print(f"[drishti] {path} failed: {e}")
        _note_drishti("Drishti did not respond")
        return None


def _ident(ids: Dict[str, Optional[str]], plural: bool) -> Dict[str, Optional[str]]:
    if ids["symbol"]:
        return {"symbols" if plural else "symbol": ids["symbol"]}
    if ids["scrip_code"]:
        return {"scrip_codes" if plural else "scrip_code": ids["scrip_code"]}
    return {}


_BULLET_PREFIX = re.compile(r"^\s*(?:[*\-\u2022]+|\d+[.)])\s*")


def _clean_line(line: str) -> str:
    """Drishti analysis is markdown: '*   **Crude:** text' -> 'Crude: text'."""
    line = _BULLET_PREFIX.sub("", line.strip())
    line = re.sub(r"\*\*(.+?)\*\*", r"\1", line)
    line = re.sub(r"^#+\s*", "", line)
    return line.strip()


def _as_bullets(value: Any) -> List[str]:
    if value is None:
        return []
    if isinstance(value, str):
        return [c for c in (_clean_line(p) for p in value.replace("\r", "").split("\n")) if c and c != "|"]
    if isinstance(value, list):
        out: List[str] = []
        for v in value:
            out.extend(_as_bullets(v) if not isinstance(v, dict) else [_flatten_facts(v)])
        return [b for b in out if b]
    if isinstance(value, dict):
        fact = _flatten_facts(value)
        return [fact] if fact else []
    return [str(value)]


def _flatten_facts(obj: Dict[str, Any], prefix: str = "") -> str:
    """{'order': {'client': 'X', 'value': None}} -> 'order client: X' (empties dropped)."""
    parts: List[str] = []
    for k, v in obj.items():
        # Drishti's extraction bookkeeping ('status': 'failed', run timestamps), not facts.
        if k in ("status", "date", "id", "confidence"):
            continue
        label = f"{prefix}{k.replace('_', ' ')}"
        if isinstance(v, dict):
            inner = _flatten_facts(v, prefix=f"{label} ")
            if inner:
                parts.append(inner)
        elif v not in (None, "", [], {}):
            parts.append(f"{label}: {v}")
    return "; ".join(parts)


def _sections_from(obj: Any, prefix: str = "") -> List[Dict[str, Any]]:
    """Flatten Drishti's nested analysis objects into heading + bullets."""
    out: List[Dict[str, Any]] = []
    if not isinstance(obj, dict):
        return out
    for key, val in obj.items():
        heading = (prefix + key.replace("_", " ")).strip().capitalize()
        if isinstance(val, dict) and any(isinstance(v, (dict, list)) for v in val.values()):
            out.extend(_sections_from(val, prefix=f"{heading} · "))
        else:
            bullets = _as_bullets(val)
            if bullets:
                out.append({"heading": heading, "bullets": bullets[:12]})
    return out


def _coerce_table(obj: Any) -> Optional[Dict[str, Any]]:
    """Best effort over Drishti's earnings_table, whose schema the docs leave open."""
    if isinstance(obj, dict) and isinstance(obj.get("columns"), list) and isinstance(obj.get("rows"), list):
        return {"columns": [str(c) for c in obj["columns"]], "rows": obj["rows"]}
    if isinstance(obj, list) and obj and all(isinstance(r, dict) for r in obj):
        keys: List[str] = []
        for r in obj:
            keys.extend(k for k in r.keys() if k not in keys)
        return {"columns": [k.replace("_", " ").capitalize() for k in keys],
                "rows": [[r.get(k) for k in keys] for r in obj]}
    if isinstance(obj, dict) and obj and all(isinstance(v, dict) for v in obj.values()):
        periods: List[str] = []
        for v in obj.values():
            periods.extend(p for p in v.keys() if p not in periods)
        return {"columns": ["Line item"] + periods,
                "rows": [[label] + [vals.get(p) for p in periods] for label, vals in obj.items()]}
    return None


def drishti_news(ids) -> Optional[Dict[str, Any]]:
    data = _drishti("/news", {**_ident(ids, True), "limit": 20})
    rows = (data or {}).get("data") or []
    if not rows:
        return None
    items = [{
        "date": r.get("date"), "title": r.get("specific_title") or r.get("title") or "",
        "summary": r.get("summary"), "url": r.get("link"), "tag": r.get("source"),
        "sentiment": r.get("sentiment"),
    } for r in rows]
    return _payload("news", "drishti", "Latest news", items=items,
                    subtitle=f"{len(items)} stories · sentiment tagged")


def drishti_events(ids) -> Optional[Dict[str, Any]]:
    data = _drishti("/announcements", {**_ident(ids, True), "limit": 15, "detailed": "true"})  # 2 credits per item
    rows = (data or {}).get("data") or []
    if not rows:
        return None
    items = []
    for r in rows:
        extra = r.get("extracted_information")
        facts = _flatten_facts(extra) if isinstance(extra, dict) else ""
        items.append({"date": r.get("date"), "title": r.get("summary") or r.get("category") or "Announcement",
                      "summary": facts or None, "url": None, "tag": r.get("category")})
    return _payload("events", "drishti", "Corporate announcements", items=items,
                    subtitle="Exchange filings, summarised")


CONCALL_SECTIONS = [
    ("summarization", "Summary"), ("guidance", "Guidance"), ("financialmetrics", "Financial metrics"),
    ("redflags", "Red flags"), ("qaanalysis", "Analyst Q&A"),
    ("competitivelandscape", "Competitive landscape"), ("markettrends", "Market trends"),
]


def _quarter_label(q: Optional[str]) -> str:
    m = re.match(r"^q([1-4])_(\d{2})$", q or "")
    return f"Q{m.group(1)} FY{m.group(2)}" if m else (q or "Latest")


def drishti_concall(ids, quarter: Optional[str]) -> Optional[Dict[str, Any]]:
    if quarter and _ident(ids, False):
        row = _drishti("/concalls/detail", {**_ident(ids, False), "quarter": quarter, "detailed": "true"})
        row = row.get("data", row) if isinstance(row, dict) else None
        if isinstance(row, list):
            row = row[0] if row else None
    else:
        data = _drishti("/concalls", {**_ident(ids, True), "limit": 1, "detailed": "true"})
        rows = (data or {}).get("data") or []
        row = rows[0] if rows else None
    if not isinstance(row, dict) or not row:
        return None

    q = row.get("quarter") or quarter
    short = row.get("short_analysis") or {}
    expanded = row.get("expanded_analysis") or {}
    sentiment = row.get("sentiment_analysis") or {}
    # The docs put key_indicators directly under sentiment_analysis; the API nests it
    # one level deeper, under "sentiment". Accept both.
    indicators = (sentiment.get("sentiment") or sentiment).get("key_indicators") or {}

    sections: List[Dict[str, Any]] = []
    for key, heading in (("positive", "Positives"), ("negative", "Negatives")):
        b = _as_bullets(indicators.get(key))
        if b:
            sections.append({"heading": heading, "bullets": b[:8]})
    for key, heading in CONCALL_SECTIONS:
        b = _as_bullets(short.get(key))
        detail = expanded.get(key)
        if b or detail:
            sections.append({"heading": heading, "bullets": b[:8],
                             "markdown": detail if isinstance(detail, str) and detail.strip() else None})

    transcript = row.get("transcript_url")
    if not transcript and q and _ident(ids, False):
        t = _drishti("/concalls/transcript", {**_ident(ids, False), "quarter": q})
        if isinstance(t, dict):
            t = t.get("data", t)
            transcript = t.get("transcript_url") if isinstance(t, dict) else None

    label = _quarter_label(q)
    items = [{"date": row.get("date"), "title": f"Transcript \u00b7 {label}", "url": transcript,
              "tag": "Transcript", "summary": None}] if transcript else None
    if not sections and not items:
        return None
    return _payload("concall", "drishti", f"Concall \u00b7 {label}", sections=sections or None,
                    items=items, source_url=transcript, subtitle="Management commentary, analysed")


# "as filed": the company's own operating profit line, which usually differs from
# Screener's Sales - Expenses (Screener excludes other income; filings vary).
EARNINGS_ROWS = [("revenue", "Revenue"), ("operating_profit", "Operating profit (as filed)"),
                 ("pat", "Net profit"), ("eps", "EPS (\u20b9)")]


def _period_label(raw: Optional[str]) -> Optional[str]:
    """'Q1FY27' -> 'Q1 FY27'."""
    if not raw:
        return None
    m = re.match(r"^(Q[1-4])\s*(FY\d{2})$", raw.strip(), re.I)
    return f"{m.group(1).upper()} {m.group(2).upper()}" if m else raw.strip()


def _to_crore_factor(unit: Optional[str]) -> Optional[float]:
    """Multiplier from a filing's stated unit to ₹ crore, or None if the unit is unknown.

    Companies file in whatever unit they choose -- BSE reports 'Rs in Lakhs', Reliance
    'Rs in crore' -- and Drishti passes it through per line item. Missing units are
    treated as crore, which is what Drishti's own large-cap filings use.
    """
    u = (unit or "crore").lower()
    if "lakh" in u or "lac" in u:
        return 0.01
    if "crore" in u or re.search(r"\bcr\b", u):
        return 1.0
    if "billion" in u or re.search(r"\bbn\b", u):
        return 100.0
    if "million" in u or re.search(r"\bmn\b", u):
        return 0.1
    if "thousand" in u or re.search(r"\b(000s?|k)\b", u):
        return 0.0001
    if u.strip() in ("rs", "inr", "rupees", "\u20b9"):
        return 1e-7
    return None


def _pct(now: Any, before: Any) -> Optional[float]:
    if isinstance(now, (int, float)) and isinstance(before, (int, float)) and before:
        return round((now - before) / abs(before) * 100, 1)
    return None


def earnings_table_from(obj: Any) -> Tuple[Optional[Dict[str, Any]], Optional[str], List[str]]:
    """Drishti's earnings_table -> a three-quarter comparison, oldest first.

    Returns (table, basis, period_columns). Consolidated when it carries revenue,
    otherwise standalone.
    """
    if not isinstance(obj, dict):
        return None, None, []
    for basis in ("consolidated", "standalone"):
        part = obj.get(basis)
        if not isinstance(part, dict):
            continue
        rev = part.get("revenue") or {}
        if not isinstance(rev, dict) or rev.get("current_period_value") is None:
            continue
        cur = _period_label(part.get("current_period_label")) or "Current"
        prev_q = _period_label(part.get("previous_quarter_label")) or "Previous quarter"
        prev_y = _period_label(part.get("previous_year_label")) or "Year ago"
        periods = [prev_y, prev_q, cur]
        rows: List[List[Any]] = []
        for key, label in EARNINGS_ROWS:
            m = part.get(key)
            if not isinstance(m, dict) or m.get("current_period_value") is None:
                continue
            vals = [m.get("previous_year_value"), m.get("previous_quarter_value"), m.get("current_period_value")]
            if key != "eps":
                factor = _to_crore_factor(m.get("unit"))
                if factor is None:
                    print(f"[drishti] unknown unit {m.get('unit')!r} for {key}; row skipped")
                    continue
                vals = [round(v * factor, 1) if isinstance(v, (int, float)) else None for v in vals]
            py, pq, c = vals
            rows.append([label, py, pq, c, _pct(c, py), _pct(c, pq)])
        if not rows:
            continue
        rev_row = next((r for r in rows if r[0] == "Revenue"), None)
        op_row = next((r for r in rows if r[0].startswith("Operating profit")), None)
        if rev_row and op_row:
            margins = [round(o / r * 100, 1) if isinstance(o, (int, float)) and isinstance(r, (int, float)) and r else None
                       for o, r in zip(op_row[1:4], rev_row[1:4])]
            rows.insert(2, ["Operating margin %", *margins, None, None])
        return {"columns": ["Line item", *periods, "YoY %", "QoQ %"], "rows": rows}, basis.capitalize(), periods
    return None, None, []


def drishti_results(ids, quarter: Optional[str]) -> Optional[Dict[str, Any]]:
    if not _ident(ids, False):
        return None
    if not quarter:
        idx = _drishti("/earnings", {**_ident(ids, True), "limit": 1})
        rows = (idx or {}).get("data") or []
        quarter = rows[0].get("quarter") if rows else None
    if not quarter:
        return None
    data = _drishti("/earnings/detail", {**_ident(ids, False), "quarter": quarter, "detailed": "true"})
    row = data.get("data", data) if isinstance(data, dict) else None
    if isinstance(row, list):
        row = row[0] if row else None
    if not isinstance(row, dict) or not row:
        return None
    table, basis, _ = earnings_table_from(row.get("earnings_table"))
    sections = []
    for key, heading in (("summary", "Summary"), ("management_guidance", "Management guidance"),
                         ("exceptional_items", "Exceptional items")):
        b = _as_bullets(row.get(key))
        if b:
            sections.append({"heading": heading, "bullets": b})
    if not table and not sections:
        return None
    return _payload("results", "drishti", f"Results \u00b7 {_quarter_label(quarter)}",
                    table=table, sections=sections or None,
                    chart=chart_for(table, ["Revenue", "Operating profit (as filed)", "Net profit"], "bar") if table else None,
                    subtitle=f"{basis or 'Reported'} \u00b7 \u20b9 Cr \u00b7 from the exchange filing")


# ---------------------------------------------------------------------------
# Screener
# ---------------------------------------------------------------------------


# A column is a time period when it reads like 'Mar 2026', 'Q1 FY27' or 'FY26'. 'TTM'
# and the YoY/QoQ columns are not, and never go on a chart's time axis.
_PERIOD_RE = re.compile(r"^(?:[A-Z][a-z]{2} \d{4}|Q[1-4] FY\d{2}|FY\d{2})$")
MIN_CHART_PERIODS = 3


def chart_for(table: Dict[str, Any], wanted: List[str], kind: str) -> Optional[Dict[str, Any]]:
    """Chart spec only when it can say something: a time axis of 3+ periods, and series
    with real numbers in at least 3 of them. Otherwise the card shows the table alone."""
    cols = table["columns"]
    periods = [c for c in cols[1:] if _PERIOD_RE.match(str(c))]
    if len(periods) < MIN_CHART_PERIODS:
        return None
    idx = [cols.index(p) for p in periods]
    series = []
    for name in wanted:
        row = next((r for r in table["rows"] if r[0] == name), None)
        if not row:
            continue
        vals = [row[i] for i in idx if isinstance(row[i], (int, float))]
        if len(vals) >= MIN_CHART_PERIODS and any(v != 0 for v in vals):
            series.append(name)
    return {"type": kind, "series": series, "periods": periods} if series else None


SCREENER_MAP = {
    "results": ("quarters", "Quarterly results", ["Sales", "Net Profit"], "bar"),
    "pnl": ("profit-loss", "Income statement", ["Sales", "Operating Profit", "Net Profit"], "bar"),
    "balance": ("balance-sheet", "Balance sheet", ["Reserves", "Borrowings", "Total Assets"], "bar"),
    "cashflow": ("cash-flow", "Cash flow", ["Cash from Operating Activity", "Cash from Investing Activity",
                                            "Cash from Financing Activity"], "bar"),
    # One unit per chart: ROCE is a %, the rest are days, and one axis cannot carry both.
    "ratios": ("ratios", "Ratios & efficiency", ["ROCE %"], "line"),
    "shareholding": ("shareholding", "Shareholding pattern", ["Promoters", "FIIs", "DIIs", "Public"], "line"),
}


_QUARTER_END = {1: ("Jun", 0), 2: ("Sep", 0), 3: ("Dec", 0), 4: ("Mar", 1)}


def quarter_end_label(q: Optional[str]) -> Optional[str]:
    """Drishti key -> the month column Screener and Yahoo use: q3_25 (Q3 FY25) -> 'Dec 2024'.

    Indian fiscal year: FY25 runs Apr 2024 - Mar 2025, so Q1-Q3 end in 2024 and Q4 in 2025.
    """
    m = re.match(r"^q([1-4])_(\d{2})$", q or "")
    if not m:
        return None
    month, bump = _QUARTER_END[int(m.group(1))]
    return f"{month} {2000 + int(m.group(2)) - 1 + bump}"


def as_of_quarter(table: Dict[str, Any], quarter: Optional[str]) -> Tuple[Dict[str, Any], Optional[str]]:
    """Cut a quarterly table so its newest column is the chosen quarter.

    Returns (table, problem). Without a quarter the table is returned whole; a quarter the
    table does not reach back to (or forward to) comes back as a problem to show the user.
    """
    end = quarter_end_label(quarter)
    if not end:
        return table, None
    cols = [str(c) for c in table["columns"]]
    if end not in cols:
        return table, f"No {_quarter_label(quarter)} column in this source; showing the latest quarters"
    cut = cols.index(end) + 1
    return {"columns": table["columns"][:cut], "rows": [r[:cut] for r in table["rows"]]}, None


def screener_table(connector: str, ids, quarter: Optional[str] = None) -> Optional[Dict[str, Any]]:
    if not ids["screener"]:
        return None
    page = screener.get_company(ids["screener"])
    if not page:
        return None
    sid, title, wanted, kind = SCREENER_MAP[connector]
    table = page["tables"].get(sid)
    if not table:
        return None
    problem = None
    if connector == "results" and quarter:
        table, problem = as_of_quarter(table, quarter)
        if not problem:
            title = f"{title} \u00b7 to {_quarter_label(quarter)}"
    unit = "% of shares" if connector == "shareholding" else ("ratios" if connector == "ratios" else "\u20b9 Cr")
    payload = _payload(connector, "screener", title, table=table, source_url=page["url"],
                       chart=chart_for(table, wanted, kind),
                       subtitle=f"{page.get('basis', 'Consolidated')} \u00b7 {unit}")
    if problem:
        payload["fallback_note"] = problem
    return payload


def screener_events(ids) -> Optional[Dict[str, Any]]:
    page = screener.get_company(ids["screener"]) if ids["screener"] else None
    if not page:
        return None
    docs = page["documents"]
    items = docs["announcements"][:20] + docs["annual_reports"][:6] + docs["credit_ratings"][:4]
    if not items:
        return None
    return _payload("events", "screener", "Corporate events & filings", items=items,
                    source_url=page["url"] + "#documents",
                    subtitle="Announcements, annual reports, credit ratings")


def screener_concall(ids) -> Optional[Dict[str, Any]]:
    page = screener.get_company(ids["screener"]) if ids["screener"] else None
    if not page or not page["documents"]["concalls"]:
        return None
    return _payload("concall", "screener", "Concall archive", items=page["documents"]["concalls"][:12],
                    source_url=page["url"] + "#documents",
                    subtitle="Transcripts, recordings and presentations")


# ---------------------------------------------------------------------------
# Yahoo Finance (last resort)
# ---------------------------------------------------------------------------

YAHOO_ROWS = {
    "pnl": ("financials", ["Total Revenue", "Cost Of Revenue", "Gross Profit", "Operating Expense",
                           "Operating Income", "EBITDA", "Interest Expense", "Pretax Income",
                           "Tax Provision", "Net Income", "Basic EPS"]),
    "results": ("quarterly_financials", ["Total Revenue", "Operating Income", "EBITDA",
                                         "Pretax Income", "Net Income", "Basic EPS"]),
    "balance": ("balance_sheet", ["Total Assets", "Current Assets", "Cash And Cash Equivalents", "Inventory",
                                  "Net PPE", "Total Liabilities Net Minority Interest", "Current Liabilities",
                                  "Total Debt", "Stockholders Equity"]),
    "cashflow": ("cashflow", ["Operating Cash Flow", "Investing Cash Flow", "Financing Cash Flow",
                              "Capital Expenditure", "Free Cash Flow", "Cash Dividends Paid"]),
}
YAHOO_CHART = {
    "pnl": ["Total Revenue", "Net Income"], "results": ["Total Revenue", "Net Income"],
    "balance": ["Total Assets", "Total Debt"], "cashflow": ["Operating Cash Flow", "Free Cash Flow"],
}


def yahoo_table(connector: str, ids, quarter: Optional[str] = None) -> Optional[Dict[str, Any]]:
    if connector not in YAHOO_ROWS:
        return None
    attr, wanted = YAHOO_ROWS[connector]
    try:
        df: pd.DataFrame = getattr(get_ticker_obj(ids["yahoo"]), attr)
    except Exception as e:
        print(f"[yahoo] {attr} {ids['yahoo']} failed: {e}")
        return None
    if df is None or df.empty:
        return None
    dates = sorted(df.columns)
    indian = bool(ids["indian"])
    divisor, unit = (1e7, "₹ Cr") if indian else (1e6, "millions")
    rows: List[List[Any]] = []
    for label in wanted:
        if label not in df.index:
            continue
        vals = []
        for d in dates:
            v = df.loc[label, d]
            if pd.isna(v):
                vals.append(None)
            elif "EPS" in label:
                vals.append(round(float(v), 2))
            else:
                vals.append(round(float(v) / divisor, 1))
        rows.append([label] + vals)
    if not rows:
        return None
    cols = ["Line item"] + [d.strftime("%b %Y") if hasattr(d, "strftime") else str(d) for d in dates]
    table = {"columns": cols, "rows": rows}
    title = {"pnl": "Income statement", "results": "Quarterly results",
             "balance": "Balance sheet", "cashflow": "Cash flow"}[connector]
    problem = None
    if connector == "results" and quarter:
        table, problem = as_of_quarter(table, quarter)
        if not problem:
            title = f"{title} \u00b7 to {_quarter_label(quarter)}"
    payload = _payload(connector, "yahoo", title, table=table,
                       chart=chart_for(table, YAHOO_CHART[connector], "bar"),
                       source_url=f"https://finance.yahoo.com/quote/{ids['yahoo']}/financials",
                       subtitle=f"Yahoo Finance · {unit}")
    if problem:
        payload["fallback_note"] = problem
    return payload


def yahoo_news(ids) -> Optional[Dict[str, Any]]:
    from .news import aggregate_news  # imported lazily: news.py pulls in OpenAI on import
    try:
        articles = aggregate_news(ids["yahoo"], limit=20)
    except Exception as e:
        print(f"[news] aggregate failed: {e}")
        return None
    if not articles:
        return None
    items = [{"date": a.get("published_at"), "title": a.get("headline") or "",
              "summary": (a.get("summary") or a.get("full_content") or "")[:400] or None,
              "url": a.get("source_url"), "tag": a.get("source"), "sentiment": None} for a in articles]
    return _payload("news", "yahoo", "Latest news", items=items, subtitle="Yahoo Finance · Google News")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def _with_screener_table(primary: Optional[Dict[str, Any]], ids, quarter: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Drishti results with no usable table: keep its commentary, borrow Screener's numbers."""
    if not primary or primary.get("table"):
        return primary
    sc = screener_table("results", ids, quarter)
    if sc:
        sc["sections"] = primary.get("sections")
        sc["subtitle"] = (sc.get("subtitle") or "") + " · commentary from Drishti"
        return sc
    return primary if primary.get("sections") else None


def get_source(connector: str, ticker: str, quarter: Optional[str] = None) -> Dict[str, Any]:
    if connector not in CONNECTORS:
        raise ValueError(f"Unknown connector {connector}")
    key = f"{connector}:{ticker.upper()}:{quarter or ''}"
    hit = _CACHE.get(key)
    if hit and hit["expires"] > time.time():
        return hit["data"]

    ids = normalize_ticker(ticker)
    _drishti_status.reason = None
    chains = {
        "concall": [lambda: drishti_concall(ids, quarter), lambda: screener_concall(ids)],
        "events": [lambda: drishti_events(ids), lambda: screener_events(ids)],
        "news": [lambda: drishti_news(ids), lambda: yahoo_news(ids)],
        "results": [lambda: _with_screener_table(drishti_results(ids, quarter), ids, quarter),
                    lambda: screener_table("results", ids, quarter), lambda: yahoo_table("results", ids, quarter)],
        "pnl": [lambda: screener_table("pnl", ids), lambda: yahoo_table("pnl", ids)],
        "balance": [lambda: screener_table("balance", ids), lambda: yahoo_table("balance", ids)],
        "cashflow": [lambda: screener_table("cashflow", ids), lambda: yahoo_table("cashflow", ids)],
        "ratios": [lambda: screener_table("ratios", ids)],
        "shareholding": [lambda: screener_table("shareholding", ids)],
    }
    for attempt in chains[connector]:
        try:
            data = attempt()
        except Exception as e:  # one broken source must not hide the next
            print(f"[board] {connector} source failed for {ticker}: {e}")
            data = None
        if data:
            ttl = TTL[connector]
            reason = getattr(_drishti_status, "reason", None)
            if data["source"] != "drishti" and connector in DRISHTI_CONNECTORS:
                lead = f"{reason or 'Drishti had no data for this stock'}, so this is from {data['source'].capitalize()}."
                data = {**data, "fallback_note": f"{lead} {data['fallback_note']}." if data.get("fallback_note") else lead}
                if reason:
                    ttl = FALLBACK_TTL
            _CACHE[key] = {"data": data, "expires": time.time() + ttl}
            return data
    raise NoSourceData(f"No source had {connector.replace('_', ' ')} data for {ticker}.")
