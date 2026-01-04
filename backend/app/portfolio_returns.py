"""
Portfolio Rolling Returns Calculation

Pure compute functions for calculating rolling portfolio returns.
- Daily portfolio return series from entry_date forward
- Rolling 7-day and 30-day compounded returns
- Equal-weight portfolio (all active stocks)
"""

from typing import List, Dict, Optional, Tuple
from datetime import datetime, timedelta
import pandas as pd
from collections import defaultdict
import yfinance as yf

# Cache for historical prices to avoid repeated API calls
_price_cache: Dict[str, Dict[str, List[Dict[str, any]]]] = {}
_cache_timestamps: Dict[str, datetime] = {}
CACHE_TTL_SECONDS = 300  # 5 minutes cache


def get_trading_days(start_date: datetime, end_date: datetime) -> List[datetime]:
    """
    Get list of trading days (excludes weekends).
    For simplicity, we exclude weekends. In production, you might want to
    exclude market holidays too (requires market calendar).
    
    Args:
        start_date: Start date (inclusive) - should be naive datetime
        end_date: End date (inclusive) - should be naive datetime
    
    Returns:
        List of naive datetime objects for trading days
    """
    # Ensure both dates are naive for comparison
    start_naive = start_date.replace(tzinfo=None) if start_date.tzinfo else start_date
    end_naive = end_date.replace(tzinfo=None) if end_date.tzinfo else end_date
    
    trading_days = []
    current = start_naive.replace(hour=0, minute=0, second=0, microsecond=0)
    end = end_naive.replace(hour=23, minute=59, second=59, microsecond=999999)
    
    while current <= end:
        # Exclude weekends (Saturday=5, Sunday=6)
        if current.weekday() < 5:
            trading_days.append(current)
        current += timedelta(days=1)
    
    return trading_days


