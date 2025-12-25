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
    # Account Linking Operations
    # =========================================================================
    
    async def generate_link_code(self, whatsapp_user_id: str) -> str:
        """
        Generate a 6-digit code for linking WhatsApp to AlphaBoard account.
        Code expires in 10 minutes.
        
        Args:
            whatsapp_user_id: WhatsApp user ID
            
        Returns:
            6-digit link code
        """
        import random
        import string
        
        try:
            # Generate random 6-digit alphanumeric code (uppercase for readability)
            code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
            
            # Delete any existing unused codes for this user
            self.supabase.table("whatsapp_link_codes") \
                .delete() \
                .eq("whatsapp_user_id", whatsapp_user_id) \
                .is_("used_at", "null") \
                .execute()
            
            # Create new code (expires in 10 minutes)
            expires_at = (datetime.utcnow() + timedelta(minutes=10)).isoformat()
            
            result = self.supabase.table("whatsapp_link_codes") \
                .insert({
                    "whatsapp_user_id": whatsapp_user_id,
                    "code": code,
                    "expires_at": expires_at,
                    "created_at": datetime.utcnow().isoformat()
                }) \
                .execute()
            
            if result.data and len(result.data) > 0:
                logger.info(f"Generated link code for user {whatsapp_user_id}")
                return code
            
            raise AlphaBoardClientError("Failed to generate link code")
            
        except Exception as e:
            logger.error(f"Error generating link code: {e}")
            raise AlphaBoardClientError(f"Database error: {str(e)}")
    
    async def verify_link_code(self, code: str, supabase_user_id: str) -> Dict[str, Any]:
        """
        Verify a link code and connect the accounts.
        Called from AlphaBoard web app when user enters the code.
        
        Args:
            code: 6-digit link code
            supabase_user_id: AlphaBoard/Supabase user ID to link to
            
        Returns:
            Result dict with success status and WhatsApp user info
        """
        try:
            # Find the code (without join since FK was removed)
            result = self.supabase.table("whatsapp_link_codes") \
                .select("*") \
                .eq("code", code.upper()) \
                .is_("used_at", "null") \
                .gte("expires_at", datetime.utcnow().isoformat()) \
                .execute()
            
            if not result.data or len(result.data) == 0:
                return {"success": False, "error": "Invalid or expired code"}
            
            link_record = result.data[0]
            whatsapp_user_id = link_record["whatsapp_user_id"]
            
            # Fetch the WhatsApp user separately
            wa_user_result = self.supabase.table("whatsapp_users") \
                .select("*") \
                .eq("id", whatsapp_user_id) \
                .execute()
            
            wa_user = wa_user_result.data[0] if wa_user_result.data else {}
            
            # Mark code as used
            self.supabase.table("whatsapp_link_codes") \
                .update({
                    "used_at": datetime.utcnow().isoformat(),
                    "linked_supabase_user_id": supabase_user_id
                }) \
                .eq("id", link_record["id"]) \
                .execute()
            
            # Link the WhatsApp user to the Supabase user
            await self.link_supabase_user(whatsapp_user_id, supabase_user_id)
            
            # Sync watchlist and recommendations
            await self.sync_watchlist_to_alphaboard(whatsapp_user_id, supabase_user_id)
            await self.sync_recommendations_to_alphaboard(whatsapp_user_id, supabase_user_id)
            
            logger.info(f"Successfully linked WhatsApp user {whatsapp_user_id} to Supabase user {supabase_user_id}")
            
            return {
                "success": True,
                "whatsapp_user_id": whatsapp_user_id,
                "phone": wa_user.get("phone", "")
            }
            
        except Exception as e:
            logger.error(f"Error verifying link code: {e}")
            raise AlphaBoardClientError(f"Database error: {str(e)}")
    
    async def get_user_account_status(self, whatsapp_user_id: str) -> Dict[str, Any]:
        """
        Get the account linking status for a WhatsApp user.
        
        Args:
            whatsapp_user_id: WhatsApp user ID
            
        Returns:
            Status dict with is_linked, profile info, etc.
        """
        try:
            # Fetch WhatsApp user (without join since FK was removed)
            result = self.supabase.table("whatsapp_users") \
                .select("*") \
                .eq("id", whatsapp_user_id) \
                .execute()
            
            if not result.data or len(result.data) == 0:
                return {"is_linked": False, "user_found": False}
            
            user = result.data[0]
            supabase_user_id = user.get("supabase_user_id")
            is_linked = supabase_user_id is not None and supabase_user_id != ""
            
            # Fetch profile separately if linked
            profile = {}
            if is_linked:
                try:
                    profile_result = self.supabase.table("profiles") \
                        .select("id, username, full_name") \
                        .eq("id", supabase_user_id) \
                        .execute()
                    if profile_result.data and len(profile_result.data) > 0:
                        profile = profile_result.data[0]
                except Exception as profile_err:
                    logger.warning(f"Could not fetch profile: {profile_err}")
            
            return {
                "is_linked": is_linked,
                "user_found": True,
                "whatsapp_user_id": whatsapp_user_id,
                "supabase_user_id": supabase_user_id,
                "username": profile.get("username"),
                "full_name": profile.get("full_name"),
                "phone": user.get("phone")
            }
            
        except Exception as e:
            logger.error(f"Error getting account status: {e}")
            return {"is_linked": False, "error": str(e)}
    
    async def sync_watchlist_to_alphaboard(self, whatsapp_user_id: str, supabase_user_id: str) -> int:
        """
        Sync WhatsApp watchlist items to AlphaBoard recommendations (as WATCH action).
        
        Args:
            whatsapp_user_id: WhatsApp user ID
            supabase_user_id: Supabase/AlphaBoard user ID
            
        Returns:
            Number of items synced
        """
        try:
            # Get WhatsApp watchlist
            watchlist = await self.list_watchlist(whatsapp_user_id)
            
            if not watchlist:
                return 0
            
            synced_count = 0
            for item in watchlist:
                ticker = item["ticker"]
                note = item.get("note", "")
                
                # Check if already exists in AlphaBoard recommendations
                existing = self.supabase.table("recommendations") \
                    .select("id") \
                    .eq("user_id", supabase_user_id) \
                    .eq("ticker", ticker) \
                    .eq("status", "WATCHLIST") \
                    .execute()
                
                if existing.data and len(existing.data) > 0:
                    continue  # Already exists
                
                # Add to AlphaBoard as WATCH item
                rec_data = {
                    "user_id": supabase_user_id,
                    "ticker": ticker,
                    "action": "WATCH",
                    "status": "WATCHLIST",
                    "thesis": f"Added via WhatsApp. {note}" if note else "Added via WhatsApp",
                    "entry_date": datetime.utcnow().isoformat()
                }
                
                self.supabase.table("recommendations").insert(rec_data).execute()
                synced_count += 1
            
            logger.info(f"Synced {synced_count} watchlist items from WhatsApp to AlphaBoard")
            return synced_count
            
        except Exception as e:
            logger.error(f"Error syncing watchlist: {e}")
            return 0
    
    async def sync_recommendations_to_alphaboard(self, whatsapp_user_id: str, supabase_user_id: str) -> int:
        """
        Sync WhatsApp recommendations to AlphaBoard recommendations.
        
        Args:
            whatsapp_user_id: WhatsApp user ID
            supabase_user_id: Supabase/AlphaBoard user ID
            
        Returns:
            Number of recommendations synced
        """
        try:
            # Get WhatsApp recommendations
            recs = await self.list_recent_recommendations(whatsapp_user_id, days=365)
            
            if not recs:
                return 0
            
            synced_count = 0
            for rec in recs:
                ticker = rec["ticker"]
                price = rec.get("price")
                thesis = rec.get("thesis", "")
                
                # Add to AlphaBoard
                rec_data = {
                    "user_id": supabase_user_id,
                    "ticker": ticker,
                    "action": "BUY",
                    "status": "OPEN",
                    "entry_price": price,
                    "thesis": f"{thesis} (via WhatsApp)" if thesis else "Added via WhatsApp",
                    "entry_date": rec.get("created_at", datetime.utcnow().isoformat())
                }
                
                result = self.supabase.table("recommendations").insert(rec_data).execute()
                
                if result.data and len(result.data) > 0:
                    # Link the WhatsApp recommendation to the AlphaBoard recommendation
                    self.supabase.table("whatsapp_recommendations") \
                        .update({"recommendation_id": result.data[0]["id"]}) \
                        .eq("id", rec["id"]) \
                        .execute()
                    synced_count += 1
            
            logger.info(f"Synced {synced_count} recommendations from WhatsApp to AlphaBoard")
            return synced_count
            
        except Exception as e:
            logger.error(f"Error syncing recommendations: {e}")
            return 0
    
    async def get_alphaboard_watchlist(self, supabase_user_id: str) -> List[Dict[str, Any]]:
        """
        Get user's AlphaBoard watchlist (recommendations with WATCHLIST status).
        
        Args:
            supabase_user_id: Supabase/AlphaBoard user ID
            
        Returns:
            List of watchlist items from AlphaBoard
        """
        try:
            result = self.supabase.table("recommendations") \
                .select("*") \
                .eq("user_id", supabase_user_id) \
                .eq("status", "WATCHLIST") \
                .order("entry_date", desc=True) \
                .execute()
            
            return result.data if result.data else []
            
        except Exception as e:
            logger.error(f"Error fetching AlphaBoard watchlist: {e}")
            return []
    
    async def get_alphaboard_recommendations(self, supabase_user_id: str) -> List[Dict[str, Any]]:
        """
        Get user's AlphaBoard recommendations (OPEN status).
        
        Args:
            supabase_user_id: Supabase/AlphaBoard user ID
            
        Returns:
            List of open recommendations from AlphaBoard
        """
        try:
            result = self.supabase.table("recommendations") \
                .select("*") \
                .eq("user_id", supabase_user_id) \
                .eq("status", "OPEN") \
                .order("entry_date", desc=True) \
                .execute()
            
            return result.data if result.data else []
            
        except Exception as e:
            logger.error(f"Error fetching AlphaBoard recommendations: {e}")
            return []
    
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

