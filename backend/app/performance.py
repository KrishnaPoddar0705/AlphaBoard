"""
Portfolio Performance Calculation Module
Calculates advanced metrics: Sharpe ratio, drawdown, returns, alpha, etc.
"""
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
import time
from .db import supabase
from .market import get_current_price, get_ticker_obj


def get_supabase_user_id(clerk_user_id: str) -> Optional[str]:
    """
    Convert Clerk user ID to Supabase UUID by looking up the mapping table.
    If the input is already a UUID, return it as-is.
    
    If mapping doesn't exist, tries to find a profile by checking if the Clerk ID
    matches any user_id in recommendations (legacy data issue).
    
    Args:
        clerk_user_id: Clerk user ID (e.g., 'user_36SrJ1Sdb2xpMdFzdxGJw4S5Dma') or UUID
        
    Returns:
        Supabase UUID string or None if not found
    """
    # Check if it's already a UUID format (36 chars with dashes)
    if len(clerk_user_id) == 36 and clerk_user_id.count('-') == 4:
        return clerk_user_id
    
    # Look up in clerk_user_mapping table
    try:
        # First try the direct query
        result = supabase.table("clerk_user_mapping") \
            .select("supabase_user_id") \
            .eq("clerk_user_id", clerk_user_id) \
            .limit(1) \
            .execute()
        
        # Check for errors first
        if hasattr(result, 'error') and result.error:
            print(f"Supabase query error: {result.error}")
            return None
        
        # Check if data exists
        if result.data and len(result.data) > 0:
            supabase_uuid = result.data[0].get("supabase_user_id")
            if supabase_uuid:
                return supabase_uuid
        
        # Fallback: Query all mappings and filter manually (in case eq() filter isn't working)
        print(f"Direct query returned no results, trying fallback query for Clerk ID: {clerk_user_id}")
        try:
            all_mappings = supabase.table("clerk_user_mapping") \
                .select("clerk_user_id, supabase_user_id") \
                .execute()
            
            if all_mappings.data:
                for mapping in all_mappings.data:
                    if mapping.get("clerk_user_id") == clerk_user_id:
                        supabase_uuid = mapping.get("supabase_user_id")
                        print(f"Found mapping via fallback query: {supabase_uuid}")
                        return supabase_uuid
        except Exception as fallback_error:
            print(f"Fallback query also failed: {fallback_error}")
        
        # If no data found, the mapping doesn't exist
        print(f"Warning: No clerk_user_mapping found for Clerk ID: {clerk_user_id}")
        return None
        
    except Exception as e:
        print(f"Error looking up Supabase UUID for Clerk ID {clerk_user_id}: {e}")
        import traceback
        traceback.print_exc()
        return None


def get_historical_price_data(ticker: str, start_date: str, end_date: str) -> pd.DataFrame:
    """Fetch historical price data for a ticker"""
    try:
        stock = get_ticker_obj(ticker)
        df = stock.history(start=start_date, end=end_date)
        if df.empty:
            return pd.DataFrame()
        return df[['Close']]
    except Exception as e:
        print(f"Error fetching historical data for {ticker}: {e}")
        return pd.DataFrame()


