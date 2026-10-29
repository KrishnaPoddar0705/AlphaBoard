"""Screener parser against a trimmed copy of a real company page (COASTCORP, Oct 2026)."""
from pathlib import Path

from app.screener import parse_company_page

FIXTURE = Path(__file__).parent / "fixtures" / "screener_coastcorp.html"


def _page():
    return parse_company_page(FIXTURE.read_text(), "https://www.screener.in/company/COASTCORP/consolidated/")


def test_company_name():
    assert _page()["name"] == "Coastal Corporation Ltd"


def test_statement_tables_parse_to_numbers():
    tables = _page()["tables"]
    for sid in ("quarters", "profit-loss", "balance-sheet", "cash-flow", "ratios", "shareholding"):
        assert tables[sid], sid
        assert tables[sid]["columns"][0] == "Line item"
    pnl = tables["profit-loss"]
    sales = next(r for r in pnl["rows"] if r[0] == "Sales")  # the " +" suffix is stripped
    assert sales[1] == 278.0
    assert pnl["columns"][-1] == "TTM"
    assert all(len(r) == len(pnl["columns"]) for r in pnl["rows"])


def test_percent_cells_become_floats():
    promoters = next(r for r in _page()["tables"]["shareholding"]["rows"] if r[0] == "Promoters")
    assert promoters[1] == 41.86


def test_documents():
    docs = _page()["documents"]
    assert docs["announcements"] and docs["announcements"][0]["url"].startswith("https://www.bseindia.com")
    assert docs["announcements"][0]["date"].startswith("2026-10-05")
    assert docs["annual_reports"][0]["title"] == "Annual Report 2026"
    assert docs["concalls"][0]["title"].startswith("Concall")
    assert all(a["title"] != "All" for a in docs["announcements"])