def fetch_historical_prices_batch(
    tickers: List[str],
    start_date: datetime,
    end_date: datetime
) -> Dict[str, List[Dict[str, any]]]:
    """
    Fetch historical daily close prices for multiple tickers.
    Uses caching to avoid repeated API calls.
    
    Args:
        tickers: List of ticker symbols
        start_date: Start date for historical data
        end_date: End date for historical data
    
    Returns:
        Dictionary mapping ticker -> list of {date: datetime, close: float}
    """
    from datetime import datetime as dt
    
    # Validate dates - don't fetch future dates
    now = dt.now().replace(tzinfo=None) if dt.now().tzinfo else dt.now()
    if end_date > now:
        print(f"Warning: end_date {end_date} is in the future, clamping to {now}")
        end_date = now
    if start_date > end_date:
        print(f"Warning: start_date {start_date} is after end_date {end_date}, returning empty")
        return {ticker: [] for ticker in tickers}
    
    prices = {}
    cache_key_base = f"{start_date.strftime('%Y-%m-%d')}_{end_date.strftime('%Y-%m-%d')}"
    
    # Check cache first
    uncached_tickers = []
    for ticker in tickers:
        cache_key = f"{ticker}_{cache_key_base}"
        if cache_key in _price_cache:
            cache_time = _cache_timestamps.get(cache_key)
            if cache_time and (now - cache_time).total_seconds() < CACHE_TTL_SECONDS:
                prices[ticker] = _price_cache[cache_key]
                continue
        uncached_tickers.append(ticker)
    
    # Only fetch uncached tickers
    if not uncached_tickers:
        return prices
    
    # Use batch download for better performance
    try:
        # yfinance batch download is more efficient
        ticker_str = ' '.join(uncached_tickers)
        hist_batch = yf.download(
            ticker_str,
            start=start_date.strftime('%Y-%m-%d'),
            end=(end_date + timedelta(days=1)).strftime('%Y-%m-%d'),
            progress=False,
            group_by='ticker',
            threads=True
        )
        
        # Process batch results
        for ticker in uncached_tickers:
            try:
                if hist_batch.empty:
                    prices[ticker] = []
                    continue
                
                # Handle MultiIndex columns (multiple tickers)
                if isinstance(hist_batch.columns, pd.MultiIndex):
                    if ticker in hist_batch.columns.levels[0]:
                        ticker_data = hist_batch[ticker]
                    else:
                        prices[ticker] = []
                        continue
                else:
                    # Single ticker case
                    ticker_data = hist_batch
                
                if ticker_data.empty:
                    prices[ticker] = []
                    continue
                
                # Extract close prices
                ticker_prices = []
                for date, row in ticker_data.iterrows():
                    close_price = row.get('Close', row.get('Adj Close', None))
                    if pd.notna(close_price) and close_price > 0:
                        # Convert pandas Timestamp to datetime
                        date_dt = date.to_pydatetime() if hasattr(date, 'to_pydatetime') else datetime.combine(date.date(), datetime.min.time())
                        # Remove timezone if present
                        if hasattr(date_dt, 'tzinfo') and date_dt.tzinfo:
                            date_dt = date_dt.replace(tzinfo=None)
                        ticker_prices.append({
                            'date': date_dt,
                            'close': float(close_price)
                        })
                
                # Sort by date
                ticker_prices.sort(key=lambda x: x['date'])
                prices[ticker] = ticker_prices
                
                # Cache the result
                cache_key = f"{ticker}_{cache_key_base}"
                _price_cache[cache_key] = ticker_prices
                _cache_timestamps[cache_key] = now
                
            except Exception as e:
                print(f"Error processing prices for {ticker}: {e}")
                prices[ticker] = []
        
    except Exception as e:
        print(f"Error in batch download, falling back to individual fetches: {e}")
        # Fallback to individual fetches if batch fails
        for ticker in uncached_tickers:
            try:
                stock = yf.Ticker(ticker)
                hist = stock.history(
                    start=start_date.strftime('%Y-%m-%d'),
                    end=(end_date + timedelta(days=1)).strftime('%Y-%m-%d')
                )
                
                if hist.empty:
                    prices[ticker] = []
                    continue
                
                ticker_prices = []
                for date, row in hist.iterrows():
                    close_price = row.get('Close', row.get('Adj Close', None))
                    if pd.notna(close_price) and close_price > 0:
                        date_dt = date.to_pydatetime() if hasattr(date, 'to_pydatetime') else datetime.combine(date.date(), datetime.min.time())
                        if hasattr(date_dt, 'tzinfo') and date_dt.tzinfo:
                            date_dt = date_dt.replace(tzinfo=None)
                        ticker_prices.append({
                            'date': date_dt,
                            'close': float(close_price)
                        })
                
                ticker_prices.sort(key=lambda x: x['date'])
                prices[ticker] = ticker_prices
                
                # Cache the result
                cache_key = f"{ticker}_{cache_key_base}"
                _price_cache[cache_key] = ticker_prices
                _cache_timestamps[cache_key] = now
                
            except Exception as e:
                print(f"Error fetching prices for {ticker}: {e}")
                prices[ticker] = []
    
    return prices


def get_price_at_date(
    price_history: List[Dict[str, any]],
    target_date: datetime
) -> Optional[float]:
    """
    Get the closest price on or before target_date from price history.
    
    Args:
        price_history: List of {date: datetime, close: float} sorted by date
        target_date: Target date (should be naive datetime)
    
    Returns:
        Close price or None if not available
    """
    if not price_history:
        return None
    
    # Normalize target_date to naive for comparison
    target_naive = target_date.replace(tzinfo=None) if target_date.tzinfo else target_date
    
    # Find closest price on or before target_date
    closest_price = None
    for price_point in price_history:
        price_date = price_point['date']
        # Normalize price_date to naive for comparison
        price_date_naive = price_date.replace(tzinfo=None) if hasattr(price_date, 'tzinfo') and price_date.tzinfo else price_date
        
        if price_date_naive <= target_naive:
            closest_price = price_point['close']
        else:
            break
    
    return closest_price