def calculate_daily_portfolio_value(user_id: str, date: datetime) -> Tuple[float, float]:
    """
    Calculate portfolio value and benchmark value for a specific date.
    Returns: (portfolio_value, benchmark_value)
    Uses cached current prices to avoid excessive API calls.
    """
    # Convert Clerk user ID to Supabase UUID if needed
    supabase_user_id = get_supabase_user_id(user_id)
    if not supabase_user_id:
        print(f"Error: Could not find Supabase UUID for user_id: {user_id}")
        return (0.0, 0.0)
    
    # Fetch all OPEN recommendations as of this date
    try:
        response = supabase.table("recommendations").select("*").eq("user_id", supabase_user_id).eq("status", "OPEN").lte("entry_date", date.isoformat()).execute()
        open_recs = response.data if response.data else []
    except Exception as e:
        print(f"Error fetching recommendations: {e}")
        return (0.0, 0.0)
    
    if not open_recs:
        return (0.0, 0.0)
    
    portfolio_value = 0.0
    benchmark_ticker = "^NSEI"  # Default benchmark
    
    # Get historical prices for the date (with timeout protection)
    date_str = date.strftime("%Y-%m-%d")
    
    for rec in open_recs:
        ticker = rec['ticker']
        entry_price = rec.get('entry_price') or 0
        invested_amount = rec.get('invested_amount') or 0
        
        if not entry_price or not invested_amount:
            continue
        
        # Use current_price as fallback (faster than historical fetch)
        price = rec.get('current_price') or entry_price
        
        # Only fetch historical if we really need it (for past dates)
        if date.date() < datetime.now().date():
            try:
                df = get_historical_price_data(ticker, date_str, (date + timedelta(days=1)).strftime("%Y-%m-%d"))
                if not df.empty:
                    price = float(df['Close'].iloc[-1])
            except:
                pass  # Use fallback price
        
        # Calculate position value using invested_amount
        # Position value = invested_amount × (current_price / entry_price)
        if entry_price > 0:
            position_value = float(invested_amount) * (float(price) / float(entry_price))
            portfolio_value += position_value
    
    # Calculate benchmark value (use cached or default)
    benchmark_value = 100.0
    if date.date() < datetime.now().date():
        try:
            df = get_historical_price_data(benchmark_ticker, date_str, (date + timedelta(days=1)).strftime("%Y-%m-%d"))
            if not df.empty:
                benchmark_value = float(df['Close'].iloc[-1])
        except:
            pass
    
    return (portfolio_value, benchmark_value)


def compute_daily_returns(user_id: str, start_date: datetime, end_date: datetime) -> pd.DataFrame:
    """Calculate daily portfolio returns with timeout protection"""
    # Ensure dates are timezone-naive for pd.date_range
    if start_date.tzinfo is not None:
        start_date = start_date.replace(tzinfo=None)
    if end_date.tzinfo is not None:
        end_date = end_date.replace(tzinfo=None)
    
    # Limit date range to avoid excessive calculations (max 2 years)
    max_days = 730
    if (end_date - start_date).days > max_days:
        start_date = end_date - timedelta(days=max_days)
    
    dates = pd.date_range(start=start_date, end=end_date, freq='D')
    returns_data = []
    
    prev_portfolio_value = None
    prev_benchmark_value = None
    
    start_time = time.time()
    max_execution_time = 30  # Max 30 seconds
    
    for date in dates:
        # Check timeout
        if time.time() - start_time > max_execution_time:
            print(f"Timeout in compute_daily_returns for user {user_id}")
            break
        
        # Convert pandas Timestamp to datetime
        if hasattr(date, 'to_pydatetime'):
            date_dt = date.to_pydatetime()
        else:
            date_dt = date
        portfolio_value, benchmark_value = calculate_daily_portfolio_value(user_id, date_dt)
        
        if prev_portfolio_value is not None and prev_portfolio_value > 0:
            daily_return = (portfolio_value / prev_portfolio_value) - 1
            benchmark_return = (benchmark_value / prev_benchmark_value) - 1 if prev_benchmark_value else 0
        else:
            daily_return = 0.0
            benchmark_return = 0.0
        
        returns_data.append({
            'date': date.date(),
            'daily_return': daily_return,
            'portfolio_value': portfolio_value,
            'benchmark_return': benchmark_return,
            'benchmark_value': benchmark_value
        })
        
        prev_portfolio_value = portfolio_value
        prev_benchmark_value = benchmark_value
    
    return pd.DataFrame(returns_data)


