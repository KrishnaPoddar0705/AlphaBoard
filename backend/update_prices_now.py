#!/usr/bin/env python3
"""
Script to immediately update all current prices in the database.
This can be run manually or via cron.
Uses yfinance directly to avoid OpenAI dependency.
"""
import sys
import os
import requests
from dotenv import load_dotenv

# Add the app directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.db import supabase
import yfinance as yf
from typing import Optional
from datetime import datetime

# Load environment variables
load_dotenv()

# Get service role key for direct PostgREST calls
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_SERVICE_KEY", "")

def update_price_direct(rec_id: str, price: float) -> bool:
    """
    Update price directly using PostgREST API with service role key to bypass RLS.
    First tries using the database function, then falls back to direct update.
    Returns True if update was successful.
    """
    try:
        # Method 1: Use the database function (bypasses RLS with SECURITY DEFINER)
        function_url = f"{SUPABASE_URL}/rest/v1/rpc/update_recommendation_price"
        headers = {
            "apikey": SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        }
        function_data = {
            "rec_id": rec_id,
            "new_price": price
        }
        
        function_response = requests.post(
            function_url,
            json=function_data,
            headers=headers,
            timeout=10
        )
        
        if function_response.status_code in [200, 204]:
            # Verify the update
            verify_url = f"{SUPABASE_URL}/rest/v1/recommendations"
            verify_response = requests.get(
                f"{verify_url}?id=eq.{rec_id}&select=current_price",
                headers=headers,
                timeout=10
            )
            if verify_response.status_code == 200:
                verify_data = verify_response.json()
                if verify_data and len(verify_data) > 0:
                    db_price = float(verify_data[0].get('current_price', 0) or 0)
                    if abs(db_price - price) < 0.01:
                        return True
        
        # Method 2: Fallback to direct update (uses RLS policy)
        url = f"{SUPABASE_URL}/rest/v1/recommendations"
        data = {
            "current_price": price
        }
        
        response = requests.patch(
            f"{url}?id=eq.{rec_id}",
            json=data,
            headers=headers,
            timeout=10
        )
        
        if response.status_code in [200, 204]:
            # Verify the update
            verify_response = requests.get(
                f"{url}?id=eq.{rec_id}&select=current_price",
                headers=headers,
                timeout=10
            )
            if verify_response.status_code == 200:
                verify_data = verify_response.json()
                if verify_data and len(verify_data) > 0:
                    db_price = float(verify_data[0].get('current_price', 0) or 0)
                    return abs(db_price - price) < 0.01
        return False
    except Exception as e:
        print(f"    Direct update error for {rec_id[:8]}: {e}")
        return False

def get_current_price(ticker: str) -> Optional[float]:
    """
    Get current price for a ticker using yfinance.
    Works for both US and Indian stocks.
    Tries adding .NS suffix for Indian stocks if initial fetch fails.
    """
    # Try original ticker first
    price = _fetch_price_for_ticker(ticker)
    if price is not None:
        return price
    
    # If original fails and doesn't have .NS or .BO suffix, try adding .NS (for NSE stocks)
    if not ticker.endswith('.NS') and not ticker.endswith('.BO') and not '.' in ticker:
        ticker_with_suffix = f"{ticker}.NS"
        price = _fetch_price_for_ticker(ticker_with_suffix)
        if price is not None:
            return price
    
    return None

def _fetch_price_for_ticker(ticker: str) -> Optional[float]:
    """Helper function to fetch price for a specific ticker."""
    stock = yf.Ticker(ticker)
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
    except Exception:
        return None

