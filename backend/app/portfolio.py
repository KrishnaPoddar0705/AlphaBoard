"""
Portfolio Balance Management Module
Handles paper trading balance, position sizing, and rebalancing.
"""
from typing import Dict, Optional, Tuple, List
from .db import supabase
import numpy as np
import pandas as pd
from datetime import datetime, timedelta


INITIAL_BALANCE = 1000000.0  # ₹1,000,000


def get_portfolio_balance(user_id: str) -> Dict:
    """Get current portfolio balance and available cash"""
    try:
        res = supabase.table("portfolio_balance").select("*").eq("user_id", user_id).execute()
        if res.data and len(res.data) > 0:
            return res.data[0]
        
        # Initialize if doesn't exist
        return initialize_portfolio_balance(user_id)
    except Exception as e:
        print(f"Error fetching portfolio balance: {e}")
        return {
            "user_id": user_id,
            "initial_balance": INITIAL_BALANCE,
            "current_balance": INITIAL_BALANCE,
            "available_cash": INITIAL_BALANCE,
            "total_invested": 0
        }


def initialize_portfolio_balance(user_id: str) -> Dict:
    """Initialize portfolio balance with ₹1M for a new user"""
    try:
        balance_data = {
            "user_id": user_id,
            "initial_balance": INITIAL_BALANCE,
            "current_balance": INITIAL_BALANCE,
            "available_cash": INITIAL_BALANCE,
            "total_invested": 0
        }
        res = supabase.table("portfolio_balance").upsert(balance_data).execute()
        if res.data and len(res.data) > 0:
            return res.data[0]
        return balance_data
    except Exception as e:
        print(f"Error initializing portfolio balance: {e}")
        return {
            "user_id": user_id,
            "initial_balance": INITIAL_BALANCE,
            "current_balance": INITIAL_BALANCE,
            "available_cash": INITIAL_BALANCE,
            "total_invested": 0
        }


def calculate_position_size(weight_pct: float, entry_price: float, available_balance: float) -> Tuple[float, float]:
    """
    Calculate position size and invested amount based on weight.
    Returns: (invested_amount, position_size)
    """
    if entry_price <= 0:
        return (0.0, 0.0)
    
    invested_amount = (weight_pct / 100.0) * available_balance
    position_size = invested_amount / entry_price
    
    return (invested_amount, position_size)


def update_portfolio_balance(user_id: str):
    """
    Recalculate portfolio balance after position changes.
    Updates available_cash, total_invested, and current_balance.
    """
    try:
        # Get all OPEN positions
        res = supabase.table("recommendations").select("invested_amount, current_price, entry_price").eq("user_id", user_id).eq("status", "OPEN").execute()
        open_positions = res.data if res.data else []
        
        # Calculate total invested
        total_invested = sum(float(pos.get('invested_amount', 0) or 0) for pos in open_positions)
        
        # Calculate current portfolio value
        current_value = 0.0
        for pos in open_positions:
            invested = float(pos.get('invested_amount', 0) or 0)
            entry_price = float(pos.get('entry_price', 0) or 0)
            current_price = float(pos.get('current_price', 0) or entry_price)
            
            if entry_price > 0:
                current_value += invested * (current_price / entry_price)
        
        # Get initial balance
        balance = get_portfolio_balance(user_id)
        initial_balance = float(balance.get('initial_balance', INITIAL_BALANCE))
        
        # Calculate available cash
        available_cash = initial_balance - total_invested
        
        # Current balance = available cash + current portfolio value
        current_balance = available_cash + current_value
        
        # Update portfolio balance
        supabase.table("portfolio_balance").upsert({
            "user_id": user_id,
            "initial_balance": initial_balance,
            "current_balance": current_balance,
            "available_cash": available_cash,
            "total_invested": total_invested
        }).execute()
        
        return {
            "initial_balance": initial_balance,
            "current_balance": current_balance,
            "available_cash": available_cash,
            "total_invested": total_invested
        }
    except Exception as e:
        print(f"Error updating portfolio balance: {e}")
        return get_portfolio_balance(user_id)


