"""
Thesis Data Aggregation Module

Aggregates fundamentals, technicals, and sentiment data for AI thesis generation.
"""

from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
import statistics
from .market import (
    get_stock_summary,
    get_financials_data,
    get_balance_sheet_data,
    get_cash_flow_data,
    get_quarterly_data,
    get_stock_history_data,
    get_earnings_data,
)
from .news import get_cached_news
from .db import supabase


def calculate_technical_metrics(history_data: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Calculate technical indicators from price history.
    
    Returns:
        Dict with price trends, volatility, volume trends, moving averages
    """
    if not history_data or len(history_data) < 20:
        return {}
    
    # Sort by date
    sorted_data = sorted(history_data, key=lambda x: x.get("date", ""))
    
    closes = [d.get("close", 0) for d in sorted_data if d.get("close", 0) > 0]
    volumes = [d.get("volume", 0) for d in sorted_data if d.get("volume", 0) > 0]
    
    if not closes:
        return {}
    
    # Price trends (1m, 3m, 6m, 1y)
    current_price = closes[-1]
    trends = {}
    
    periods = {
        "1m": min(30, len(closes) - 1),
        "3m": min(90, len(closes) - 1),
        "6m": min(180, len(closes) - 1),
        "1y": len(closes) - 1
    }
    
    for period_name, days_back in periods.items():
        if days_back > 0 and len(closes) > days_back:
            past_price = closes[-days_back]
            if past_price > 0:
                change_pct = ((current_price - past_price) / past_price) * 100
                trends[f"{period_name}_change_pct"] = round(change_pct, 2)
    
    # Volatility (standard deviation of returns)
    returns = []
    for i in range(1, len(closes)):
        if closes[i-1] > 0:
            ret = (closes[i] - closes[i-1]) / closes[i-1]
            returns.append(ret)
    
    volatility = statistics.stdev(returns) * 100 if len(returns) > 1 else 0
    
    # Moving averages
    ma_20 = statistics.mean(closes[-20:]) if len(closes) >= 20 else None
    ma_50 = statistics.mean(closes[-50:]) if len(closes) >= 50 else None
    ma_200 = statistics.mean(closes[-200:]) if len(closes) >= 200 else None
    
    # ATH/ATL
    ath = max(closes)
    atl = min(closes)
    ath_pct_from_current = ((ath - current_price) / ath * 100) if ath > 0 else 0
    atl_pct_from_current = ((current_price - atl) / atl * 100) if atl > 0 else 0
    
    # Volume trends
    avg_volume_20d = statistics.mean(volumes[-20:]) if len(volumes) >= 20 else None
    avg_volume_50d = statistics.mean(volumes[-50:]) if len(volumes) >= 50 else None
    recent_volume = volumes[-5:] if len(volumes) >= 5 else []
    volume_spike = False
    if avg_volume_20d and recent_volume:
        recent_avg = statistics.mean(recent_volume)
        volume_spike = recent_avg > avg_volume_20d * 1.5
    
    return {
        "current_price": round(current_price, 2),
        "price_trends": trends,
        "volatility_pct": round(volatility, 2),
        "moving_averages": {
            "ma_20": round(ma_20, 2) if ma_20 else None,
            "ma_50": round(ma_50, 2) if ma_50 else None,
            "ma_200": round(ma_200, 2) if ma_200 else None,
        },
        "ath": round(ath, 2),
        "atl": round(atl, 2),
        "ath_pct_from_current": round(ath_pct_from_current, 2),
        "atl_pct_from_current": round(atl_pct_from_current, 2),
        "volume_trends": {
            "avg_volume_20d": round(avg_volume_20d, 0) if avg_volume_20d else None,
            "avg_volume_50d": round(avg_volume_50d, 0) if avg_volume_50d else None,
            "volume_spike": bool(volume_spike),  # Ensure Python bool, not numpy bool
        }
    }


def aggregate_sentiment(news_articles: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Aggregate sentiment from news articles.
    
    Returns:
        Dict with sentiment breakdown, aggregate sentiment, analyst ratings
    """
    if not news_articles:
        return {
            "aggregate_sentiment": "neutral",
            "sentiment_breakdown": {"positive": 0, "neutral": 0, "negative": 0},
            "avg_impact_score": 5,
            "recent_news_count": 0,
        }
    
    sentiments = {"positive": 0, "neutral": 0, "negative": 0}
    impact_scores = []
    
    for article in news_articles:
        sentiment = article.get("sentiment", "neutral")
        if sentiment in sentiments:
            sentiments[sentiment] += 1
        
        impact = article.get("impact_score")
        if impact:
            impact_scores.append(impact)
    
    # Determine aggregate sentiment
    total = sum(sentiments.values())
    if total > 0:
        positive_pct = sentiments["positive"] / total
        negative_pct = sentiments["negative"] / total
        
        if positive_pct > 0.4:
            aggregate = "positive"
        elif negative_pct > 0.4:
            aggregate = "negative"
        else:
            aggregate = "neutral"
    else:
        aggregate = "neutral"
    
    avg_impact = statistics.mean(impact_scores) if impact_scores else 5
    
    return {
        "aggregate_sentiment": aggregate,
        "sentiment_breakdown": sentiments,
        "avg_impact_score": round(avg_impact, 1),
        "recent_news_count": len(news_articles),
    }


def get_analyst_ratings(ticker: str) -> Dict[str, Any]:
    """
    Get analyst ratings from stock summary.
    Returns breakdown of buy/hold/sell recommendations.
    """
    summary = get_stock_summary(ticker)
    
    # yfinance doesn't always provide detailed analyst ratings breakdown
    # We'll use target prices as a proxy
    target_mean = summary.get("targetMeanPrice")
    target_high = summary.get("targetHighPrice")
    target_low = summary.get("targetLowPrice")
    current_price = summary.get("currentPrice")
    
    rating_summary = {
        "target_mean": target_mean,
        "target_high": target_high,
        "target_low": target_low,
        "current_price": current_price,
    }
    
    # Infer rating from target vs current
    if target_mean and current_price:
        upside_pct = ((target_mean - current_price) / current_price) * 100
        rating_summary["upside_pct"] = round(upside_pct, 2)
        
        if upside_pct > 15:
            inferred_rating = "buy"
        elif upside_pct < -15:
            inferred_rating = "sell"
        else:
            inferred_rating = "hold"
        
        rating_summary["inferred_rating"] = inferred_rating
    
    return rating_summary


def aggregate_stock_data(ticker: str, analyst_notes: Optional[str] = None) -> Dict[str, Any]:
    """
    Aggregate all data needed for thesis generation.
    
    Args:
        ticker: Stock ticker symbol
        analyst_notes: Optional analyst notes/thesis
    
    Returns:
        Unified data structure with fundamentals, technicals, sentiment
    """
    # Fundamentals
    summary = get_stock_summary(ticker)
    financials = get_financials_data(ticker)
    quarterly = get_quarterly_data(ticker)
    cash_flow = get_cash_flow_data(ticker)
    balance_sheet = get_balance_sheet_data(ticker)
    earnings = get_earnings_data(ticker)
    
    # Technicals
    history_1y = get_stock_history_data(ticker, period="1y")
    technicals = calculate_technical_metrics(history_1y)
    
    # Sentiment
    news_articles = get_cached_news(ticker, hours=168)  # Last 7 days
    sentiment = aggregate_sentiment(news_articles)
    
    # Analyst ratings
    analyst_ratings = get_analyst_ratings(ticker)
    
    # Calculate fundamental metrics
    fundamentals_summary = {
        "revenue_history": financials[:5] if financials else [],
        "eps_history": [f.get("eps", 0) for f in financials[:5] if f.get("eps")],
        "margin_trends": [],
        "fcf": [cf.get("free_cash_flow", 0) for cf in cash_flow[:5] if cf.get("free_cash_flow")],
        "debt_equity": summary.get("debtToEquity"),
        "pe_ratio": summary.get("pe"),
        "pb_ratio": summary.get("pb"),
        "cash_position": balance_sheet[0].get("cash", 0) if balance_sheet else None,
        "roe": summary.get("roe"),
        "roce": summary.get("roce"),
        "market_cap": summary.get("marketCap"),
        "current_price": summary.get("currentPrice"),
    }
    
    # Calculate margin trends from financials
    if financials:
        for f in financials[:5]:
            revenue = f.get("revenue", 0)
            gross_profit = f.get("gross_profit", 0)
            operating_profit = f.get("operating_profit", 0)
            net_profit = f.get("netProfit", 0)
            
            if revenue > 0:
                gross_margin = (gross_profit / revenue) * 100
                operating_margin = (operating_profit / revenue) * 100 if operating_profit else None
                net_margin = (net_profit / revenue) * 100 if net_profit else None
                
                fundamentals_summary["margin_trends"].append({
                    "year": f.get("year"),
                    "gross_margin": round(gross_margin, 2),
                    "operating_margin": round(operating_margin, 2) if operating_margin else None,
                    "net_margin": round(net_margin, 2) if net_margin else None,
                })
    
    return {
        "ticker": ticker,
        "fundamentals": fundamentals_summary,
        "technicals": technicals,
        "sentiment": sentiment,
        "analyst_ratings": analyst_ratings,
        "quarterly_data": quarterly[:4] if quarterly else [],
        "earnings_data": earnings[:4] if earnings else [],
        "analyst_notes": analyst_notes,
        "generated_at": datetime.utcnow().isoformat(),
    }