def calculate_daily_portfolio_returns(
    recommendations: List[Dict],
    start_date: datetime,
    end_date: datetime
) -> Tuple[List[Dict], List[str]]:
    """
    Calculate daily portfolio returns from entry_date forward.
    
    Only includes stocks with status='OPEN' and entry_date set.
    Equal-weight portfolio (all active stocks have same weight).
    
    Args:
        recommendations: List of recommendation dicts with:
            - ticker: str
            - entry_date: datetime or str (ISO format)
            - status: str ('OPEN', 'CLOSED', 'WATCHLIST')
            - exit_date: Optional[datetime or str]
            - entry_price: Optional[float]
        start_date: Start date for calculation
        end_date: End date for calculation
    
    Returns:
        Tuple of:
        - List of {date: datetime, return: float, active_count: int}
        - List of missing tickers (tickers with no price data)
    """
    # Filter to recommendations with entry_date (both OPEN and CLOSED for historical tracking)
    # WATCHLIST items are excluded as they don't have entry_date
    active_recs = [
        rec for rec in recommendations
        if rec.get('entry_date') and rec.get('status') in ['OPEN', 'CLOSED']
    ]
    
    if not active_recs:
        return [], []
    
    # Parse entry_date strings to datetime if needed (don't modify original recs)
    # Normalize all to naive datetime for consistent comparison
    parsed_recs = []
    for rec in active_recs:
        rec_copy = rec.copy()
        entry_date = rec['entry_date']
        if isinstance(entry_date, str):
            try:
                entry_date = datetime.fromisoformat(entry_date.replace('Z', '+00:00'))
            except ValueError:
                try:
                    entry_date = datetime.fromisoformat(entry_date)
                except ValueError:
                    # Skip invalid dates
                    print(f"Warning: Could not parse entry_date: {entry_date}, skipping")
                    continue
        
        # Remove timezone to make naive
        if hasattr(entry_date, 'tzinfo') and entry_date.tzinfo:
            entry_date = entry_date.replace(tzinfo=None)
        
        rec_copy['entry_date'] = entry_date
        
        if rec.get('exit_date') and isinstance(rec['exit_date'], str):
            try:
                exit_date = datetime.fromisoformat(rec['exit_date'].replace('Z', '+00:00'))
            except ValueError:
                try:
                    exit_date = datetime.fromisoformat(rec['exit_date'])
                except ValueError:
                    exit_date = None
            
            # Remove timezone to make naive
            if exit_date and hasattr(exit_date, 'tzinfo') and exit_date.tzinfo:
                exit_date = exit_date.replace(tzinfo=None)
            
            rec_copy['exit_date'] = exit_date
        
        parsed_recs.append(rec_copy)
    
    # Use parsed_recs (includes both OPEN and CLOSED)
    active_recs = parsed_recs
    
    # Validate date range - don't fetch future dates
    now = datetime.now().replace(tzinfo=None) if datetime.now().tzinfo else datetime.now()
    if end_date > now:
        print(f"Warning: end_date {end_date} is in the future, clamping to {now}")
        end_date = now
    if start_date > end_date:
        print(f"Warning: start_date {start_date} is after end_date {end_date}, returning empty")
        return [], []
    
    # Get unique tickers
    unique_tickers = list(set(rec['ticker'] for rec in active_recs))
    
    if not unique_tickers:
        return [], []
    
    # Fetch historical prices for all tickers
    print(f"Fetching historical prices for {len(unique_tickers)} tickers from {start_date.date()} to {end_date.date()}...")
    historical_prices = fetch_historical_prices_batch(unique_tickers, start_date, end_date)
    
    # Track missing tickers
    missing_tickers = [ticker for ticker in unique_tickers if not historical_prices.get(ticker)]
    
    # Get trading days
    trading_days = get_trading_days(start_date, end_date)
    
    # Build daily portfolio returns
    daily_returns = []
    
    for day in trading_days:
        # Get all stocks active on this day
        # Active = entry_date <= day AND (exit_date >= day OR exit_date is None)
        active_stocks = []
        day_date = day.date() if hasattr(day, 'date') else day
        
        for rec in parsed_recs:
            entry_date_raw = rec['entry_date']
            exit_date_raw = rec.get('exit_date')
            
            # Normalize entry_date to date
            if isinstance(entry_date_raw, str):
                entry_date_dt = datetime.fromisoformat(entry_date_raw.replace('Z', '+00:00'))
            else:
                entry_date_dt = entry_date_raw
            entry_date_only = entry_date_dt.date() if hasattr(entry_date_dt, 'date') else entry_date_dt
            
            # Normalize exit_date to date if exists
            exit_date_only = None
            if exit_date_raw:
                if isinstance(exit_date_raw, str):
                    exit_date_dt = datetime.fromisoformat(exit_date_raw.replace('Z', '+00:00'))
                else:
                    exit_date_dt = exit_date_raw
                exit_date_only = exit_date_dt.date() if hasattr(exit_date_dt, 'date') else exit_date_dt
            
            # Check if stock is active on this day
            if entry_date_only <= day_date:
                if exit_date_only is None or exit_date_only >= day_date:
                    active_stocks.append(rec)
        
        if not active_stocks:
            daily_returns.append({
                'date': day,
                'return': 0.0,
                'active_count': 0
            })
            continue
        
        # Get previous trading day
        try:
            day_idx = trading_days.index(day)
            prev_day_idx = day_idx - 1
        except ValueError:
            # Day not in trading_days (shouldn't happen, but handle gracefully)
            daily_returns.append({
                'date': day,
                'return': 0.0,
                'active_count': len(active_stocks)
            })
            continue
        
        if prev_day_idx < 0:
            # First day - use entry_price as baseline
            daily_returns.append({
                'date': day,
                'return': 0.0,
                'active_count': len(active_stocks)
            })
            continue
        
        prev_day = trading_days[prev_day_idx]
        
        # Calculate daily return for each active stock
        stock_returns = []
        prev_day_date = prev_day.date() if hasattr(prev_day, 'date') else prev_day
        
        for rec in active_stocks:
            ticker = rec['ticker']
            price_history = historical_prices.get(ticker, [])
            
            # Get entry_date for this stock
            entry_date_raw = rec['entry_date']
            if isinstance(entry_date_raw, str):
                entry_date_dt = datetime.fromisoformat(entry_date_raw.replace('Z', '+00:00'))
            else:
                entry_date_dt = entry_date_raw
            entry_date_only = entry_date_dt.date() if hasattr(entry_date_dt, 'date') else entry_date_dt
            
            # Get entry_price - this is our baseline
            entry_price = rec.get('entry_price')
            if not entry_price or entry_price <= 0:
                # Skip if no valid entry_price
                continue
            
            # If no price history and not on entry day (where we can use entry_price), skip
            if not price_history and day_date != entry_date_only and prev_day_date != entry_date_only:
                continue
            
            # Get prices for current and previous day
            # For CLOSED positions, use exit_price if the day is on or after exit_date
            current_price = None
            prev_price = None
            
            # Check if position was closed on or before this day
            exit_date_raw = rec.get('exit_date')
            exit_date_only = None
            if exit_date_raw:
                if isinstance(exit_date_raw, str):
                    exit_date_dt = datetime.fromisoformat(exit_date_raw.replace('Z', '+00:00'))
                else:
                    exit_date_dt = exit_date_raw
                exit_date_only = exit_date_dt.date() if hasattr(exit_date_dt, 'date') else exit_date_dt
            
            # Determine prices based on entry day, exit day, and current day
            if exit_date_only and exit_date_only <= day_date:
                # Position was closed on or before this day - use exit_price
                current_price = rec.get('exit_price')
                if exit_date_only <= prev_day_date:
                    prev_price = rec.get('exit_price')
                elif prev_day_date == entry_date_only:
                    # Previous day was entry day, use entry_price
                    prev_price = entry_price
                else:
                    prev_price = get_price_at_date(price_history, prev_day)
            elif day_date == entry_date_only:
                # This is the entry day - use entry_price as baseline
                # Try to get actual price on entry day, fallback to entry_price
                current_price = get_price_at_date(price_history, day) or entry_price
                prev_price = entry_price  # Use entry_price as baseline
            elif prev_day_date == entry_date_only:
                # Previous day was entry day - use entry_price as prev_price
                if exit_date_only and exit_date_only <= day_date:
                    current_price = rec.get('exit_price')
                else:
                    current_price = get_price_at_date(price_history, day)
                prev_price = entry_price
            else:
                # Normal day-over-day calculation
                if exit_date_only and exit_date_only <= day_date:
                    current_price = rec.get('exit_price')
                else:
                    current_price = get_price_at_date(price_history, day)
                prev_price = get_price_at_date(price_history, prev_day)
            
            if current_price and prev_price and prev_price > 0:
                # Simple return: (close_t / close_{t-1}) - 1
                daily_return = (current_price / prev_price) - 1
                
                # Apply action (BUY/SELL) - SELL positions have inverted returns
                if rec.get('action') == 'SELL':
                    daily_return = -daily_return
                
                stock_returns.append(daily_return)
        
        # Calculate equal-weight portfolio return (average of all stock returns)
        if stock_returns:
            portfolio_return = sum(stock_returns) / len(stock_returns)
        else:
            portfolio_return = 0.0
        
        daily_returns.append({
            'date': day,
            'return': portfolio_return,
            'active_count': len(active_stocks)
        })
    
    return daily_returns, missing_tickers