def compute_sharpe_ratio(returns: pd.Series, risk_free_rate: float = 0.05, periods_per_year: int = 252) -> float:
    """
    Calculate annualized Sharpe ratio
    Sharpe = (PortfolioReturn - RiskFreeRate) / StdDev(Returns)
    """
    if len(returns) < 2:
        return 0.0
    
    excess_returns = returns - (risk_free_rate / periods_per_year)
    
    if excess_returns.std() == 0:
        return 0.0
    
    sharpe = (excess_returns.mean() * periods_per_year) / (excess_returns.std() * np.sqrt(periods_per_year))
    return float(sharpe)


def compute_drawdown(portfolio_values: pd.Series) -> float:
    """Calculate maximum peak-to-trough drawdown"""
    if len(portfolio_values) < 2:
        return 0.0
    
    cumulative = (1 + portfolio_values).cumprod()
    running_max = cumulative.cummax()
    drawdown = (cumulative - running_max) / running_max
    max_drawdown = abs(drawdown.min())
    
    return float(max_drawdown * 100)  # Return as percentage


def compute_monthly_returns_matrix(user_id: str) -> List[Dict]:
    """Compute monthly returns matrix for 2020-2025"""
    # Convert Clerk user ID to Supabase UUID if needed
    supabase_user_id = get_supabase_user_id(user_id)
    if not supabase_user_id:
        print(f"Error: Could not find Supabase UUID for user_id: {user_id}")
        return []
    
    # Fetch all recommendations
    response = supabase.table("recommendations").select("*").eq("user_id", supabase_user_id).execute()
    recs = response.data if response.data else []
    
    if not recs:
        return []
    
    # Get date range from first recommendation
    first_date = min([datetime.fromisoformat(r['entry_date'].replace('Z', '+00:00')).date() for r in recs if r.get('entry_date')])
    start_year = min(first_date.year, 2020)
    end_year = 2025
    
    monthly_returns = []
    
    for year in range(start_year, end_year + 1):
        for month in range(1, 13):
            # Use timezone-naive datetime
            month_start = datetime(year, month, 1)
            if month == 12:
                month_end = datetime(year + 1, 1, 1)
            else:
                month_end = datetime(year, month + 1, 1)
            
            # Calculate portfolio value at start and end of month
            start_value, _ = calculate_daily_portfolio_value(user_id, month_start)
            end_value, _ = calculate_daily_portfolio_value(user_id, month_end)
            
            if start_value > 0:
                monthly_return = ((end_value - start_value) / start_value) * 100
            else:
                monthly_return = 0.0
            
            monthly_returns.append({
                'year': year,
                'month': month,
                'return_pct': monthly_return
            })
    
    return monthly_returns


def compute_yearly_returns(user_id: str) -> List[Dict]:
    """Compute yearly returns array"""
    monthly_matrix = compute_monthly_returns_matrix(user_id)
    
    yearly_returns = {}
    for entry in monthly_matrix:
        year = entry['year']
        if year not in yearly_returns:
            yearly_returns[year] = []
        yearly_returns[year].append(entry['return_pct'])
    
    result = []
    for year in sorted(yearly_returns.keys()):
        monthly_returns = yearly_returns[year]
        # Compound monthly returns to get yearly return
        yearly_return = 100 * ((np.prod([1 + r/100 for r in monthly_returns]) - 1))
        result.append({
            'year': year,
            'return_pct': yearly_return
        })
    
    return result


def compute_win_rate(recommendations: List[Dict]) -> float:
    """Calculate win rate (% of profitable trades)"""
    if not recommendations:
        return 0.0
    
    profitable = 0
    total = 0
    
    for rec in recommendations:
        if rec.get('status') == 'WATCHLIST':
            continue
        
        entry_price = rec.get('entry_price')
        if not entry_price:
            continue
        
        exit_price = rec.get('exit_price') if rec.get('status') == 'CLOSED' else rec.get('current_price')
        if not exit_price:
            continue
        
        # Calculate return
        if rec.get('action') == 'BUY':
            ret = (exit_price - entry_price) / entry_price
        else:  # SELL
            ret = (entry_price - exit_price) / entry_price
        
        if ret > 0:
            profitable += 1
        total += 1
    
    return (profitable / total * 100) if total > 0 else 0.0


