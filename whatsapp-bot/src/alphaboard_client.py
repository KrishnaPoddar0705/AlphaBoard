"""
AlphaBoard Client.
Wrapper for AlphaBoard backend API and direct Supabase database operations.
"""

import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from uuid import UUID
import httpx
from supabase import create_client, Client as SupabaseClient

from .config import Settings
from .schemas import (
    WhatsAppUser,
    WatchlistItem,
    WhatsAppRecommendation,
    PodcastRequest
)

logger = logging.getLogger(__name__)


class AlphaBoardClientError(Exception):
    """Custom exception for AlphaBoard client errors."""
    pass


class AlphaBoardClient:
    """
    Client for AlphaBoard backend and Supabase database.
    Handles user management, watchlist, recommendations, and podcast requests.
    """
    
    def __init__(self, settings: Settings):
        """
        Initialize AlphaBoard client.
        
        Args:
            settings: Application settings
        """
        self.api_base_url = settings.ALPHABOARD_API_BASE_URL.rstrip("/")
        self.api_key = settings.ALPHABOARD_API_KEY
        
        # Initialize Supabase client for direct DB access
        self.supabase: SupabaseClient = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_SERVICE_ROLE_KEY
        )
        
        # Initialize HTTP client for AlphaBoard API calls
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["X-API-KEY"] = self.api_key
        
        self._http_client = httpx.AsyncClient(
            timeout=30.0,
            headers=headers
        )
    
    async def close(self):
        """Close the HTTP client."""
        await self._http_client.aclose()
    
    # =========================================================================
    # User Management
    # =========================================================================
    
    async def get_or_create_user_by_phone(self, phone: str) -> Dict[str, Any]:
        """
        Get existing WhatsApp user or create new one by phone number.
        
        Args:
            phone: Phone number in E.164 format (with or without +)
            
        Returns:
            User dict with id, phone, display_name, etc.
        """
        # Normalize phone number (remove + prefix if present)
        normalized_phone = phone.lstrip("+")
        
        try:
            # Try to find existing user
            result = self.supabase.table("whatsapp_users") \
                .select("*") \
                .eq("phone", normalized_phone) \
                .execute()
            
            if result.data and len(result.data) > 0:
                user = result.data[0]
                logger.info(f"Found existing WhatsApp user: {user['id']}")
                
                # Update last_active_at
                self.supabase.table("whatsapp_users") \
                    .update({"last_active_at": datetime.utcnow().isoformat()}) \
                    .eq("id", user["id"]) \
                    .execute()
                
                return user
            
            # Create new user
            new_user_data = {
                "phone": normalized_phone,
                "is_daily_subscriber": True,
                "onboarding_completed": False,
                "created_at": datetime.utcnow().isoformat(),
                "last_active_at": datetime.utcnow().isoformat()
            }
            
            result = self.supabase.table("whatsapp_users") \
                .insert(new_user_data) \
                .execute()
            
            if result.data and len(result.data) > 0:
                user = result.data[0]
                logger.info(f"Created new WhatsApp user: {user['id']}")
                return user
            
            raise AlphaBoardClientError("Failed to create user")
            
        except Exception as e:
            logger.error(f"Error in get_or_create_user_by_phone: {e}")
            raise AlphaBoardClientError(f"Database error: {str(e)}")
    
    async def update_user_display_name(self, user_id: str, display_name: str) -> Dict[str, Any]:
        """
        Update user's display name.
        
        Args:
            user_id: WhatsApp user ID
            display_name: New display name
            
        Returns:
            Updated user dict
        """
        try:
            result = self.supabase.table("whatsapp_users") \
                .update({"display_name": display_name}) \
                .eq("id", user_id) \
                .execute()
            
            if result.data and len(result.data) > 0:
                return result.data[0]
            
            raise AlphaBoardClientError("User not found")
            
        except Exception as e:
            logger.error(f"Error updating user display name: {e}")
            raise AlphaBoardClientError(f"Database error: {str(e)}")
    
    async def link_supabase_user(self, whatsapp_user_id: str, supabase_user_id: str) -> Dict[str, Any]:
        """
        Link WhatsApp user to existing AlphaBoard/Supabase user.
        
        Args:
            whatsapp_user_id: WhatsApp user ID
            supabase_user_id: Supabase/AlphaBoard user ID
            
        Returns:
            Updated user dict
        """
        try:
            result = self.supabase.table("whatsapp_users") \
                .update({
                    "supabase_user_id": supabase_user_id,
                    "onboarding_completed": True
                }) \
                .eq("id", whatsapp_user_id) \
                .execute()
            
            if result.data and len(result.data) > 0:
                return result.data[0]
            
            raise AlphaBoardClientError("User not found")
            
        except Exception as e:
            logger.error(f"Error linking Supabase user: {e}")
            raise AlphaBoardClientError(f"Database error: {str(e)}")
    
    # =========================================================================
    # Watchlist Operations
    # =========================================================================
    
    async def add_to_watchlist(
        self,
        user_id: str,
        ticker: str,
        note: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Add a stock to user's watchlist.
        
        Args:
            user_id: WhatsApp user ID
            ticker: Stock ticker symbol
            note: Optional note about the stock
            
        Returns:
            Created watchlist item dict
        """
        # Normalize ticker
        ticker_upper = ticker.upper().strip()
        
        try:
            # Check if already in watchlist
            existing = self.supabase.table("whatsapp_watchlist") \
                .select("*") \
                .eq("whatsapp_user_id", user_id) \
                .eq("ticker", ticker_upper) \
                .execute()
            
            if existing.data and len(existing.data) > 0:
                # Update existing entry with new note
                result = self.supabase.table("whatsapp_watchlist") \
                    .update({"note": note}) \
                    .eq("id", existing.data[0]["id"]) \
                    .execute()
                return result.data[0] if result.data else existing.data[0]
            
            # Create new watchlist entry
            watchlist_data = {
                "whatsapp_user_id": user_id,
                "ticker": ticker_upper,
                "note": note,
                "created_at": datetime.utcnow().isoformat()
            }
            
            result = self.supabase.table("whatsapp_watchlist") \
                .insert(watchlist_data) \
                .execute()
            
            if result.data and len(result.data) > 0:
                logger.info(f"Added {ticker_upper} to watchlist for user {user_id}")
                return result.data[0]
            
            raise AlphaBoardClientError("Failed to add to watchlist")
            
        except Exception as e:
            logger.error(f"Error adding to watchlist: {e}")
            raise AlphaBoardClientError(f"Database error: {str(e)}")
    
    async def list_watchlist(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Get user's watchlist.
        
        Args:
            user_id: WhatsApp user ID
            
        Returns:
            List of watchlist items
        """
        try:
            result = self.supabase.table("whatsapp_watchlist") \
                .select("*") \
                .eq("whatsapp_user_id", user_id) \
                .order("created_at", desc=True) \
                .execute()
            
            return result.data if result.data else []
            
        except Exception as e:
            logger.error(f"Error fetching watchlist: {e}")
            raise AlphaBoardClientError(f"Database error: {str(e)}")
    
    async def remove_from_watchlist(self, user_id: str, ticker: str) -> bool:
        """
        Remove a stock from user's watchlist.
        
        Args:
            user_id: WhatsApp user ID
            ticker: Stock ticker to remove
            
        Returns:
            True if removed, False if not found
        """
        ticker_upper = ticker.upper().strip()
        
        try:
            result = self.supabase.table("whatsapp_watchlist") \
                .delete() \
                .eq("whatsapp_user_id", user_id) \
                .eq("ticker", ticker_upper) \
                .execute()
            
            return True
            
        except Exception as e:
            logger.error(f"Error removing from watchlist: {e}")
            raise AlphaBoardClientError(f"Database error: {str(e)}")
    
    # =========================================================================
    # Recommendation Operations
    # =========================================================================
    
    async def add_recommendation(
        self,
        user_id: str,
        ticker: str,
        price: Optional[float] = None,
        thesis: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Add a stock recommendation.
        
        Args:
            user_id: WhatsApp user ID
            ticker: Stock ticker symbol
            price: Target/entry price
            thesis: Investment thesis
            
        Returns:
            Created recommendation dict
        """
        ticker_upper = ticker.upper().strip()
        
        try:
            rec_data = {
                "whatsapp_user_id": user_id,
                "ticker": ticker_upper,
                "price": price,
                "thesis": thesis,
                "source": "whatsapp",
                "created_at": datetime.utcnow().isoformat()
            }
            
            result = self.supabase.table("whatsapp_recommendations") \
                .insert(rec_data) \
                .execute()
            
            if result.data and len(result.data) > 0:
                logger.info(f"Added recommendation for {ticker_upper} from user {user_id}")
                return result.data[0]
            
            raise AlphaBoardClientError("Failed to add recommendation")
            
        except Exception as e:
            logger.error(f"Error adding recommendation: {e}")
            raise AlphaBoardClientError(f"Database error: {str(e)}")
    
    async def list_recent_recommendations(
        self,
        user_id: str,
        days: int = 7
    ) -> List[Dict[str, Any]]:
        """
        Get user's recent recommendations.
        
        Args:
            user_id: WhatsApp user ID
            days: Number of days to look back
            
        Returns:
            List of recommendations
        """
        try:
            cutoff = (datetime.utcnow() - timedelta(days=days)).isoformat()
            
            result = self.supabase.table("whatsapp_recommendations") \
                .select("*") \
                .eq("whatsapp_user_id", user_id) \
                .gte("created_at", cutoff) \
                .order("created_at", desc=True) \
                .execute()
            
            return result.data if result.data else []
            
        except Exception as e:
            logger.error(f"Error fetching recommendations: {e}")
            raise AlphaBoardClientError(f"Database error: {str(e)}")
    
    async def admin_list_new_recommendations(self, days: int = 1) -> List[Dict[str, Any]]:
        """
        Admin: Get all new recommendations from all users.
        
        Args:
            days: Number of days to look back
            
        Returns:
            List of recommendations with user info
        """
        try:
            cutoff = (datetime.utcnow() - timedelta(days=days)).isoformat()
            
            result = self.supabase.table("whatsapp_recommendations") \
                .select("*, whatsapp_users(phone, display_name)") \
                .gte("created_at", cutoff) \
                .order("created_at", desc=True) \
                .execute()
            
            return result.data if result.data else []
            
        except Exception as e:
            logger.error(f"Error fetching admin recommendations: {e}")
            raise AlphaBoardClientError(f"Database error: {str(e)}")
    
    # =========================================================================
    # Podcast Operations
    # =========================================================================
    
    async def request_podcast(
        self,
        user_id: str,
        topic: str
    ) -> Dict[str, Any]:
        """
        Create a podcast request.
        
        Args:
            user_id: WhatsApp user ID
            topic: Podcast topic (ticker or theme)
            
        Returns:
            Created podcast request dict
        """
        try:
            request_data = {
                "whatsapp_user_id": user_id,
                "topic": topic,
                "status": "pending",
                "created_at": datetime.utcnow().isoformat()
            }
            
            result = self.supabase.table("whatsapp_podcast_requests") \
                .insert(request_data) \
                .execute()
            
            if result.data and len(result.data) > 0:
                logger.info(f"Created podcast request for '{topic}' from user {user_id}")
                return result.data[0]
            
            raise AlphaBoardClientError("Failed to create podcast request")
            
        except Exception as e:
            logger.error(f"Error creating podcast request: {e}")
            raise AlphaBoardClientError(f"Database error: {str(e)}")
    
    async def generate_podcast_via_api(
        self,
        ticker: str,
        company_name: str
    ) -> Dict[str, Any]:
        """
        Generate podcast via AlphaBoard backend API.
        
        Args:
            ticker: Stock ticker
            company_name: Company name
            
        Returns:
            Podcast response with script and audio
        """
        try:
            url = f"{self.api_base_url}/api/podcast/generate"
            payload = {
                "type": "single-stock",
                "ticker": ticker,
                "companyName": company_name,
                "news": []  # Will fetch news internally
            }
            
            response = await self._http_client.post(url, json=payload)
            
            if response.status_code != 200:
                logger.error(f"Podcast API error: {response.status_code}")
                return {"error": True, "status_code": response.status_code}
            
            return response.json()
            
        except Exception as e:
            logger.error(f"Error calling podcast API: {e}")
            raise AlphaBoardClientError(f"API error: {str(e)}")
    
    # =========================================================================
    # Market Data Operations
    # =========================================================================
    
    async def get_stock_summary(self, ticker: str) -> Dict[str, Any]:
        """
        Get stock summary from AlphaBoard backend.
        
        Args:
            ticker: Stock ticker
            
        Returns:
            Stock summary dict
        """
        try:
            url = f"{self.api_base_url}/market/summary/{ticker}"
            response = await self._http_client.get(url)
            
            if response.status_code != 200:
                logger.error(f"Stock summary API error: {response.status_code}")
                return {}
            
            return response.json()
            
        except Exception as e:
            logger.error(f"Error fetching stock summary: {e}")
            return {}
    
    async def get_stock_price(self, ticker: str) -> Optional[float]:
        """
        Get current stock price.
        
        Args:
            ticker: Stock ticker
            
        Returns:
            Current price or None
        """
        try:
            url = f"{self.api_base_url}/market/price/{ticker}"
            response = await self._http_client.get(url)
            
            if response.status_code != 200:
                return None
            
            data = response.json()
            return data.get("price")
            
        except Exception as e:
            logger.error(f"Error fetching stock price: {e}")
            return None
    
    async def get_news_for_ticker(self, ticker: str) -> List[Dict[str, Any]]:
        """
        Get news for a ticker from AlphaBoard backend.
        
        Args:
            ticker: Stock ticker
            
        Returns:
            List of news articles
        """
        try:
            url = f"{self.api_base_url}/news/{ticker}"
            response = await self._http_client.get(url)
            
            if response.status_code != 200:
                logger.error(f"News API error: {response.status_code}")
                return []
            
            data = response.json()
            return data.get("articles", [])
            
        except Exception as e:
            logger.error(f"Error fetching news: {e}")
            return []
    
    # =========================================================================
    # Daily Subscriber Operations
    # =========================================================================
    
    async def list_daily_subscribed_users(self) -> List[Dict[str, Any]]:
        """
        Get all users subscribed to daily market reports.
        
        Returns:
            List of subscribed users
        """
        try:
            result = self.supabase.table("whatsapp_users") \
                .select("*") \
                .eq("is_daily_subscriber", True) \
                .execute()
            
            return result.data if result.data else []
            
        except Exception as e:
            logger.error(f"Error fetching daily subscribers: {e}")
            raise AlphaBoardClientError(f"Database error: {str(e)}")
    
    async def toggle_daily_subscription(self, user_id: str, subscribe: bool) -> Dict[str, Any]:
        """
        Toggle user's daily subscription status.
        
        Args:
            user_id: WhatsApp user ID
            subscribe: True to subscribe, False to unsubscribe
            
        Returns:
            Updated user dict
        """
        try:
            result = self.supabase.table("whatsapp_users") \
                .update({"is_daily_subscriber": subscribe}) \
                .eq("id", user_id) \
                .execute()
            
            if result.data and len(result.data) > 0:
                return result.data[0]
            
            raise AlphaBoardClientError("User not found")
            
        except Exception as e:
            logger.error(f"Error toggling subscription: {e}")
            raise AlphaBoardClientError(f"Database error: {str(e)}")
    
    # =========================================================================
    # Health Check
    # =========================================================================
    
    async def health_check(self) -> bool:
        """
        Check if AlphaBoard API is accessible.
        
        Returns:
            True if API is healthy, False otherwise
        """
        try:
            url = f"{self.api_base_url}/"
            response = await self._http_client.get(url)
            return response.status_code == 200
        except Exception as e:
            logger.error(f"AlphaBoard health check failed: {e}")
            return False
    
    def database_health_check(self) -> bool:
        """
        Check if Supabase database is accessible.
        
        Returns:
            True if database is healthy, False otherwise
        """
        try:
            result = self.supabase.table("whatsapp_users") \
                .select("id") \
                .limit(1) \
                .execute()
            return True
        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            return False

