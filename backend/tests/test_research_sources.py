"""Connector chains end to end against the saved Screener page, offline and without Drishti.

Guards the path every statement pull takes: a crash in screener_table silently drops a
pull to Yahoo, which is exactly how a NameError there went unnoticed once.
"""
from pathlib import Path

from app import research_sources as rs
from app import screener

FIXTURE = Path(__file__).parent / "fixtures" / "screener_coastcorp.html"
PAGE = screener.parse_company_page(FIXTURE.read_text(), "https://www.screener.in/company/COASTCORP/consolidated/")
PAGE["basis"] = "Consolidated"


def _offline(monkeypatch):
    rs._CACHE.clear()
    monkeypatch.setattr(rs, "_drishti_key", lambda: None)
    monkeypatch.setattr(screener, "get_company", lambda code: PAGE)
    # Yahoo must never be reached for these; fail loudly if it is.
    monkeypatch.setattr(rs, "yahoo_table", lambda *a, **k: (_ for _ in ()).throw(AssertionError("fell through to Yahoo")))


def test_every_screener_connector_serves_from_screener(monkeypatch):
    _offline(monkeypatch)
    for connector in ("results", "pnl", "balance", "cashflow", "ratios", "shareholding"):
        p = rs.get_source(connector, "COASTCORP.NS")
        assert p["source"] == "screener", connector
        assert p["table"]["rows"], connector


def test_charts_use_time_columns_only(monkeypatch):
    _offline(monkeypatch)
    p = rs.get_source("pnl", "COASTCORP.NS")
    assert "TTM" not in p["chart"]["periods"]
    assert p["chart"]["type"] == "bar"
    ratios = rs.get_source("ratios", "COASTCORP.NS")
    assert ratios["chart"]["series"] == ["ROCE %"] and ratios["chart"]["type"] == "line"


def test_past_quarter_cuts_the_table(monkeypatch):
    _offline(monkeypatch)
    p = rs.get_source("results", "COASTCORP.NS", "q3_24")      # Q3 FY24 = Dec 2023
    assert p["table"]["columns"][-1] == "Dec 2023"
    assert "to Q3 FY24" in p["title"]
    assert "Drishti" in p["fallback_note"]


def test_quarter_outside_the_source_says_so(monkeypatch):
    _offline(monkeypatch)
    p = rs.get_source("results", "COASTCORP.NS", "q3_19")
    assert "No Q3 FY19 column" in p["fallback_note"]


def test_quarter_end_label():
    assert rs.quarter_end_label("q1_27") == "Jun 2026"
    assert rs.quarter_end_label("q3_25") == "Dec 2024"
    assert rs.quarter_end_label("q4_25") == "Mar 2025"
    assert rs.quarter_end_label("bogus") is None


def test_lakh_filings_convert_to_crore():
    table, basis, _ = rs.earnings_table_from({"consolidated": {
        "current_period_label": "Q1FY27", "previous_quarter_label": "Q4FY26", "previous_year_label": "Q1FY26",
        "revenue": {"unit": "Rs in Lakhs", "current_period_value": 156602.0,
                    "previous_quarter_value": 156351.0, "previous_year_value": 95795.0},
        "eps": {"unit": "Rs", "current_period_value": 21.22, "previous_quarter_value": 19.35, "previous_year_value": 13.09},
    }})
    assert basis == "Consolidated"
    assert table["rows"][0][1:4] == [958.0, 1563.5, 1566.0]
    assert table["rows"][-1][3] == 21.22                      # EPS stays in rupees