def compute_portfolio_allocation(user_id: str) -> List[Dict]:
    """Calculate current portfolio allocation using invested_amount"""
    try:
        # Convert Clerk user ID to Supabase UUID if needed
        supabase_user_id = get_supabase_user_id(user_id)
        if not supabase_user_id:
            print(f"Error: Could not find Supabase UUID for user_id: {user_id}")
            print(f"User needs to be synced. Please ensure the sync-clerk-user Edge Function has been called.")
            # Try direct query with Clerk ID as fallback (in case data was stored incorrectly)
            try:
                response = supabase.table("recommendations").select("*").eq("user_id", user_id).eq("status", "OPEN").execute()
                if response.data:
                    print(f"Warning: Found recommendations with Clerk ID directly. This indicates data inconsistency.")
                    print(f"Recommendations should be stored with Supabase UUIDs, not Clerk IDs.")
            except Exception as fallback_error:
                print(f"Fallback query also failed: {fallback_error}")
            return []
        
        response = supabase.table("recommendations").select("*").eq("user_id", supabase_user_id).eq("status", "OPEN").execute()
        open_recs = response.data if response.data else []
        
        if not open_recs:
            return []
        
        # Calculate total invested and current value
        total_invested = 0.0
        total_current_value = 0.0
        position_data = {}
        
        for rec in open_recs:
            ticker = rec['ticker']
            entry_price = float(rec.get('entry_price') or 0)
            invested_amount = float(rec.get('invested_amount') or 0)
            current_price = float(rec.get('current_price') or entry_price)
            
            if not entry_price or not invested_amount:
                continue
            
            # Current value = invested_amount × (current_price / entry_price)
            current_value = invested_amount * (current_price / entry_price)
            
            if ticker not in position_data:
                position_data[ticker] = {
                    'invested_amount': 0,
                    'current_value': 0
                }
            
            position_data[ticker]['invested_amount'] += invested_amount
            position_data[ticker]['current_value'] += current_value
            total_invested += invested_amount
            total_current_value += current_value
        
        if total_invested == 0:
            return []
        
        # Calculate weights based on current values (not invested amounts)
        allocation = []
        for ticker, data in position_data.items():
            # Weight based on current value
            weight_pct = (data['current_value'] / total_current_value) * 100 if total_current_value > 0 else 0
            allocation.append({
                'ticker': ticker,
                'weight_pct': weight_pct,
                'value': data['current_value'],
                'invested_amount': data['invested_amount']
            })
        
        return sorted(allocation, key=lambda x: x['value'], reverse=True)
    except Exception as e:
        print(f"Error computing portfolio allocation: {e}")
        import traceback
        traceback.print_exc()
        return []


def compute_trade_pnl(recommendations: List[Dict]) -> List[Dict]:
    """Calculate individual trade P&L"""
    trades = []
    
    for rec in recommendations:
        if rec.get('status') == 'WATCHLIST':
            continue
        
        entry_price = rec.get('entry_price')
        if not entry_price:
            continue
        
        exit_price = rec.get('exit_price') if rec.get('status') == 'CLOSED' else rec.get('current_price')
        if not exit_price:
            continue
        
        position_size = rec.get('position_size') or 1.0
        
        # Calculate return
        if rec.get('action') == 'BUY':
            ret_pct = ((exit_price - entry_price) / entry_price) * 100
        else:  # SELL
            ret_pct = ((entry_price - exit_price) / entry_price) * 100
        
        pnl = (exit_price - entry_price) * position_size * (1 if rec.get('action') == 'BUY' else -1)
        
        trades.append({
            'ticker': rec['ticker'],
            'entry_date': rec.get('entry_date'),
            'exit_date': rec.get('exit_date'),
            'entry_price': entry_price,
            'exit_price': exit_price,
            'return_pct': ret_pct,
            'pnl': pnl,
            'action': rec.get('action')
        })
    
    return sorted(trades, key=lambda x: x.get('return_pct', 0), reverse=True)