def calculate_rolling_returns(
    daily_returns: List[Dict],
    window_days: int
) -> List[Dict]:
    """
    Calculate rolling compounded returns from daily returns.
    
    Formula: R_t^(n) = product(1 + r_i) for i in [t-n+1, t] - 1
    
    Args:
        daily_returns: List of {date: datetime, return: float, active_count: int}
        window_days: Rolling window size (7 for weekly, 30 for monthly)
    
    Returns:
        List of {date: datetime, return: float, active_count: int}
        Returns 0.0 for first (window_days-1) days
    """
    rolling_returns = []
    
    for i, daily in enumerate(daily_returns):
        if i < window_days - 1:
            # Not enough data for rolling window
            rolling_returns.append({
                'date': daily['date'],
                'return': 0.0,
                'active_count': daily['active_count']
            })
            continue
        
        # Calculate compounded return over window
        # product(1 + r_i) for i in [i-window_days+1, i]
        compounded = 1.0
        for j in range(i - window_days + 1, i + 1):
            daily_return = daily_returns[j]['return']
            compounded *= (1 + daily_return)
        
        rolling_return = compounded - 1
        
        rolling_returns.append({
            'date': daily['date'],
            'return': rolling_return,
            'active_count': daily['active_count']
        })
    
    return rolling_returns