def compute_rebalanced_weights(old_weights: Dict[str, float], target_ticker: str, new_weight: float) -> Dict[str, float]:
    """
    Auto-rebalancing logic: When one weight changes, others adjust proportionally.
    
    Args:
        old_weights: {ticker: weight_pct} - Current weights
        target_ticker: Ticker being adjusted
        new_weight: New weight percentage for target ticker
    
    Returns:
        {ticker: weight_pct} - Rebalanced weights that sum to 100%
    """
    if not old_weights or target_ticker not in old_weights:
        return old_weights
    
    old_weight = old_weights[target_ticker]
    remaining_weight = 1.0 - (old_weight / 100.0)
    new_remaining_weight = 1.0 - (new_weight / 100.0)
    
    # Edge case: only one position or setting to 100%
    if len(old_weights) == 1 or new_weight >= 100.0:
        return {target_ticker: 100.0}
    
    # Edge case: remaining weight is zero (shouldn't happen, but defensive)
    if remaining_weight <= 0.001:
        # Distribute equally among all other positions
        other_tickers = [t for t in old_weights.keys() if t != target_ticker]
        equal_weight = new_remaining_weight * 100.0 / len(other_tickers)
        rebalanced = {target_ticker: new_weight}
        for ticker in other_tickers:
            rebalanced[ticker] = equal_weight
        return rebalanced
    
    # Proportional adjustment
    rebalanced = {}
    for ticker, weight in old_weights.items():
        if ticker == target_ticker:
            rebalanced[ticker] = new_weight
        else:
            # Proportional adjustment: W_i' = W_i * (1 - W_new) / (1 - W_old)
            weight_ratio = (new_remaining_weight / remaining_weight)
            rebalanced[ticker] = (weight / 100.0) * weight_ratio * 100.0
    
    # Normalize to ensure exactly 100%
    total = sum(rebalanced.values())
    if total > 0:
        rebalanced = {k: (v / total) * 100.0 for k, v in rebalanced.items()}
    
    return rebalanced


def compute_paper_positions(weights: Dict[str, float], capital: float, entry_prices: Dict[str, float]) -> Dict[str, Dict]:
    """
    Calculate position sizes for paper trading.
    
    Args:
        weights: {ticker: weight_pct} - Portfolio weights
        capital: Total capital available
        entry_prices: {ticker: entry_price} - Entry prices for each ticker
    
    Returns:
        {ticker: {'weight': %, 'value': ₹, 'units': count}}
    """
    positions = {}
    for ticker, weight in weights.items():
        position_value = (weight / 100.0) * capital
        entry_price = entry_prices.get(ticker, 0)
        units = position_value / entry_price if entry_price > 0 else 0
        
        positions[ticker] = {
            'weight': weight,
            'value': position_value,
            'units': units,
            'entry_price': entry_price
        }
    return positions