def compute_volatility_risk_score(user_id: str, days: int = 7) -> float:
    """
    Calculate average risk score based on historical volatility over last N days
    Returns a score from 1-10
    """
    # Use timezone-naive datetime
    end_date = datetime.now().replace(tzinfo=None) if datetime.now().tzinfo else datetime.now()
    start_date = end_date - timedelta(days=days + 5)  # Extra days for calculation
    
    # Get daily returns
    returns_df = compute_daily_returns(user_id, start_date, end_date)
    
    if len(returns_df) < 2:
        return 5.0  # Neutral risk score
    
    # Calculate volatility (standard deviation of returns)
    volatility = returns_df['daily_return'].std()
    
    # Scale to 1-10 risk score
    # Assuming volatility ranges from 0 to 0.1 (10% daily volatility is very high)
    max_volatility = 0.1
    risk_score = min(10.0, max(1.0, (volatility / max_volatility) * 10))
    
    return float(risk_score)


def compute_profitable_weeks(user_id: str) -> float:
    """Calculate % of weeks with positive returns"""
    # Convert Clerk user ID to Supabase UUID if needed
    supabase_user_id = get_supabase_user_id(user_id)
    if not supabase_user_id:
        print(f"Error: Could not find Supabase UUID for user_id: {user_id}")
        return 0.0
    
    # Get date range from first recommendation
    response = supabase.table("recommendations").select("entry_date").eq("user_id", supabase_user_id).order("entry_date", desc=False).limit(1).execute()
    
    if not response.data:
        return 0.0
    
    first_date = datetime.fromisoformat(response.data[0]['entry_date'].replace('Z', '+00:00'))
    # Make timezone-naive
    if first_date.tzinfo:
        first_date = first_date.replace(tzinfo=None)
    start_date = first_date
    end_date = datetime.now().replace(tzinfo=None) if datetime.now().tzinfo else datetime.now()
    
    # Get daily returns
    returns_df = compute_daily_returns(user_id, start_date, end_date)
    
    if len(returns_df) < 7:
        return 0.0
    
    # Group by week and calculate weekly returns
    returns_df['date'] = pd.to_datetime(returns_df['date'])
    returns_df['week'] = returns_df['date'].dt.to_period('W')
    
    weekly_returns = returns_df.groupby('week')['daily_return'].apply(lambda x: (1 + x).prod() - 1)
    
    profitable_weeks = (weekly_returns > 0).sum()
    total_weeks = len(weekly_returns)
    
    return (profitable_weeks / total_weeks * 100) if total_weeks > 0 else 0.0


def get_cached_performance_summary(user_id: str) -> Optional[Dict]:
    """Get cached performance summary from database - currently disabled"""
    # The performance_summary_cache table doesn't exist yet
    # Using direct performance table queries instead
    return None


def get_cached_monthly_returns(user_id: str) -> List[Dict]:
    """Get cached monthly returns from database"""
    try:
        # Convert Clerk user ID to Supabase UUID if needed
        supabase_user_id = get_supabase_user_id(user_id)
        if not supabase_user_id:
            print(f"Error: Could not find Supabase UUID for user_id: {user_id}")
            return []
        
        res = supabase.table("monthly_returns_matrix").select("*").eq("user_id", supabase_user_id).order("year", desc=False).order("month", desc=False).execute()
        if res.data:
            return res.data
    except Exception as e:
        print(f"Error fetching cached monthly returns: {e}")
    return []


def get_cached_yearly_returns(user_id: str) -> List[Dict]:
    """Get cached yearly returns from monthly data"""
    monthly_data = get_cached_monthly_returns(user_id)
    if not monthly_data:
        return []
    
    yearly_returns = {}
    for entry in monthly_data:
        year = entry['year']
        if year not in yearly_returns:
            yearly_returns[year] = []
        yearly_returns[year].append(entry.get('return_pct', 0))
    
    result = []
    for year in sorted(yearly_returns.keys()):
        monthly_returns = yearly_returns[year]
        # Compound monthly returns to get yearly return
        yearly_return = 100 * ((np.prod([1 + r/100 for r in monthly_returns]) - 1))
        result.append({
            'year': year,
            'return_pct': yearly_return
        })
    
    return result


