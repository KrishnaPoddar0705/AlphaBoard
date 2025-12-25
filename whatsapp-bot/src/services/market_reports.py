"""
Market Report Service.
Builds daily market close summaries and personalized reports.
"""

import logging
from datetime import datetime, date
from typing import List, Dict, Any, Optional
import httpx

from ..config import Settings

logger = logging.getLogger(__name__)


class MarketReportService:
    """
    Service for generating market reports and summaries.
    Fetches data from AlphaBoard backend or external APIs.
    """
    
    # Major Indian indices
    INDICES = {
        "^NSEI": "NIFTY 50",
        "^BSESN": "SENSEX",
        "^NSEBANK": "BANK NIFTY",
        "^NSMIDCP": "NIFTY MIDCAP"
    }
    
    def __init__(self, settings: Settings):
        """
        Initialize market report service.
        
        Args:
            settings: Application settings
        """
        self.settings = settings
        self.api_base_url = settings.ALPHABOARD_API_BASE_URL.rstrip("/")
        
        self._http_client = httpx.AsyncClient(
            timeout=30.0,
            headers={"Content-Type": "application/json"}
        )
    
    async def close(self):
        """Close HTTP client."""
        await self._http_client.aclose()
    
    async def build_daily_summary(
        self,
        tickers: Optional[List[str]] = None
    ) -> str:
        """
        Build daily market close summary.
        
        Args:
            tickers: Optional list of tickers for personalized summary
            
        Returns:
            Formatted summary text for WhatsApp
        """
        try:
            # Fetch index data
            indices_data = await self._fetch_indices_data()
            
            # Fetch top movers
            top_movers = await self._fetch_top_movers()
            
            # Build summary
            summary = self._format_summary(indices_data, top_movers, tickers)
            
            return summary
            
        except Exception as e:
            logger.error(f"Error building daily summary: {e}")
            return self._get_fallback_summary()
    
    async def _fetch_indices_data(self) -> Dict[str, Dict[str, Any]]:
        """
        Fetch data for major indices.
        
        Returns:
            Dict mapping ticker to index data
        """
        indices_data = {}
        
        for ticker, name in self.INDICES.items():
            try:
                url = f"{self.api_base_url}/market/summary/{ticker}"
                response = await self._http_client.get(url)
                
                if response.status_code == 200:
                    data = response.json()
                    indices_data[ticker] = {
                        "name": name,
                        "price": data.get("regularMarketPrice", 0),
                        "change": data.get("regularMarketChange", 0),
                        "change_pct": data.get("regularMarketChangePercent", 0)
                    }
            except Exception as e:
                logger.warning(f"Error fetching {ticker}: {e}")
                continue
        
        return indices_data
    
    async def _fetch_top_movers(self) -> Dict[str, List[Dict[str, Any]]]:
        """
        Fetch top gainers and losers.
        
        Returns:
            Dict with 'gainers' and 'losers' lists
        """
        # For now, return mock data
        # In production, this would fetch from a market data API
        return {
            "gainers": [
                {"ticker": "TCS.NS", "name": "TCS", "change_pct": 2.5},
                {"ticker": "INFY.NS", "name": "Infosys", "change_pct": 1.8},
                {"ticker": "RELIANCE.NS", "name": "Reliance", "change_pct": 1.5}
            ],
            "losers": [
                {"ticker": "HDFC.NS", "name": "HDFC Bank", "change_pct": -1.2},
                {"ticker": "ICICI.NS", "name": "ICICI Bank", "change_pct": -0.9},
                {"ticker": "SBIN.NS", "name": "SBI", "change_pct": -0.7}
            ]
        }
    
    def _format_summary(
        self,
        indices: Dict[str, Dict[str, Any]],
        movers: Dict[str, List[Dict[str, Any]]],
        user_tickers: Optional[List[str]] = None
    ) -> str:
        """
        Format market data into WhatsApp message.
        
        Args:
            indices: Index data
            movers: Top movers data
            user_tickers: Optional user's watchlist tickers
            
        Returns:
            Formatted message string
        """
        today = date.today().strftime("%B %d, %Y")
        
        lines = [
            f"📈 *Market Close Summary*",
            f"_{today}_\n"
        ]
        
        # Format indices
        if indices:
            lines.append("*Major Indices:*")
            for ticker, data in indices.items():
                name = data["name"]
                price = data["price"]
                change_pct = data["change_pct"]
                
                emoji = "🟢" if change_pct >= 0 else "🔴"
                sign = "+" if change_pct >= 0 else ""
                
                lines.append(f"{emoji} {name}: {price:,.0f} ({sign}{change_pct:.1f}%)")
            lines.append("")
        else:
            # Fallback for when API is unavailable
            lines.append("*Indices:* Data unavailable\n")
        
        # Format top movers
        gainers = movers.get("gainers", [])
        losers = movers.get("losers", [])
        
        if gainers:
            gainer_str = ", ".join([
                f"{m['name']} +{m['change_pct']:.1f}%"
                for m in gainers[:3]
            ])
            lines.append(f"🚀 *Top Gainers:* {gainer_str}")
        
        if losers:
            loser_str = ", ".join([
                f"{m['name']} {m['change_pct']:.1f}%"
                for m in losers[:3]
            ])
            lines.append(f"📉 *Top Losers:* {loser_str}")
        
        lines.append("")
        
        # Add market theme/insight
        theme = self._generate_market_theme(indices, movers)
        if theme:
            lines.append(f"💡 *Insight:* {theme}")
            lines.append("")
        
        # Add personalized section if user has watchlist
        if user_tickers:
            lines.append(f"📋 _Your watchlist has {len(user_tickers)} stocks_")
            lines.append("Reply `my watchlist` to see performance")
        
        lines.append("\n---")
        lines.append("_Reply `menu` for more options_")
        
        return "\n".join(lines)
    
    def _generate_market_theme(
        self,
        indices: Dict[str, Dict[str, Any]],
        movers: Dict[str, List[Dict[str, Any]]]
    ) -> str:
        """
        Generate a brief market theme/insight.
        
        Args:
            indices: Index data
            movers: Top movers data
            
        Returns:
            Theme string
        """
        if not indices:
            return "Market data being updated."
        
        # Calculate overall market sentiment
        changes = [d.get("change_pct", 0) for d in indices.values()]
        avg_change = sum(changes) / len(changes) if changes else 0
        
        if avg_change > 1:
            return "Strong bullish momentum across indices. IT and financials leading the rally."
        elif avg_change > 0:
            return "Markets ended positive with selective buying. Broad-based participation seen."
        elif avg_change > -1:
            return "Markets ended flat to negative. Profit booking seen at higher levels."
        else:
            return "Bearish sentiment prevailed. Global cues and FII outflows weighed on markets."
    
    def _get_fallback_summary(self) -> str:
        """
        Get fallback summary when API is unavailable.
        
        Returns:
            Fallback message string
        """
        today = date.today().strftime("%B %d, %Y")
        
        return f"""📈 *Market Close Summary*
_{today}_

⚠️ Market data is currently being updated.

Please try again in a few minutes, or check:
• `news NIFTY` for latest market news
• `TCS` to check individual stocks

---
_Reply `menu` for more options_"""
    
    async def build_personalized_summary(
        self,
        user_id: str,
        watchlist: List[Dict[str, Any]]
    ) -> str:
        """
        Build personalized summary for a user's watchlist.
        
        Args:
            user_id: User ID
            watchlist: User's watchlist items
            
        Returns:
            Personalized summary message
        """
        if not watchlist:
            return await self.build_daily_summary()
        
        tickers = [item["ticker"] for item in watchlist]
        
        # Get base summary
        base_summary = await self.build_daily_summary(tickers)
        
        # Add watchlist performance
        watchlist_lines = ["\n📋 *Your Watchlist:*"]
        
        for item in watchlist[:5]:
            ticker = item["ticker"]
            try:
                url = f"{self.api_base_url}/market/price/{ticker}"
                response = await self._http_client.get(url)
                
                if response.status_code == 200:
                    data = response.json()
                    price = data.get("price", 0)
                    watchlist_lines.append(f"• {ticker}: ₹{price:,.2f}")
            except:
                watchlist_lines.append(f"• {ticker}: --")
        
        if len(watchlist) > 5:
            watchlist_lines.append(f"_...and {len(watchlist) - 5} more_")
        
        return base_summary + "\n".join(watchlist_lines)
    
    def get_template_components(
        self,
        summary: str
    ) -> List[Dict[str, Any]]:
        """
        Get WhatsApp template components for daily summary.
        
        Args:
            summary: Summary text
            
        Returns:
            List of template components for WhatsApp API
        """
        today = date.today().strftime("%B %d")
        
        # Extract key metrics for template variables
        # This assumes a simple template with date and headline
        return [
            {
                "type": "body",
                "parameters": [
                    {
                        "type": "text",
                        "text": today
                    },
                    {
                        "type": "text",
                        "text": "Markets closed positive. Check your watchlist!"
                    }
                ]
            }
        ]

