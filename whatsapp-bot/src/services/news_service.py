"""
News service for fetching stock news from multiple sources.
Provides fallback to free APIs when AlphaBoard API returns limited results.
"""

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import httpx

from ..config import CREDIBLE_NEWS_SOURCES, NEWS_SOURCE_NAMES, get_source_from_url

logger = logging.getLogger(__name__)

# Free tier API endpoints
FINNHUB_API_BASE = "https://finnhub.io/api/v1"
FINNHUB_NEWS_ENDPOINT = "/company-news"


class NewsService:
    """
    Service for fetching and filtering news from multiple sources.
    
    Prioritizes AlphaBoard API, falls back to Finnhub for US stocks.
    All results are filtered through credible source whitelist.
    """
    
    def __init__(
        self,
        alphaboard_api_url: str = "",
        finnhub_api_key: str = ""  # Free tier available
    ):
        self.alphaboard_api_url = alphaboard_api_url
        self.finnhub_api_key = finnhub_api_key
        self._client: Optional[httpx.AsyncClient] = None
    
    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client."""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=30.0)
        return self._client
    
    async def close(self):
        """Close HTTP client."""
        if self._client:
            await self._client.aclose()
    
    async def get_news(
        self,
        ticker: str,
        max_articles: int = 5,
        include_non_credible: bool = False
    ) -> List[Dict[str, Any]]:
        """
        Get news for a ticker from multiple sources.
        
        Args:
            ticker: Stock ticker symbol
            max_articles: Maximum number of articles to return
            include_non_credible: Whether to include articles from non-credible sources
            
        Returns:
            List of news articles with credible source info
        """
        articles = []
        
        # Try AlphaBoard API first
        if self.alphaboard_api_url:
            alphaboard_news = await self._fetch_from_alphaboard(ticker)
            articles.extend(alphaboard_news)
        
        # If we don't have enough credible articles, try Finnhub
        credible_count = sum(1 for a in articles if a.get("is_credible", False))
        if credible_count < max_articles and self.finnhub_api_key:
            finnhub_news = await self._fetch_from_finnhub(ticker)
            articles.extend(finnhub_news)
        
        # Filter and deduplicate
        seen_headlines = set()
        filtered_articles = []
        
        for article in articles:
            headline = article.get("headline", "").lower()[:50]
            if headline in seen_headlines:
                continue
            seen_headlines.add(headline)
            
            # Check credibility
            url = article.get("source_url", "")
            is_credible, source_name, domain = get_source_from_url(url)
            
            article["is_credible"] = is_credible
            article["source_name"] = source_name or article.get("source", "Unknown")
            article["domain"] = domain
            
            # Include based on credibility setting
            if is_credible or include_non_credible:
                filtered_articles.append(article)
        
        # Sort by credibility, then by date
        filtered_articles.sort(
            key=lambda x: (not x.get("is_credible", False), x.get("published_at", "")),
            reverse=True
        )
        
        return filtered_articles[:max_articles]
    
    async def _fetch_from_alphaboard(self, ticker: str) -> List[Dict[str, Any]]:
        """Fetch news from AlphaBoard API."""
        try:
            client = await self._get_client()
            url = f"{self.alphaboard_api_url}/news/{ticker}"
            
            response = await client.get(url)
            if response.status_code != 200:
                logger.warning(f"AlphaBoard news API error: {response.status_code}")
                return []
            
            data = response.json()
            articles = data.get("articles", [])
            
            # Normalize format
            return [
                {
                    "headline": a.get("headline", ""),
                    "summary_tldr": a.get("summary_tldr", a.get("summary", "")),
                    "sentiment": a.get("sentiment", "neutral"),
                    "source_url": a.get("source_url", a.get("url", "")),
                    "source": a.get("source", ""),
                    "published_at": a.get("published_at", ""),
                    "origin": "alphaboard"
                }
                for a in articles
            ]
        except Exception as e:
            logger.error(f"Error fetching from AlphaBoard: {e}")
            return []
    
    async def _fetch_from_finnhub(self, ticker: str) -> List[Dict[str, Any]]:
        """
        Fetch news from Finnhub API (free tier: 60 calls/min).
        
        Note: Finnhub primarily covers US stocks.
        """
        if not self.finnhub_api_key:
            return []
        
        try:
            client = await self._get_client()
            
            # Finnhub expects US tickers without suffix
            clean_ticker = ticker.replace(".NS", "").replace(".BO", "")
            
            # Get news from last 7 days
            to_date = datetime.now()
            from_date = to_date - timedelta(days=7)
            
            url = f"{FINNHUB_API_BASE}{FINNHUB_NEWS_ENDPOINT}"
            params = {
                "symbol": clean_ticker,
                "from": from_date.strftime("%Y-%m-%d"),
                "to": to_date.strftime("%Y-%m-%d"),
                "token": self.finnhub_api_key
            }
            
            response = await client.get(url, params=params)
            if response.status_code != 200:
                logger.warning(f"Finnhub API error: {response.status_code}")
                return []
            
            data = response.json()
            if not isinstance(data, list):
                return []
            
            # Normalize format
            articles = []
            for item in data[:10]:  # Limit to 10
                articles.append({
                    "headline": item.get("headline", ""),
                    "summary_tldr": item.get("summary", "")[:150],
                    "sentiment": "neutral",  # Finnhub doesn't provide sentiment
                    "source_url": item.get("url", ""),
                    "source": item.get("source", ""),
                    "published_at": datetime.fromtimestamp(item.get("datetime", 0)).isoformat(),
                    "origin": "finnhub"
                })
            
            return articles
            
        except Exception as e:
            logger.error(f"Error fetching from Finnhub: {e}")
            return []
    
    def filter_credible_sources(
        self,
        articles: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Filter articles to only include those from credible sources.
        
        Args:
            articles: List of news articles
            
        Returns:
            Filtered list with only credible sources
        """
        credible = []
        
        for article in articles:
            url = article.get("source_url", "")
            is_credible, source_name, domain = get_source_from_url(url)
            
            if is_credible:
                article["source_name"] = source_name
                article["is_credible"] = True
                credible.append(article)
        
        return credible
    
    @staticmethod
    def is_credible_source(url: str) -> bool:
        """Check if a URL is from a credible news source."""
        is_credible, _, _ = get_source_from_url(url)
        return is_credible
    
    @staticmethod
    def get_source_display_name(url: str) -> str:
        """Get display name for a news source URL."""
        _, source_name, domain = get_source_from_url(url)
        return source_name or domain or "Unknown Source"


# Singleton instance
_news_service: Optional[NewsService] = None


def get_news_service(
    alphaboard_api_url: str = "",
    finnhub_api_key: str = ""
) -> NewsService:
    """Get or create NewsService singleton."""
    global _news_service
    if _news_service is None:
        _news_service = NewsService(
            alphaboard_api_url=alphaboard_api_url,
            finnhub_api_key=finnhub_api_key
        )
    return _news_service