def get_cached_performance_data(user_id: str) -> Optional[Dict]:
    """Get all cached performance data"""
    summary = get_cached_performance_summary(user_id)
    monthly_returns = get_cached_monthly_returns(user_id)
    yearly_returns = get_cached_yearly_returns(user_id)
    portfolio_breakdown = compute_portfolio_allocation(user_id)  # This is fast, no need to cache
    
    if not summary:
        return None
    
    # Get trade P&L from recommendations (fast operation)
    try:
        # Convert Clerk user ID to Supabase UUID if needed
        supabase_user_id = get_supabase_user_id(user_id)
        if not supabase_user_id:
            print(f"Error: Could not find Supabase UUID for user_id: {user_id}")
            best_trades = []
            worst_trades = []
        else:
            response = supabase.table("recommendations").select("*").eq("user_id", supabase_user_id).execute()
            recs = response.data if response.data else []
            portfolio_recs = [r for r in recs if r.get('status') != 'WATCHLIST']
            trades = compute_trade_pnl(portfolio_recs)
            best_trades = trades[:10] if len(trades) > 10 else trades
            worst_trades = sorted(trades, key=lambda x: x.get('return_pct', 0))[:10]
    except:
        best_trades = []
        worst_trades = []
    
    return {
        'summary_metrics': {
            'total_return_pct': summary.get('total_return_pct', 0),
            'alpha_pct': summary.get('alpha_pct', 0),
            'sharpe_ratio': summary.get('sharpe_ratio', 0),
            'max_drawdown_pct': summary.get('max_drawdown_pct', 0),
            'win_rate': summary.get('win_rate', 0),
            'avg_risk_score': summary.get('avg_risk_score', 0),
            'profitable_weeks_pct': summary.get('profitable_weeks_pct', 0),
            'total_trades': summary.get('total_trades', 0),
            'median_holding_period_days': summary.get('median_holding_period_days', 0)
        },
        'monthly_returns': monthly_returns,
        'yearly_returns': yearly_returns,
        'portfolio_breakdown': portfolio_breakdown,
        'best_trades': best_trades,
        'worst_trades': worst_trades
    }


def validate_and_rebalance_weights(user_id: str, new_weight: float) -> Dict:
    """
    Validate that adding a new weight will keep total at 100%.
    Returns: {'valid': bool, 'error': str}
    """
    try:
        # Convert Clerk user ID to Supabase UUID if needed
        supabase_user_id = get_supabase_user_id(user_id)
        if not supabase_user_id:
            print(f"Error: Could not find Supabase UUID for user_id: {user_id}")
            return 0.0
        
        response = supabase.table("recommendations").select("weight_pct").eq("user_id", supabase_user_id).eq("status", "OPEN").execute()
        open_recs = response.data if response.data else []
        
        total_weight = sum(rec.get('weight_pct', 0) or 0 for rec in open_recs)
        new_total = total_weight + new_weight
        
        if abs(new_total - 100) > 0.01:
            return {
                'valid': False,
                'error': f'Portfolio weights must sum to 100%. Current total would be {new_total:.2f}%'
            }
        
        return {'valid': True, 'error': None}
    except Exception as e:
        return {'valid': False, 'error': f'Error validating weights: {str(e)}'}