def update_all_current_prices():
    """
    Update current_price for all OPEN and WATCHLIST recommendations.
    """
    try:
        print(f"[{datetime.now().isoformat()}] Starting price update for all recommendations...")
        
        # Get all unique tickers from OPEN and WATCHLIST recommendations
        open_recs = supabase.table("recommendations").select("ticker").eq("status", "OPEN").execute()
        watchlist_recs = supabase.table("recommendations").select("ticker").eq("status", "WATCHLIST").execute()
        
        all_recs = (open_recs.data or []) + (watchlist_recs.data or [])
        
        if not all_recs:
            print("No recommendations to update")
            return {"updated": 0, "errors": 0}
        
        # Get unique tickers
        unique_tickers = list(set([rec['ticker'] for rec in all_recs]))
        print(f"Found {len(unique_tickers)} unique tickers to update")
        print(f"Sample tickers: {unique_tickers[:5] if len(unique_tickers) > 5 else unique_tickers}")
        
        updated_count = 0
        error_count = 0
        
        # Update prices for each ticker
        for ticker in unique_tickers:
            try:
                price = get_current_price(ticker)
                if price is not None and price > 0:
                    try:
                        # First, check how many recommendations exist for this ticker
                        # Check for OPEN recommendations
                        open_check = supabase.table("recommendations").select("id").eq("ticker", ticker).eq("status", "OPEN").execute()
                        # Check for WATCHLIST recommendations  
                        watchlist_check = supabase.table("recommendations").select("id").eq("ticker", ticker).eq("status", "WATCHLIST").execute()
                        
                        total_to_update = len(open_check.data or []) + len(watchlist_check.data or [])
                        
                        if total_to_update == 0:
                            # Debug: check if ticker exists with any status
                            any_status = supabase.table("recommendations").select("id, status").eq("ticker", ticker).limit(5).execute()
                            if any_status.data:
                                statuses = [r['status'] for r in any_status.data]
                                print(f"  No OPEN/WATCHLIST recommendations found for {ticker} (found statuses: {set(statuses)})")
                            else:
                                print(f"  No recommendations found for ticker {ticker} at all")
                        else:
                            # Update records by individual ID to bypass RLS issues
                            open_updated = 0
                            open_ids = [r['id'] for r in (open_check.data or [])]
                            
                            for rec_id in open_ids:
                                # Try direct PostgREST API call first to bypass RLS
                                if update_price_direct(rec_id, price):
                                    open_updated += 1
                                else:
                                    # Fallback to Supabase client
                                    try:
                                        result = supabase.table("recommendations").update({
                                            "current_price": price
                                        }).eq("id", rec_id).execute()
                                        
                                        # Verify immediately
                                        verify = supabase.table("recommendations").select("current_price").eq("id", rec_id).execute()
                                        if verify.data and verify.data[0].get('current_price'):
                                            db_price = float(verify.data[0].get('current_price'))
                                            if abs(db_price - price) < 0.01:
                                                open_updated += 1
                                            else:
                                                print(f"  ⚠ Price mismatch for {rec_id[:8]}: expected {price}, got {db_price}")
                                        else:
                                            print(f"  ⚠ No data returned for {rec_id[:8]} after update")
                                    except Exception as e:
                                        print(f"  ✗ Error updating record {rec_id[:8]}: {e}")
                                        import traceback
                                        traceback.print_exc()
                            
                            watchlist_updated = 0
                            watchlist_ids = [r['id'] for r in (watchlist_check.data or [])]
                            
                            for rec_id in watchlist_ids:
                                # Try direct PostgREST API call first to bypass RLS
                                if update_price_direct(rec_id, price):
                                    watchlist_updated += 1
                                else:
                                    # Fallback to Supabase client
                                    try:
                                        result = supabase.table("recommendations").update({
                                            "current_price": price
                                        }).eq("id", rec_id).execute()
                                        
                                        # Verify immediately
                                        verify = supabase.table("recommendations").select("current_price").eq("id", rec_id).execute()
                                        if verify.data and verify.data[0].get('current_price'):
                                            db_price = float(verify.data[0].get('current_price'))
                                            if abs(db_price - price) < 0.01:
                                                watchlist_updated += 1
                                            else:
                                                print(f"  ⚠ Price mismatch for {rec_id[:8]}: expected {price}, got {db_price}")
                                        else:
                                            print(f"  ⚠ No data returned for {rec_id[:8]} after update")
                                    except Exception as e:
                                        print(f"  ✗ Error updating record {rec_id[:8]}: {e}")
                                        import traceback
                                        traceback.print_exc()
                            
                            total_updated = open_updated + watchlist_updated
                            if total_updated > 0:
                                updated_count += total_updated
                                print(f"✓ Updated {total_updated} recommendations for {ticker} with price {price} (OPEN: {open_updated}, WATCHLIST: {watchlist_updated})")
                            else:
                                print(f"⚠ No recommendations were updated for {ticker} despite finding {total_to_update} records")
                                # Debug: show what the current prices are
                                debug = supabase.table("recommendations").select("id, current_price, status").eq("ticker", ticker).limit(5).execute()
                                if debug.data:
                                    print(f"  Debug - Current prices in DB: {[(r.get('id')[:8] if r.get('id') else 'N/A', r.get('current_price'), r.get('status')) for r in debug.data]}")
                    except Exception as db_error:
                        print(f"✗ Database error updating {ticker}: {db_error}")
                        error_count += 1
                else:
                    print(f"✗ Could not fetch valid price for {ticker} (got: {price})")
                    error_count += 1
            except Exception as e:
                print(f"✗ Error fetching price for {ticker}: {e}")
                error_count += 1
                # Continue to next ticker even if this one fails
                continue
        
        print(f"[{datetime.now().isoformat()}] Price update completed. Updated: {updated_count}, Errors: {error_count}")
        return {"updated": updated_count, "errors": error_count, "tickers_processed": len(unique_tickers)}
    except Exception as e:
        print(f"Error in update_all_current_prices: {e}")
        import traceback
        traceback.print_exc()
        return {"updated": 0, "errors": 1, "error_message": str(e)}

if __name__ == "__main__":
    result = update_all_current_prices()
    print(f"\nFinal result: {result}")
    sys.exit(0 if result.get("errors", 0) == 0 else 1)

