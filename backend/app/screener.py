"""
Screener.in company page scraper -- the Thinking Board's source for financial
statements, ratios, shareholding and exchange document links.

One page fetch carries every table, so the parsed page is cached (6h) and shared by
all connectors: pulling P&L then Balance sheet then Cash flow costs one request, not
three. Fetches are low-volume, user-initiated and identified by User-Agent.

Values on Screener are ₹ crore (shareholding is %). parse_company_page is a pure
function over HTML so it can be tested against a saved page (tests/fixtures).
"""
import re
import time
from typing import Any, Dict, List, Optional

import httpx
from bs4 import BeautifulSoup

BASE = "https://www.screener.in"
USER_AGENT = "Mozilla/5.0 (compatible; AlphaBoard research desk; +https://alphaboard.theunicornlabs.com)"
PAGE_TTL = 6 * 3600

TABLE_SECTIONS = ["quarters", "profit-loss", "balance-sheet", "cash-flow", "ratios", "shareholding"]

_PAGE_CACHE: Dict[str, Dict[str, Any]] = {}

_NUM_RE = re.compile(r"^-?[\d,]*\.?\d+%?$")


def _clean_label(text: str) -> str:
    # Screener appends " +" to expandable rows ("Sales +", "Borrowings +").
    return re.sub(r"\s*\+\s*$", "", text).strip()


def _to_number(text: str) -> Any:
    t = text.strip().replace(" ", "")
    if not t:
        return None
    if _NUM_RE.match(t):
        try:
            return float(t.replace(",", "").rstrip("%"))
        except ValueError:
            return t
    return t


def _parse_table(section) -> Optional[Dict[str, Any]]:
    if section is None:
        return None
    # Shareholding has a quarterly and a yearly table; the first (quarterly) is wanted.
    table = section.find("table", class_="data-table")
    if table is None or table.find("thead") is None or table.find("tbody") is None:
        return None
    header = [th.get_text(" ", strip=True) for th in table.find("thead").find_all("th")]
    rows: List[List[Any]] = []
    for tr in table.find("tbody").find_all("tr"):
        cells = tr.find_all("td")
        if not cells:
            continue
        label = _clean_label(cells[0].get_text(" ", strip=True))
        if not label or label.lower().startswith("raw pdf"):
            continue
        rows.append([label] + [_to_number(c.get_text(" ", strip=True)) for c in cells[1:]])
    if not rows:
        return None
    columns = ["Line item"] + header[1:]
    return {"columns": columns, "rows": rows}


def _parse_documents(doc_section) -> Dict[str, List[Dict[str, Any]]]:
    out: Dict[str, List[Dict[str, Any]]] = {
        "announcements": [], "annual_reports": [], "concalls": [], "credit_ratings": [],
    }
    if doc_section is None:
        return out

    for block in doc_section.find_all("div", class_="documents"):
        classes = block.get("class") or []
        if "annual-reports" in classes:
            for li in block.find_all("li"):
                a = li.find("a")
                if a and a.get("href"):
                    out["annual_reports"].append({
                        "date": None, "title": a.get_text(" ", strip=True),
                        "url": a["href"], "tag": "Annual report",
                    })
        elif "concalls" in classes:
            for li in block.find_all("li"):
                when = li.find("div")
                period = when.get_text(" ", strip=True) if when else ""
                links = {}
                for chip in li.find_all(["a", "div"], class_="button-chip"):
                    name = chip.get_text(" ", strip=True)
                    if chip.name == "a" and chip.get("href"):
                        links[name] = chip["href"]
                url = links.get("Transcript") or links.get("REC") or links.get("PPT")
                tag = "Transcript" if "Transcript" in links else ("Recording" if "REC" in links else "Presentation")
                if period:
                    out["concalls"].append({
                        "date": None, "title": f"Concall · {period}", "url": url,
                        "tag": tag if url else "Not filed", "summary": None,
                    })
        elif "credit-ratings" in classes:
            for li in block.find_all("li"):
                a = li.find("a")
                if a and a.get("href"):
                    out["credit_ratings"].append({
                        "date": None, "title": a.get_text(" ", strip=True),
                        "url": a["href"], "tag": "Credit rating",
                    })
        else:
            for li in block.find_all("li"):
                a = li.find("a")
                if not a or not a.get("href") or a.get_text(strip=True) == "All":
                    continue
                meta = a.find("div")
                summary, date = None, None
                if meta is not None:
                    t = meta.find("time")
                    date = t.get("datetime") if t is not None else None
                    meta_text = meta.get_text(" ", strip=True)
                    summary = re.sub(r"^[^-]*-\s*", "", meta_text) if " - " in meta_text else None
                    meta.extract()
                out["announcements"].append({
                    "date": date, "title": a.get_text(" ", strip=True), "summary": summary,
                    "url": a["href"], "tag": "Announcement",
                })
    return out


def parse_company_page(html: str, url: str) -> Dict[str, Any]:
    soup = BeautifulSoup(html, "lxml")
    h1 = soup.find("h1")
    tables = {sid: _parse_table(soup.find("section", id=sid)) for sid in TABLE_SECTIONS}
    top = [li.get_text(" ", strip=True) for li in soup.select("#top-ratios li")]
    return {
        "name": h1.get_text(strip=True) if h1 else None,
        "url": url,
        "tables": tables,
        "documents": _parse_documents(soup.find("section", id="documents")),
        "top_ratios": [re.sub(r"\s+", " ", t) for t in top],
    }


def _fetch(url: str) -> Optional[str]:
    try:
        with httpx.Client(timeout=12.0, follow_redirects=True,
                          headers={"User-Agent": USER_AGENT, "Accept": "text/html"}) as client:
            res = client.get(url)
        if res.status_code != 200:
            return None
        return res.text
    except httpx.HTTPError as e:
        print(f"[screener] fetch failed {url}: {e}")
        return None


def get_company(code: str) -> Optional[Dict[str, Any]]:
    """Parsed page for an NSE symbol or BSE scrip code; consolidated first, then standalone."""
    code = code.strip().upper()
    hit = _PAGE_CACHE.get(code)
    if hit and hit["expires"] > time.time():
        return hit["data"]

    data = None
    for suffix, basis in (("consolidated/", "Consolidated"), ("", "Standalone")):
        url = f"{BASE}/company/{code}/{suffix}"
        html = _fetch(url)
        if not html:
            continue
        parsed = parse_company_page(html, url)
        # Companies with no subsidiaries render an empty consolidated page.
        if parsed["tables"].get("profit-loss") or parsed["tables"].get("quarters"):
            parsed["basis"] = basis
            data = parsed
            break

    if data is not None:
        _PAGE_CACHE[code] = {"data": data, "expires": time.time() + PAGE_TTL}
    return data