def rebalance_portfolio_weights(user_id: str):
    """
    Rebalance portfolio weights using portfolio balance (equal money amounts).
    - If weight_pct is provided, use it
    - If weight_pct is null, calculate equal weight
    - Calculate invested_amount and position_size based on available balance
    """
    try:
        from .portfolio import get_portfolio_balance, calculate_position_size, update_portfolio_balance
        
        # Get portfolio balance
        balance = get_portfolio_balance(user_id)
        available_balance = float(balance.get('available_cash', 1000000))
        
        # Convert Clerk user ID to Supabase UUID if needed
        supabase_user_id = get_supabase_user_id(user_id)
        if not supabase_user_id:
            print(f"Error: Could not find Supabase UUID for user_id: {user_id}")
            return []
        
        response = supabase.table("recommendations").select("*").eq("user_id", supabase_user_id).eq("status", "OPEN").execute()
        open_recs = response.data if response.data else []
        
        if not open_recs:
            return
        
        # Check if any positions have explicit weights
        has_explicit_weights = any(rec.get('weight_pct') is not None for rec in open_recs)
        
        if has_explicit_weights:
            # Use explicit weights, ensure they sum to 100%
            total_weight = sum(rec.get('weight_pct', 0) or 0 for rec in open_recs)
            
            if abs(total_weight - 100) > 0.01:
                # Weights don't sum to 100%, normalize them
                for rec in open_recs:
                    weight = rec.get('weight_pct', 0) or 0
                    if weight > 0:
                        normalized_weight = (weight / total_weight) * 100
                        entry_price = float(rec.get('entry_price') or 0)
                        if entry_price > 0:
                            invested_amount, position_size = calculate_position_size(normalized_weight, entry_price, available_balance)
                            
                            supabase.table("recommendations").update({
                                "weight_pct": normalized_weight,
                                "invested_amount": invested_amount,
                                "position_size": position_size
                            }).eq("id", rec['id']).execute()
            else:
                # Weights sum to 100%, calculate invested_amount and position_size
                for rec in open_recs:
                    weight = rec.get('weight_pct', 0) or 0
                    entry_price = float(rec.get('entry_price') or 0)
                    if weight > 0 and entry_price > 0:
                        invested_amount, position_size = calculate_position_size(weight, entry_price, available_balance)
                        supabase.table("recommendations").update({
                            "invested_amount": invested_amount,
                            "position_size": position_size
                        }).eq("id", rec['id']).execute()
        else:
            # No explicit weights, use equal weight
            equal_weight = 100.0 / len(open_recs)
            
            for rec in open_recs:
                entry_price = float(rec.get('entry_price') or 0)
                if entry_price > 0:
                    invested_amount, position_size = calculate_position_size(equal_weight, entry_price, available_balance)
                    supabase.table("recommendations").update({
                        "weight_pct": equal_weight,
                        "invested_amount": invested_amount,
                        "position_size": position_size
                    }).eq("id", rec['id']).execute()
                else:
                    supabase.table("recommendations").update({
                        "weight_pct": equal_weight,
                        "invested_amount": 0,
                        "position_size": None
                    }).eq("id", rec['id']).execute()
        
        # Update portfolio balance after rebalancing
        update_portfolio_balance(user_id)
    except Exception as e:
        print(f"Error rebalancing portfolio weights: {e}")


def rebalance_equal_weights(user_id: str):
    """
    Legacy function - kept for backward compatibility.
    Recalculate equal weights when new positions are added.
    Sets position_size to null for all OPEN positions (equal weight assumed).
    """
    rebalance_portfolio_weights(user_id)