def rebalance_portfolio_with_weights(user_id: str, weight_updates: Dict[str, float]) -> Dict:
    """
    Rebalance portfolio with new weights.
    weight_updates: {recommendation_id: new_weight_pct}
    IMPORTANT: This function updates ALL positions with weights from weight_updates.
    If a position is not in weight_updates, it will NOT be updated (preserves existing weight).
    Returns updated portfolio balance
    """
    try:
        print(f"[WEIGHT SAVE] Starting rebalance for user {user_id}")
        print(f"[WEIGHT SAVE] Weight updates: {weight_updates}")
        
        # Get portfolio balance and calculate total portfolio value
        balance = get_portfolio_balance(user_id)
        
        # Get all OPEN positions first to calculate current portfolio value
        res = supabase.table("recommendations").select("*").eq("user_id", user_id).eq("status", "OPEN").execute()
        open_positions = res.data if res.data else []
        
        if not open_positions:
            print(f"[WEIGHT SAVE] No open positions found for user {user_id}")
            return balance
        
        # Calculate current total portfolio value from existing positions
        current_portfolio_value = 0.0
        for pos in open_positions:
            invested = float(pos.get('invested_amount', 0) or 0)
            entry_price = float(pos.get('entry_price', 0) or 0)
            current_price = float(pos.get('current_price', 0) or entry_price)
            
            if entry_price > 0:
                current_portfolio_value += invested * (current_price / entry_price)
        
        # If no current value, use initial balance
        if current_portfolio_value == 0:
            current_portfolio_value = float(balance.get('initial_balance', INITIAL_BALANCE))
        
        print(f"[WEIGHT SAVE] Current portfolio value: {current_portfolio_value}")
        
        # Normalize weights to ensure they sum to 100%
        total_weight = sum(weight_updates.values())
        print(f"[WEIGHT SAVE] Total weight before normalization: {total_weight}")
        
        if abs(total_weight - 100.0) > 0.01 and total_weight > 0:
            # Normalize weights
            weight_updates = {k: (v / total_weight) * 100.0 for k, v in weight_updates.items()}
            print(f"[WEIGHT SAVE] Normalized weights: {weight_updates}")
        
        # Update each position that has a weight in weight_updates
        update_count = 0
        for pos in open_positions:
            pos_id = str(pos['id'])
            new_weight = weight_updates.get(pos_id)
            
            # Only update if weight is provided in weight_updates
            if new_weight is not None:
                entry_price = float(pos.get('entry_price', 0) or 0)
                if entry_price > 0:
                    # Calculate invested_amount based on weight and current portfolio value
                    invested_amount = (new_weight / 100.0) * current_portfolio_value
                    position_size = invested_amount / entry_price if entry_price > 0 else 0
                    
                    print(f"[WEIGHT SAVE] Updating {pos['ticker']} (ID: {pos_id}): weight={new_weight:.2f}%, invested={invested_amount:.2f}, size={position_size:.2f}")
                    
                    # Update the recommendation with new weight and calculated values
                    update_res = supabase.table("recommendations").update({
                        "weight_pct": new_weight,
                        "invested_amount": invested_amount,
                        "position_size": position_size
                    }).eq("id", pos['id']).execute()
                    
                    if update_res.data:
                        update_count += 1
                        print(f"[WEIGHT SAVE] Successfully updated {pos['ticker']}")
                    else:
                        print(f"[WEIGHT SAVE] WARNING: Update may have failed for {pos['ticker']}")
        
        print(f"[WEIGHT SAVE] Updated {update_count} positions out of {len([k for k in weight_updates.keys()])}")
        
        # Update portfolio balance after rebalancing
        updated_balance = update_portfolio_balance(user_id)
        print(f"[WEIGHT SAVE] Rebalance complete")
        return updated_balance
    except Exception as e:
        print(f"[WEIGHT SAVE] ERROR rebalancing portfolio: {e}")
        import traceback
        traceback.print_exc()
        return balance


def compute_portfolio_returns_series(user_id: str, positions: Dict[str, Dict], days: int = 252) -> pd.Series:
    """
    Compute portfolio returns time series from historical prices.
    
    Args:
        user_id: User ID
        positions: {ticker: {'weight': %, 'value': ₹, 'units': count, 'entry_price': float}}
        days: Number of days to look back
    
    Returns:
        pd.Series of daily returns
    """
    try:
        from .performance import get_historical_price_data
        
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        
        returns_data = []
        dates = pd.date_range(start=start_date, end=end_date, freq='D')
        prev_portfolio_value = None
        
        for date in dates:
            portfolio_value = 0.0
            
            for ticker, pos in positions.items():
                entry_price = pos.get('entry_price', 0)
                units = pos.get('units', 0)
                
                if entry_price <= 0 or units <= 0:
                    continue
                
                # Get price for this date
                date_str = date.strftime("%Y-%m-%d")
                try:
                    df = get_historical_price_data(ticker, date_str, (date + timedelta(days=1)).strftime("%Y-%m-%d"))
                    if not df.empty:
                        current_price = float(df['Close'].iloc[-1])
                    else:
                        current_price = entry_price
                except:
                    current_price = entry_price
                
                position_value = units * current_price
                portfolio_value += position_value
            
            if prev_portfolio_value is not None and prev_portfolio_value > 0:
                daily_return = (portfolio_value / prev_portfolio_value) - 1
                returns_data.append(daily_return)
            else:
                returns_data.append(0.0)
            
            prev_portfolio_value = portfolio_value
        
        return pd.Series(returns_data, index=dates[:len(returns_data)])
    except Exception as e:
        print(f"Error computing returns series: {e}")
        return pd.Series()