def calculate_cumulative_returns(
    daily_returns: List[Dict]
) -> List[Dict]:
    """
    Calculate cumulative returns from daily returns.
    
    Formula: cumulative_t = product(1 + r_i) for i in [0, t] - 1
    
    Args:
        daily_returns: List of {date: datetime, return: float, active_count: int}
    
    Returns:
        List of {date: datetime, return: float, active_count: int}
    """
    cumulative_returns = []
    cumulative = 1.0
    
    for daily in daily_returns:
        daily_return = daily['return']
        cumulative *= (1 + daily_return)
        
        cumulative_returns.append({
            'date': daily['date'],
            'return': cumulative - 1,
            'active_count': daily['active_count']
        })
    
    return cumulative_returns


def compute_rolling_portfolio_returns(
    recommendations: List[Dict],
    range_type: str = 'DAY',
    max_days_back: int = 365
) -> Dict:
    """
    Main function to compute rolling portfolio returns.
    
    Args:
        recommendations: List of recommendation dicts
        range_type: 'DAY', 'WEEK', or 'MONTH'
        max_days_back: Maximum days to look back (default 365, increased for monthly)
    
    Returns:
        Dictionary with:
        - points: List of {date: str, value: float, active_count: int}
        - cumulative: List of {date: str, value: float, active_count: int} (optional)
        - meta: {window_days, start_date, end_date, method_used, missing_symbols}
    """
    # Increase lookback period for monthly to ensure we have enough data
    if range_type == 'MONTH':
        max_days_back = max(max_days_back, 180)  # At least 6 months of data
    now = datetime.now()
    
    # Determine date range
    # Find earliest entry_date among OPEN and CLOSED recommendations (for historical tracking)
    active_recs = [r for r in recommendations if r.get('entry_date') and r.get('status') in ['OPEN', 'CLOSED']]
    if not active_recs:
        return {
            'points': [],
            'cumulative': [],
            'meta': {
                'window_days': 1,
                'start_date': None,
                'end_date': now.isoformat(),
                'method_used': 'equal_weight',
                'missing_symbols': []
            }
        }
    
    # Parse entry dates
    entry_dates = []
    for rec in active_recs:
        entry_date = rec['entry_date']
        if isinstance(entry_date, str):
            # Handle ISO format with or without timezone
            try:
                entry_date = datetime.fromisoformat(entry_date.replace('Z', '+00:00'))
            except ValueError:
                # Try parsing without timezone
                try:
                    entry_date = datetime.fromisoformat(entry_date)
                except ValueError:
                    # Fallback: try common date formats
                    # Format: "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DD"
                    try:
                        if 'T' in entry_date:
                            entry_date = datetime.fromisoformat(entry_date.split('T')[0])
                        else:
                            entry_date = datetime.strptime(entry_date.split()[0], '%Y-%m-%d')
                    except ValueError:
                        print(f"Warning: Could not parse entry_date: {entry_date}, skipping")
                        continue
        
        # Remove timezone for comparison (make naive)
        if hasattr(entry_date, 'tzinfo') and entry_date.tzinfo:
            entry_date = entry_date.replace(tzinfo=None)
        
        entry_dates.append(entry_date)
    
    # Ensure now is also naive for comparison
    now_naive = now.replace(tzinfo=None) if hasattr(now, 'tzinfo') and now.tzinfo else now
    
    earliest_entry = min(entry_dates)
    start_date = max(earliest_entry, now_naive - timedelta(days=max_days_back))
    end_date = now_naive
    
    # Calculate daily portfolio returns (includes both OPEN and CLOSED positions)
    daily_returns, missing_tickers = calculate_daily_portfolio_returns(
        active_recs,
        start_date,
        end_date
    )
    
    if not daily_returns:
        return {
            'points': [],
            'cumulative': [],
            'meta': {
                'window_days': 1,
                'start_date': start_date.isoformat(),
                'end_date': end_date.isoformat(),
                'method_used': 'equal_weight',
                'missing_symbols': missing_tickers
            }
        }
    
    # Calculate cumulative returns from daily returns (same for all period types)
    cumulative_returns = calculate_cumulative_returns(daily_returns)
    
    # Aggregate based on range_type
    if range_type == 'DAY':
        points = daily_returns
        window_days = 1
        # Cumulative matches daily points
        cumulative_for_points = cumulative_returns
    elif range_type == 'WEEK':
        # For weekly: calculate rolling 7-day returns, sample every 7 trading days
        rolling_weekly = calculate_rolling_returns(daily_returns, 7)
        points = []
        cumulative_for_points = []
        
        # Sample every 7th trading day (starting from day 7, index 6)
        for i in range(6, len(rolling_weekly), 7):  # Start at index 6 (7th day), then every 7 days
            points.append(rolling_weekly[i])
            cumulative_for_points.append(cumulative_returns[i])
        
        # Also include the last point if not already included
        if len(rolling_weekly) > 0:
            last_idx = len(rolling_weekly) - 1
            if last_idx % 7 != 6:  # If last index is not already in our sampled set
                points.append(rolling_weekly[last_idx])
                cumulative_for_points.append(cumulative_returns[last_idx])
        
        window_days = 7
    elif range_type == 'MONTH':
        # For monthly: calculate rolling 30-day returns, sample every 30 trading days
        rolling_monthly = calculate_rolling_returns(daily_returns, 30)
        points = []
        cumulative_for_points = []
        
        # Sample every 30th trading day (starting from day 30, index 29)
        for i in range(29, len(rolling_monthly), 30):  # Start at index 29 (30th day), then every 30 days
            points.append(rolling_monthly[i])
            cumulative_for_points.append(cumulative_returns[i])
        
        # Also include the last point if not already included
        if len(rolling_monthly) > 0:
            last_idx = len(rolling_monthly) - 1
            if last_idx % 30 != 29:  # If last index is not already in our sampled set
                points.append(rolling_monthly[last_idx])
                cumulative_for_points.append(cumulative_returns[last_idx])
        
        window_days = 30
    else:
        raise ValueError(f"Invalid range_type: {range_type}. Must be DAY, WEEK, or MONTH")
    
    # Convert to response format
    points_formatted = [
        {
            'date': p['date'].strftime('%Y-%m-%d'),
            'value': p['return'] * 100,  # Convert to percentage
            'active_count': p['active_count']
        }
        for p in points
    ]
    
    cumulative_formatted = [
        {
            'date': c['date'].strftime('%Y-%m-%d'),
            'value': c['return'] * 100,  # Convert to percentage
            'active_count': c['active_count']
        }
        for c in cumulative_for_points
    ]
    
    return {
        'points': points_formatted,
        'cumulative': cumulative_formatted,
        'meta': {
            'window_days': window_days,
            'start_date': start_date.isoformat(),
            'end_date': end_date.isoformat(),
            'method_used': 'equal_weight',
            'missing_symbols': missing_tickers
        }
    }

