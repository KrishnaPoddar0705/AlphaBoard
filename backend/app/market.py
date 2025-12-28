import yfinance as yf
import pandas as pd
from typing import Dict, Optional, List, Any
import os
import httpx
from dotenv import load_dotenv
import time
import json
from openai import OpenAI

load_dotenv()

FINNHUB_API_KEY = os.getenv("FINNHUB_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# Initialize OpenAI client
openai_client = None
if OPENAI_API_KEY:
    openai_client = OpenAI(api_key=OPENAI_API_KEY)

# Simple in-memory cache
# Structure: { "key": { "data": ..., "expires": timestamp } }
CACHE = {}
CACHE_DURATION = 300 # 5 minutes

def get_cached_data(key: str):
    if key in CACHE:
        if time.time() < CACHE[key]["expires"]:
            return CACHE[key]["data"]
        else:
            del CACHE[key]
    return None

def set_cached_data(key: str, data: Any):
    CACHE[key] = {
        "data": data,
        "expires": time.time() + CACHE_DURATION
    }

def get_ticker_obj(ticker: str):
    """
    Get yfinance Ticker object. 
    Don't modify ticker - use it as-is. Yahoo Finance handles both US (AAPL) and Indian (RELIANCE.NS) tickers.
    """
    # Use ticker as-is - yfinance can handle both US and Indian tickers
    # US tickers: AAPL, MSFT, GOOGL (no suffix)
    # Indian tickers: RELIANCE.NS, TCS.NS, HDFCBANK.NS (with .NS or .BO suffix)
    return yf.Ticker(ticker)

def get_current_price(ticker: str) -> Optional[float]:
    """
    Get current price for a ticker. Works for both US and Indian stocks.
    """
    stock = get_ticker_obj(ticker)
    try:
        # Fast fetch if possible, info can be slow. 
        # fast_info is better in newer yfinance
        try:
            price = stock.fast_info.get('last_price')
            if price and price > 0:
                return float(price)
        except:
            pass
        
        # Fallback to info
        try:
            info = stock.info
            price = info.get('currentPrice') or info.get('regularMarketPrice') or info.get('previousClose')
            if price and price > 0:
                return float(price)
        except:
            pass
        
        # Last resort: try history
        try:
            hist = stock.history(period="1d", interval="1m")
            if not hist.empty:
                last_price = hist['Close'].iloc[-1]
                if last_price and last_price > 0:
                    return float(last_price)
        except:
            pass
        
        return None
    except Exception as e:
        print(f"Error fetching price for {ticker}: {e}")
        return None

def search_stocks(query: str) -> List[Dict[str, str]]:
    """
    Search for stocks using Yahoo Finance and Finnhub (if available).
    Supports both US and Indian markets.
    """
    results = []
    clean_query = query.upper().strip()
    
    # Try Yahoo Finance search first (works for both US and Indian stocks)
    try:
        # Yahoo Finance search endpoint
        search_url = f"https://query1.finance.yahoo.com/v1/finance/search?q={clean_query}&quotesCount=15&newsCount=0"
        response = httpx.get(search_url, timeout=5)
        if response.status_code == 200:
            data = response.json()
            quotes = data.get("quotes", [])
            
            for quote in quotes[:15]:  # Limit to 15 results
                symbol = quote.get("symbol", "")
                name = quote.get("longname") or quote.get("shortname") or quote.get("name", "")
                exchange = quote.get("exchange", "")
                
                # Skip if no symbol or name
                if not symbol or not name:
                    continue
                
                # Determine market type
                if ".NS" in symbol or exchange == "NSE":
                    market = "NSE"
                elif ".BO" in symbol or exchange == "BSE":
                    market = "BSE"
                elif exchange in ["NYSE", "NASDAQ", "AMEX"] or (not symbol.endswith((".NS", ".BO")) and "." not in symbol):
                    market = "US"
                else:
                    market = "US"  # Default to US for unknown exchanges
                
                results.append({
                    "symbol": symbol,
                    "name": name,
                    "market": market
                })
            
            if results:
                return results
    except Exception as e:
        print(f"Yahoo Finance search error: {e}")
    
    # Fallback to Finnhub if available
    if FINNHUB_API_KEY:
        try:
            url = f"https://finnhub.io/api/v1/search?q={clean_query}&token={FINNHUB_API_KEY}"
            response = httpx.get(url, timeout=5)
            if response.status_code == 200:
                data = response.json()
                for item in data.get("result", [])[:15]:
                    symbol = item.get("symbol", "")
                    name = item.get("description", "")
                    if symbol and name:
                        # Determine market from symbol
                        if ".NS" in symbol:
                            market = "NSE"
                        elif ".BO" in symbol:
                            market = "BSE"
                        else:
                            market = "US"
                        
                        results.append({
                            "symbol": symbol,
                            "name": name,
                            "market": market
                        })
                if results:
                    return results
        except Exception as e:
            print(f"Finnhub search error: {e}")
    
    # Final fallback: suggest Indian markets
    if not results:
        results.append({"symbol": f"{clean_query}.NS", "name": f"{clean_query} (NSE)", "market": "NSE"})
        results.append({"symbol": f"{clean_query}.BO", "name": f"{clean_query} (BSE)", "market": "BSE"})
        # Also suggest US ticker
        results.append({"symbol": clean_query, "name": f"{clean_query} (US)", "market": "US"})
    
    return results

def format_statement(df: pd.DataFrame, key_map: Dict[str, str], count: int = 5) -> List[Dict[str, Any]]:
    if df is None or df.empty:
        return []
    result = []
    dates = sorted(df.columns)[-count:]
    for date in dates:
        item = {"year": date.strftime("%Y") if hasattr(date, 'strftime') else str(date)}
        for yf_key, out_key in key_map.items():
            val = 0
            try:
                if yf_key in df.index:
                    val = df.loc[yf_key, date]
                    if pd.isna(val): val = 0
            except:
                val = 0
            item[out_key] = val
        result.append(item)
    return result

# --- Split Endpoints ---

def get_stock_summary(ticker: str) -> Dict[str, Any]:
    cache_key = f"{ticker}_summary"
    cached = get_cached_data(cache_key)
    if cached: return cached

    stock = get_ticker_obj(ticker)
    try:
        info = stock.info
        summary = {
            "companyName": info.get("longName") or info.get("shortName") or info.get("name"),
            "marketCap": info.get("marketCap"),
            "currentPrice": info.get("currentPrice") or info.get("regularMarketPrice"),
            "pe": info.get("trailingPE"),
            "pb": info.get("priceToBook"),
            "bookValue": info.get("bookValue"),
            "roce": info.get("returnOnAssets"), 
            "roe": info.get("returnOnEquity"),
            "debtToEquity": info.get("debtToEquity"),
            "high": info.get("dayHigh"),
            "low": info.get("dayLow"),
            "beta": info.get("beta"),
            "targetMeanPrice": info.get("targetMeanPrice"),
            "targetLowPrice": info.get("targetLowPrice"),
            "targetHighPrice": info.get("targetHighPrice"),
            "heldPercentInstitutions": info.get("heldPercentInstitutions")
        }
        set_cached_data(cache_key, summary)
        return summary
    except Exception as e:
        print(f"Error fetching summary for {ticker}: {e}")
        return {}

def get_stock_history_data(ticker: str, period: str = "5y") -> List[Dict[str, Any]]:
    cache_key = f"{ticker}_history_{period}"
    cached = get_cached_data(cache_key)
    if cached: return cached

    stock = get_ticker_obj(ticker)
    try:
        hist = stock.history(period=period)
        chart_data = []
        if not hist.empty:
            for date, row in hist.iterrows():
                chart_data.append({
                    "date": date.strftime("%Y-%m-%d"),
                    "open": row["Open"],
                    "high": row["High"],
                    "low": row["Low"],
                    "close": row["Close"],
                    "volume": row["Volume"]
                })
        set_cached_data(cache_key, chart_data)
        return chart_data
    except Exception as e:
        print(f"Error fetching history for {ticker}: {e}")
        return []

def get_financials_data(ticker: str) -> Dict[str, Any]:
    cache_key = f"{ticker}_financials"
    cached = get_cached_data(cache_key)
    if cached: return cached

    stock = get_ticker_obj(ticker)
    try:
        financials_df = stock.financials
        
        income_map = {
            "Total Revenue": "revenue",
            "Net Income": "netProfit",
            "Interest Expense": "interest",
            "Research And Development": "rnd",
            "Selling General And Administration": "sga",
            "Cost Of Revenue": "cogs",
            "Operating Income": "operating_profit",
            "Gross Profit": "gross_profit",
            "Basic EPS": "eps"
        }
        data = format_statement(financials_df, income_map)
        
        # Calculate PE History if possible (requires history, which is separate, but we can try small fetch or skip)
        # For speed, let's skip PE history in this call or do a lightweight version.
        # Ideally, PE history needs price at that time. 
        # We will fetch a lightweight history here just for PE calculation if not cached.
        
        set_cached_data(cache_key, data)
        return data
    except Exception as e:
        print(f"Error fetching financials for {ticker}: {e}")
        return []

def get_balance_sheet_data(ticker: str) -> List[Dict[str, Any]]:
    cache_key = f"{ticker}_balance"
    cached = get_cached_data(cache_key)
    if cached: return cached

    stock = get_ticker_obj(ticker)
    try:
        balance_df = stock.balance_sheet
        balance_map = {
            "Total Assets": "assets",
            "Total Liabilities Net Minority Interest": "liabilities",
            "Total Equity Gross Minority Interest": "equity",
            "Stockholders Equity": "equity",
            "Cash And Cash Equivalents": "cash",
            "Inventory": "inventory",
            "Net Debt": "debt",
            "Total Debt": "total_debt"
        }
        data = format_statement(balance_df, balance_map)
        # Fix debt
        for item in data:
            if item.get("debt") == 0 and item.get("total_debt", 0) != 0:
                item["debt"] = item["total_debt"]
        
        set_cached_data(cache_key, data)
        return data
    except Exception:
        return []

def get_cash_flow_data(ticker: str) -> List[Dict[str, Any]]:
    cache_key = f"{ticker}_cashflow"
    cached = get_cached_data(cache_key)
    if cached: return cached
    
    stock = get_ticker_obj(ticker)
    try:
        cash_df = stock.cashflow
        cash_map = {
            "Operating Cash Flow": "operating",
            "Investing Cash Flow": "investing",
            "Financing Cash Flow": "financing",
            "Free Cash Flow": "free_cash_flow",
            "Cash Dividends Paid": "dividend"
        }
        data = format_statement(cash_df, cash_map)
        set_cached_data(cache_key, data)
        return data
    except Exception:
        return []

def get_quarterly_data(ticker: str) -> List[Dict[str, Any]]:
    cache_key = f"{ticker}_quarterly"
    cached = get_cached_data(cache_key)
    if cached: return cached
    
    stock = get_ticker_obj(ticker)
    try:
        q_df = stock.quarterly_financials
        data = format_statement(q_df, {"Total Revenue": "revenue", "Net Income": "profit"}, count=5)
        set_cached_data(cache_key, data)
        return data
    except Exception:
        return []

def get_dividends_data(ticker: str) -> List[Dict[str, Any]]:
    cache_key = f"{ticker}_dividends"
    cached = get_cached_data(cache_key)
    if cached: return cached
    
    stock = get_ticker_obj(ticker)
    try:
        if hasattr(stock, 'dividends'):
            divs = stock.dividends
            if not divs.empty:
                div_hist = divs.sort_index(ascending=True).tail(20)
                data = [{"date": d.strftime("%Y-%m-%d"), "dividend": v} for d, v in div_hist.items()]
                set_cached_data(cache_key, data)
                return data
    except Exception:
        pass
    return []

def get_earnings_data(ticker: str) -> List[Dict[str, Any]]:
    cache_key = f"{ticker}_earnings"
    cached = get_cached_data(cache_key)
    if cached: return cached
    
    stock = get_ticker_obj(ticker)
    data = []
    try:
         if hasattr(stock, 'earnings_dates') and stock.earnings_dates is not None:
             ed = stock.earnings_dates.dropna()
             ed = ed.sort_index().tail(8)
             for date, row in ed.iterrows():
                 data.append({
                     "date": date.strftime("%Y-%m-%d"),
                     "estimated_eps": row.get("EPS Estimate", 0),
                     "actual_eps": row.get("Reported EPS", 0)
                 })
    except Exception:
        pass
    
    set_cached_data(cache_key, data)
    return data

# Wrapper for backward compatibility if needed, but we encourage splitting
def get_stock_details(ticker: str) -> Dict[str, Any]:
    # This is the monolithic function - we can keep it but use the cached sub-functions
    # However, to solve the timeout, the frontend MUST use the split endpoints.
    # We will reconstruct it here just in case, but it will still be slow if called directly.
    return {
        "financials": get_stock_summary(ticker),
        "chartData": get_stock_history_data(ticker),
        "incomeStatement": get_financials_data(ticker),
        "balanceSheet": get_balance_sheet_data(ticker),
        "cashFlow": get_cash_flow_data(ticker),
        "quarterly": get_quarterly_data(ticker),
        "dividends": get_dividends_data(ticker),
        "earnings": get_earnings_data(ticker)
    }

def generate_investment_thesis(ticker: str, analyst_notes: Optional[str] = None) -> Dict[str, Any]:
    """Generate AI-powered investment thesis using OpenAI GPT"""
    
    if not openai_client:
        raise Exception("OpenAI API key not configured")
    
    # Check cache first (30 minute cache for thesis)
    cache_key = f"{ticker}_thesis"
    cached = get_cached_data(cache_key)
    if cached:
        return cached
    
    try:
        # Import thesis module for data aggregation
        from .thesis import aggregate_stock_data
        
        # Aggregate all data using thesis module
        aggregated_data = aggregate_stock_data(ticker, analyst_notes)
        
        # Load prompt template
        import os
        prompt_template_path = os.path.join(os.path.dirname(__file__), "prompts", "thesis_prompt.txt")
        
        try:
            with open(prompt_template_path, "r") as f:
                prompt_template = f.read()
        except FileNotFoundError:
            # Fallback to inline prompt if template file not found
            prompt_template = """You are an equity research assistant helping an analyst write a concise, professional investment thesis for the stock {{ticker}}.

Use the following structured data:

FUNDAMENTALS:
{{fundamentals_json}}

TECHNICALS:
{{technicals_json}}

SENTIMENT:
{{sentiment_json}}

ANALYST_NOTES:
{{notes}}

Please produce a clear and actionable investment thesis in this format:

SUMMARY (2–3 sentences)

BULL CASE (Why it could outperform)

BEAR CASE (Why it could underperform)

BASE CASE (Most realistic expectation)

KEY RISKS (Bulleted list)

KEY CATALYSTS (Bulleted list)

FINAL RATING (Buy / Hold / Sell + 1-liner justification)

Tone:
- Analytical, concise, hedge-fund style
- No fluff
- Use data to support points
- Do not hallucinate numbers; only infer directionally

Respond ONLY with valid JSON in this exact format:
{
  "summary": "2-3 sentence summary here",
  "bullCase": "Bullish argument here",
  "bearCase": "Bearish argument here",
  "baseCase": "Most realistic scenario here",
  "risks": ["Risk 1", "Risk 2", "Risk 3", "Risk 4"],
  "catalysts": ["Catalyst 1", "Catalyst 2", "Catalyst 3", "Catalyst 4"],
  "rating": "Buy / Hold / Sell",
  "ratingJustification": "One-line justification"
}
"""
        
        # Helper function to convert non-serializable types
        def make_json_serializable(obj):
            """Convert numpy/pandas types and other non-serializable objects to native Python types"""
            try:
                import numpy as np
                HAS_NUMPY = True
            except ImportError:
                HAS_NUMPY = False
            
            try:
                import pandas as pd
                HAS_PANDAS = True
            except ImportError:
                HAS_PANDAS = False
            
            if isinstance(obj, dict):
                return {k: make_json_serializable(v) for k, v in obj.items()}
            elif isinstance(obj, list):
                return [make_json_serializable(item) for item in obj]
            elif HAS_NUMPY and isinstance(obj, (np.integer, np.floating)):
                return obj.item()
            elif HAS_NUMPY and isinstance(obj, np.bool_):
                return bool(obj)
            elif isinstance(obj, bool):
                return bool(obj)  # Ensure Python bool
            elif HAS_NUMPY and isinstance(obj, np.ndarray):
                return obj.tolist()
            elif HAS_PANDAS and isinstance(obj, (pd.Series, pd.DataFrame)):
                return obj.to_dict()
            elif obj is None:
                return None
            elif isinstance(obj, (int, float, str)):
                return obj
            else:
                # Try to convert to native Python type
                try:
                    if hasattr(obj, 'item'):
                        return obj.item()
                    elif hasattr(obj, 'tolist'):
                        return obj.tolist()
                except:
                    pass
                # Last resort: convert to string
                try:
                    return str(obj)
                except:
                    return None
        
        # Convert data to JSON-serializable format
        fundamentals_data = make_json_serializable(aggregated_data.get("fundamentals", {}))
        technicals_data = make_json_serializable(aggregated_data.get("technicals", {}))
        sentiment_data = make_json_serializable(aggregated_data.get("sentiment", {}))
        
        # Replace template placeholders
        prompt = prompt_template.replace("{{ticker}}", ticker)
        prompt = prompt.replace("{{fundamentals_json}}", json.dumps(fundamentals_data, indent=2, default=str))
        prompt = prompt.replace("{{technicals_json}}", json.dumps(technicals_data, indent=2, default=str))
        prompt = prompt.replace("{{sentiment_json}}", json.dumps(sentiment_data, indent=2, default=str))
        prompt = prompt.replace("{{notes}}", analyst_notes or "No analyst notes provided.")
        
        # Call OpenAI API
        response = openai_client.chat.completions.create(
            model="gpt-4o",  # Using latest GPT-4 model
            messages=[
                {"role": "system", "content": "You are an expert equity research analyst providing investment analysis. Always respond with valid JSON only."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=2000,
            response_format={"type": "json_object"}
        )
        
        # Parse response
        thesis_text = response.choices[0].message.content
        thesis_data = json.loads(thesis_text)
        
        # Validate and normalize response structure
        result = {
            "ticker": ticker,
            "generated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
            "summary": thesis_data.get("summary", ""),
            "bullCase": thesis_data.get("bullCase", thesis_data.get("bull_case", "")),
            "bearCase": thesis_data.get("bearCase", thesis_data.get("bear_case", "")),
            "baseCase": thesis_data.get("baseCase", thesis_data.get("base_case", "")),
            "risks": thesis_data.get("risks", []),
            "catalysts": thesis_data.get("catalysts", []),
            "rating": thesis_data.get("rating", "Hold"),
            "ratingJustification": thesis_data.get("ratingJustification", thesis_data.get("rating_justification", "")),
        }
        
        # Ensure risks and catalysts are arrays
        if not isinstance(result["risks"], list):
            result["risks"] = []
        if not isinstance(result["catalysts"], list):
            result["catalysts"] = []
        
        # Cache for 30 minutes
        CACHE[cache_key] = {
            "data": result,
            "expires": time.time() + 1800  # 30 minutes
        }
        
        return result
        
    except Exception as e:
        print(f"Error generating thesis for {ticker}: {e}")
        import traceback
        traceback.print_exc()
        raise Exception(f"Failed to generate investment thesis: {str(e)}")