def compute_expected_sharpe(returns_series: pd.Series, risk_free_rate: float = 0.05) -> float:
    """
    Compute expected Sharpe ratio from returns series.
    
    Args:
        returns_series: pd.Series of daily returns
        risk_free_rate: Annual risk-free rate (default 5%)
    
    Returns:
        Expected Sharpe ratio
    """
    try:
        if len(returns_series) < 2:
            return 0.0
        
        periods_per_year = 252
        excess_returns = returns_series - (risk_free_rate / periods_per_year)
        
        if excess_returns.std() == 0:
            return 0.0
        
        sharpe = (excess_returns.mean() * periods_per_year) / (excess_returns.std() * np.sqrt(periods_per_year))
        return float(sharpe)
    except Exception as e:
        print(f"Error computing expected Sharpe: {e}")
        return 0.0


def compute_expected_volatility(returns_series: pd.Series, periods_per_year: int = 252) -> float:
    """
    Compute expected annualized volatility from returns series.
    
    Args:
        returns_series: pd.Series of daily returns
        periods_per_year: Trading days per year
    
    Returns:
        Annualized volatility as percentage
    """
    try:
        if len(returns_series) < 2:
            return 0.0
        
        volatility = returns_series.std() * np.sqrt(periods_per_year)
        return float(volatility * 100)  # Return as percentage
    except Exception as e:
        print(f"Error computing expected volatility: {e}")
        return 0.0


def compute_contribution_by_asset(positions: Dict[str, Dict], returns_by_ticker: Dict[str, float]) -> List[Dict]:
    """
    Compute contribution to portfolio return by each asset.
    
    Args:
        positions: {ticker: {'weight': %, 'value': ₹}}
        returns_by_ticker: {ticker: return_pct} - Individual stock returns
    
    Returns:
        List of {ticker, weight, return, contribution}
    """
    try:
        contributions = []
        total_portfolio_return = 0.0
        
        for ticker, pos in positions.items():
            weight = pos.get('weight', 0) / 100.0  # Convert to decimal
            stock_return = returns_by_ticker.get(ticker, 0) / 100.0  # Convert to decimal
            contribution = weight * stock_return
            
            contributions.append({
                'ticker': ticker,
                'weight': pos.get('weight', 0),
                'return': returns_by_ticker.get(ticker, 0),
                'contribution': contribution * 100  # Convert back to percentage
            })
            
            total_portfolio_return += contribution
        
        # Sort by absolute contribution
        contributions.sort(key=lambda x: abs(x['contribution']), reverse=True)
        
        return contributions
    except Exception as e:
        print(f"Error computing contribution by asset: {e}")
        return []


def compute_portfolio_pnl(positions: Dict[str, Dict], current_prices: Dict[str, float]) -> Dict[str, float]:
    """
    Compute P&L for each position.
    
    Args:
        positions: {ticker: {'value': ₹, 'entry_price': float, 'units': count}}
        current_prices: {ticker: current_price}
    
    Returns:
        {ticker: pnl_amount}
    """
    try:
        pnl = {}
        for ticker, pos in positions.items():
            entry_price = pos.get('entry_price', 0)
            units = pos.get('units', 0)
            current_price = current_prices.get(ticker, entry_price)
            
            if entry_price > 0:
                pnl_amount = (current_price - entry_price) * units
                pnl[ticker] = pnl_amount
            else:
                pnl[ticker] = 0.0
        
        return pnl
    except Exception as e:
        print(f"Error computing portfolio P&L: {e}")
        return {}

