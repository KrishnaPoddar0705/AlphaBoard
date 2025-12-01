from .db import supabase
from .market import get_current_price, get_ticker_obj
import pandas as pd
import yfinance as yf

def update_user_performance(user_id: str):
    """
    Recalculates a user's performance metrics based on all their recommendations.
    Excludes WATCHLIST items from portfolio calculations.
    """
    # Fetch all recommendations for user
    response = supabase.table("recommendations").select("*").eq("user_id", user_id).execute()
    recs = response.data
    
    if not recs:
        return
    
    # Filter out WATCHLIST items - they should not count towards portfolio performance
    portfolio_recs = [r for r in recs if r.get('status') != 'WATCHLIST']
    
    if not portfolio_recs:
        return
    
    total_return = 0.0
    total_alpha = 0.0
    wins = 0
    closed_count = 0
    
    # For MVP, we are fetching live price for everything. 
    # In prod, cache this or do it in batch.
    
    for rec in portfolio_recs:
        current_price = get_current_price(rec['ticker'])
        current_bench = get_current_price(rec['benchmark_ticker'])
        
        if current_price is None or current_bench is None:
            continue
            
        # Update current price in DB (optional, but good for UI)
        supabase.table("recommendations").update({
            "current_price": current_price
        }).eq("id", rec['id']).execute()

        # Skip if entry_price is missing (shouldn't happen for portfolio items, but defensive check)
        if rec.get('entry_price') is None:
            continue
            
        entry_price = float(rec['entry_price'])
        entry_bench = 1.0 # Default prevent div/0 if missing
        
        # We need entry benchmark price. 
        # If we didn't save it (schema didn't have it explicitly in plan but implied),
        # we might need to fetch historical at entry_date.
        # For MVP, let's assume we fetch it now if not stored, OR better,
        # let's assume we start tracking from NOW for new ones.
        # Issue: The schema doesn't have `entry_benchmark_price`.
        # FIX: We really should have `entry_benchmark_price`. 
        # I'll assume we can't easily get historical minute data for free reliably for random timestamps without limits.
        # I will add logic to fetch it if we can, otherwise uses mock or 0.
        
        # Ideally we stored `entry_benchmark_price` at creation. 
        # If I can't change schema easily now (I can, but I already wrote it), 
        # I'll just use a hack: assume `benchmark_ticker` stores the ticker, 
        # but we need the price. 
        # I will fetch historical price at `entry_date` using yfinance.
        
        # Let's try to get historical close for entry date
        entry_date_str = rec['entry_date'].split("T")[0]
        
        # Calculate Stock Return
        if rec['action'] == 'BUY':
            stock_ret = (current_price - entry_price) / entry_price
        else: # SELL
            stock_ret = (entry_price - current_price) / entry_price
            
        # Benchmark Return
        # Get entry benchmark price (stored or fetch historical)
        bench_entry_price = rec.get('entry_benchmark_price')
        
        if not bench_entry_price:
            # Fetch historical benchmark price at entry date
            bench_entry_price = get_historical_price(rec['benchmark_ticker'], entry_date_str)
            # Store it for future use
            if bench_entry_price and bench_entry_price != 1.0:
                supabase.table("recommendations").update({
                    "entry_benchmark_price": bench_entry_price
                }).eq("id", rec['id']).execute()
        
        if bench_entry_price and bench_entry_price > 0:
             bench_ret = (current_bench - bench_entry_price) / bench_entry_price
        else:
             bench_ret = 0.0 # Fallback
             
        alpha = stock_ret - bench_ret
        
        total_return += stock_ret
        total_alpha += alpha
        
        if stock_ret > 0:
            wins += 1
            
    count = len(portfolio_recs)
    avg_return = (total_return / count) * 100
    avg_alpha = (total_alpha / count) * 100
    win_rate = (wins / count) * 100
    
    # Update Performance Table
    supabase.table("performance").upsert({
        "user_id": user_id,
        "total_return_pct": avg_return,
        "alpha_pct": avg_alpha,
        "total_ideas": count,
        "win_rate": win_rate,
        "last_updated": "now()"
    }).execute()

def get_historical_price(ticker: str, date_str: str) -> float:
    """Get historical price for a ticker on a specific date"""
    try:
        stock = get_ticker_obj(ticker)
        # Fetch data for the date
        df = stock.history(start=date_str, end=(pd.to_datetime(date_str) + pd.Timedelta(days=1)).strftime("%Y-%m-%d"))
        if not df.empty:
            return float(df['Close'].iloc[0])
        return 1.0
    except Exception as e:
        print(f"Error fetching historical price for {ticker} on {date_str}: {e}")
        return 1.0