def calculate_comprehensive_performance(user_id: str) -> Dict:
    """
    Calculate all performance metrics and cache them.
    Returns comprehensive performance data.
    """
    # Convert Clerk user ID to Supabase UUID if needed
    supabase_user_id = get_supabase_user_id(user_id)
    if not supabase_user_id:
        print(f"Error: Could not find Supabase UUID for user_id: {user_id}")
        return {
            "summary_metrics": {},
            "monthly_returns": [],
            "yearly_returns": [],
            "portfolio_breakdown": [],
            "best_trades": [],
            "worst_trades": []
        }
    
    # Fetch all recommendations
    response = supabase.table("recommendations").select("*").eq("user_id", supabase_user_id).execute()
    recs = response.data if response.data else []
    
    if not recs:
        return {
            'summary_metrics': {},
            'monthly_returns': [],
            'yearly_returns': [],
            'portfolio_breakdown': [],
            'best_trades': [],
            'worst_trades': []
        }
    
    # Filter out WATCHLIST items
    portfolio_recs = [r for r in recs if r.get('status') != 'WATCHLIST']
    
    # Get date range
    first_date = min([datetime.fromisoformat(r['entry_date'].replace('Z', '+00:00')) for r in portfolio_recs if r.get('entry_date')])
    # Make timezone-naive
    if first_date.tzinfo:
        first_date = first_date.replace(tzinfo=None)
    end_date = datetime.now().replace(tzinfo=None) if datetime.now().tzinfo else datetime.now()
    
    # Calculate daily returns
    returns_df = compute_daily_returns(user_id, first_date, end_date)
    
    # Calculate metrics
    daily_returns_series = returns_df['daily_return']
    portfolio_values_series = returns_df['portfolio_value']
    
    sharpe = compute_sharpe_ratio(daily_returns_series)
    max_drawdown = compute_drawdown(daily_returns_series)
    win_rate = compute_win_rate(portfolio_recs)
    risk_score = compute_volatility_risk_score(user_id, days=7)
    profitable_weeks_pct = compute_profitable_weeks(user_id)
    
    # Calculate total return
    if len(portfolio_values_series) > 0 and portfolio_values_series.iloc[0] > 0:
        total_return = ((portfolio_values_series.iloc[-1] / portfolio_values_series.iloc[0]) - 1) * 100
    else:
        total_return = 0.0
    
    # Calculate alpha (simplified - portfolio return vs benchmark)
    benchmark_returns = returns_df['benchmark_return']
    if len(benchmark_returns) > 0:
        benchmark_total_return = ((1 + benchmark_returns).prod() - 1) * 100
        alpha = total_return - benchmark_total_return
    else:
        alpha = 0.0
    
    # Get monthly and yearly returns
    monthly_returns = compute_monthly_returns_matrix(user_id)
    yearly_returns = compute_yearly_returns(user_id)
    
    # Get portfolio allocation
    portfolio_breakdown = compute_portfolio_allocation(user_id)
    
    # Get trade P&L
    trades = compute_trade_pnl(portfolio_recs)
    best_trades = trades[:10] if len(trades) > 10 else trades
    worst_trades = sorted(trades, key=lambda x: x.get('return_pct', 0))[:10]
    
    # Calculate median holding period
    holding_periods = []
    for rec in portfolio_recs:
        if rec.get('exit_date'):
            entry = datetime.fromisoformat(rec['entry_date'].replace('Z', '+00:00'))
            exit = datetime.fromisoformat(rec['exit_date'].replace('Z', '+00:00'))
            # Make timezone-naive for calculation
            if entry.tzinfo:
                entry = entry.replace(tzinfo=None)
            if exit.tzinfo:
                exit = exit.replace(tzinfo=None)
            holding_periods.append((exit - entry).days)
    
    median_holding_period = float(np.median(holding_periods)) if holding_periods else 0.0
    
    summary_metrics = {
        'total_return_pct': total_return,
        'alpha_pct': alpha,
        'sharpe_ratio': sharpe,
        'max_drawdown_pct': max_drawdown,
        'win_rate': win_rate,
        'avg_risk_score': risk_score,
        'profitable_weeks_pct': profitable_weeks_pct,
        'total_trades': len(portfolio_recs),
        'median_holding_period_days': median_holding_period
    }
    
    # Cache the results - Disabled as cache tables don't exist yet
    # TODO: Create cache tables for better performance when querying historical data
    # - performance_summary_cache
    # - monthly_returns_matrix  
    # - performance_metrics_cache
    pass
    
    return {
        'summary_metrics': summary_metrics,
        'monthly_returns': monthly_returns,
        'yearly_returns': yearly_returns,
        'portfolio_breakdown': portfolio_breakdown,
        'best_trades': best_trades,
        'worst_trades': worst_trades
    }

