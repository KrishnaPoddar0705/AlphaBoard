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

from .config import Settings, get_source_from_url
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
        
        # Initialize HTTP client for AlphaBoard API calls FIRST (before Supabase)
        # This ensures it's always available even if Supabase init fails
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["X-API-KEY"] = self.api_key
        
        self._http_client = httpx.AsyncClient(
            timeout=30.0,
            headers=headers
        )
        
        # Initialize Supabase client for direct DB access
        # Using service role key to bypass RLS
        service_key = settings.SUPABASE_SERVICE_ROLE_KEY
        self._service_key = service_key  # Store for later use in queries
        
        # Debug: Log key status (only first 10 chars for security)
        if service_key:
            key_prefix = service_key[:15] if len(service_key) > 15 else "TOO_SHORT"
            key_length = len(service_key)
            logger.info(f"Supabase key loaded: {key_prefix}... (length: {key_length})")
            
            # Both formats are valid:
            # - Legacy JWT: starts with 'eyJ'
            # - New secret: starts with 'sb_secret_'
            if service_key.startswith("eyJ"):
                logger.info("Using legacy JWT format for Supabase key")
            elif service_key.startswith("sb_secret_"):
                logger.info("Using new secret API key format for Supabase")
            else:
                logger.warning("SUPABASE_SERVICE_ROLE_KEY format not recognized. Expected 'eyJ...' or 'sb_secret_...'")
        else:
            logger.error("SUPABASE_SERVICE_ROLE_KEY is not set!")
            raise ValueError("SUPABASE_SERVICE_ROLE_KEY must be set")
        
        # Create Supabase client
        # The Python client should automatically handle both JWT and new secret key formats
        try:
            # Create the client first
        self.supabase: SupabaseClient = create_client(
            settings.SUPABASE_URL,
            service_key
        )
        
            # For new secret key format, we MUST manually set apikey header
            # The Supabase Python client doesn't automatically set it for sb_secret_ format
            if service_key.startswith("sb_secret_"):
                logger.info("New secret key format detected - patching headers")
                self._patch_supabase_headers(service_key)
            
            # Test the connection by making a simple query
            try:
                test_result = self.supabase.table("profiles").select("id").limit(1).execute()
                if test_result.data is not None:
                    logger.info("Supabase client initialized and connection verified")
                else:
                    logger.warning("Supabase client initialized but test query returned no data")
            except Exception as test_error:
                error_str = str(test_error).lower()
                if "apikey" in error_str or "api key" in error_str:
                    logger.error("API key error during connection test - attempting to patch headers")
                    # Try to patch headers as fallback
                    self._patch_supabase_headers(service_key)
                    # Retry test
                    try:
                        test_result = self.supabase.table("profiles").select("id").limit(1).execute()
                        if test_result.data is not None:
                            logger.info("Supabase client verified after header patch")
                    except Exception as retry_error:
                        logger.error(f"Still failing after header patch: {retry_error}")
                else:
                    logger.warning(f"Connection test failed: {test_error}")
                
        except Exception as e:
            logger.error(f"Failed to initialize Supabase client: {e}", exc_info=True)
            # Re-raise to prevent silent failures
            raise AlphaBoardClientError(f"Failed to initialize Supabase client: {str(e)}")
    
    def _patch_supabase_headers(self, service_key: str) -> None:
        """Patch Supabase client headers to ensure apikey is set for new secret format."""
        try:
            # The Supabase Python client uses postgrest-py under the hood
            # We need to patch the session headers at the right level
            if hasattr(self.supabase, 'rest'):
                rest_client = self.supabase.rest
                
                # Try multiple paths to access the underlying HTTP session
                patched = False
                
                # Path 1: rest.postgrest.session.headers
                if hasattr(rest_client, 'postgrest'):
                    postgrest = rest_client.postgrest
                    if hasattr(postgrest, 'session'):
                        session = postgrest.session
                        if hasattr(session, 'headers'):
                            session.headers['apikey'] = service_key
                            session.headers['Authorization'] = f'Bearer {service_key}'
                            logger.info("✅ Patched headers via rest.postgrest.session.headers")
                            patched = True
                
                # Path 2: rest.headers (direct)
                if not patched and hasattr(rest_client, 'headers'):
                    rest_client.headers['apikey'] = service_key
                    rest_client.headers['Authorization'] = f'Bearer {service_key}'
                    logger.info("✅ Patched headers via rest.headers")
                    patched = True
                
                # Path 3: rest.session.headers
                if not patched and hasattr(rest_client, 'session'):
                    session = rest_client.session
                    if hasattr(session, 'headers'):
                        session.headers['apikey'] = service_key
                        session.headers['Authorization'] = f'Bearer {service_key}'
                        logger.info("✅ Patched headers via rest.session.headers")
                        patched = True
                
                if not patched:
                    logger.warning("⚠️ Could not find headers to patch - may need to update Supabase client")
                    # Try to monkey-patch the table method as fallback
                    self._monkey_patch_table_method(service_key)
            else:
                logger.warning("⚠️ Supabase client has no 'rest' attribute")
                self._monkey_patch_table_method(service_key)
                
        except Exception as patch_error:
            logger.error(f"❌ Error patching Supabase headers: {patch_error}", exc_info=True)
            # Fallback to monkey-patching
            self._monkey_patch_table_method(service_key)
    
    def _monkey_patch_table_method(self, service_key: str) -> None:
        """Monkey-patch the table method to ensure headers on each request."""
        try:
            original_table = self.supabase.table
            
            def patched_table(table_name: str):
                table = original_table(table_name)
                # Store original execute if it exists
                if hasattr(table, 'execute'):
                    original_execute = table.execute
                    
                    def execute_with_headers(*args, **kwargs):
                        # Ensure headers are set before each execute
                        self._ensure_headers_set(service_key)
                        return original_execute(*args, **kwargs)
                    
                    table.execute = execute_with_headers
                
                return table
            
            self.supabase.table = patched_table
            logger.info("✅ Monkey-patched table method to ensure headers on each request")
        except Exception as e:
            logger.error(f"❌ Failed to monkey-patch table method: {e}")
    
    def _ensure_headers_set(self, service_key: str) -> None:
        """Ensure headers are set on the Supabase client before making requests."""
        try:
            if hasattr(self.supabase, 'rest'):
                rest_client = self.supabase.rest
                # Try postgrest path first (most common)
                if hasattr(rest_client, 'postgrest'):
                    postgrest = rest_client.postgrest
                    if hasattr(postgrest, 'session'):
                        session = postgrest.session
                        if hasattr(session, 'headers'):
                            session.headers['apikey'] = service_key
                            session.headers['Authorization'] = f'Bearer {service_key}'
                            return
                # Fallback to direct headers
                if hasattr(rest_client, 'headers'):
                    rest_client.headers['apikey'] = service_key
                    rest_client.headers['Authorization'] = f'Bearer {service_key}'
        except Exception:
            pass  # Silently fail if we can't set headers
    
    async def close(self):
        """Close the HTTP client."""
        if hasattr(self, '_http_client') and self._http_client:
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
            # Need to translate Clerk ID to Supabase UUID first
            profile = {}
            if is_linked:
                try:
                    # Look up Supabase UUID from clerk_user_mapping
                    actual_user_id = await self._get_supabase_uuid(supabase_user_id)
                    if actual_user_id:
                        profile_result = self.supabase.table("profiles") \
                            .select("id, username, full_name") \
                            .eq("id", actual_user_id) \
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
            supabase_user_id: Clerk user ID (will be translated to Supabase UUID)
            
        Returns:
            Number of items synced
        """
        try:
            # Translate Clerk user ID to Supabase UUID
            actual_user_id = await self._get_supabase_uuid(supabase_user_id)
            if not actual_user_id:
                logger.warning(f"Cannot sync watchlist: No Supabase UUID found for Clerk user ID: {supabase_user_id}")
                return 0
            
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
                    .eq("user_id", actual_user_id) \
                    .eq("ticker", ticker) \
                    .eq("status", "WATCHLIST") \
                    .execute()
                
                if existing.data and len(existing.data) > 0:
                    continue  # Already exists
                
                # Add to AlphaBoard as WATCH item
                rec_data = {
                    "user_id": actual_user_id,
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
            supabase_user_id: Clerk user ID (will be translated to Supabase UUID)
            
        Returns:
            Number of recommendations synced
        """
        try:
            # Translate Clerk user ID to Supabase UUID
            actual_user_id = await self._get_supabase_uuid(supabase_user_id)
            if not actual_user_id:
                logger.warning(f"Cannot sync recommendations: No Supabase UUID found for Clerk user ID: {supabase_user_id}")
                return 0
            
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
                    "user_id": actual_user_id,
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
            supabase_user_id: Clerk user ID (will be translated to Supabase UUID)
            
        Returns:
            List of watchlist items from AlphaBoard
        """
        try:
            # First, translate Clerk user ID to Supabase UUID via clerk_user_mapping
            actual_user_id = await self._get_supabase_uuid(supabase_user_id)
            if not actual_user_id:
                logger.warning(f"No Supabase UUID found for Clerk user ID: {supabase_user_id}")
                return []
            
            result = self.supabase.table("recommendations") \
                .select("*") \
                .eq("user_id", actual_user_id) \
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
            supabase_user_id: Clerk user ID (will be translated to Supabase UUID)
            
        Returns:
            List of open recommendations from AlphaBoard
        """
        try:
            # First, translate Clerk user ID to Supabase UUID via clerk_user_mapping
            actual_user_id = await self._get_supabase_uuid(supabase_user_id)
            if not actual_user_id:
                logger.warning(f"No Supabase UUID found for Clerk user ID: {supabase_user_id}")
                return []
            
            result = self.supabase.table("recommendations") \
                .select("*") \
                .eq("user_id", actual_user_id) \
                .eq("status", "OPEN") \
                .order("entry_date", desc=True) \
                .execute()
            
            return result.data if result.data else []
            
        except Exception as e:
            logger.error(f"Error fetching AlphaBoard recommendations: {e}")
            return []
    
    async def get_alphaboard_closed_recommendations(self, supabase_user_id: str) -> List[Dict[str, Any]]:
        """
        Get user's closed AlphaBoard recommendations (History).
        
        Args:
            supabase_user_id: Clerk user ID (will be translated to Supabase UUID)
            
        Returns:
            List of closed recommendations from AlphaBoard
        """
        try:
            actual_user_id = await self._get_supabase_uuid(supabase_user_id)
            if not actual_user_id:
                return []
            
            result = self.supabase.table("recommendations") \
                .select("*") \
                .eq("user_id", actual_user_id) \
                .eq("status", "CLOSED") \
                .order("exit_date", desc=True) \
                .limit(20) \
                .execute()
            
            return result.data if result.data else []
            
        except Exception as e:
            logger.error(f"Error fetching closed recommendations: {e}")
            return []
    
    async def _get_supabase_uuid(self, clerk_user_id: str) -> Optional[str]:
        """
        Translate a Clerk user ID to the corresponding Supabase UUID.
        
        Args:
            clerk_user_id: Clerk user ID (e.g., 'user_36bj63lgP94TGXgDg0DnkW7qvOx')
            
        Returns:
            Supabase UUID string or None if not found
        """
        try:
            result = self.supabase.table("clerk_user_mapping") \
                .select("supabase_user_id") \
                .eq("clerk_user_id", clerk_user_id) \
                .limit(1) \
                .execute()
            
            if result.data and len(result.data) > 0:
                return result.data[0].get("supabase_user_id")
            
            logger.warning(f"No clerk_user_mapping found for Clerk ID: {clerk_user_id}")
            return None
            
        except Exception as e:
            logger.error(f"Error looking up Supabase UUID for Clerk ID {clerk_user_id}: {e}")
            return None
    
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
        thesis: Optional[str] = None,
        action: str = "BUY"
    ) -> Dict[str, Any]:
        """
        Add a stock recommendation. Syncs to public.recommendations if user is linked.
        
        Args:
            user_id: WhatsApp user ID
            ticker: Stock ticker symbol
            price: Entry price
            thesis: Investment thesis
            action: BUY, SELL, or WATCH
            
        Returns:
            Dict with recommendation data and sync status
        """
        ticker_upper = ticker.upper().strip()
        action_upper = action.upper().strip()
        
        # Validate action
        if action_upper not in ("BUY", "SELL", "WATCH"):
            action_upper = "BUY"
        
        # Map action to status for public.recommendations
        status = "WATCHLIST" if action_upper == "WATCH" else "OPEN"
        
        try:
            # 1. Add to whatsapp_recommendations table
            wa_rec_data = {
                "whatsapp_user_id": user_id,
                "ticker": ticker_upper,
                "price": price,
                "thesis": thesis,
                "action": action_upper,
                "source": "whatsapp",
                "created_at": datetime.utcnow().isoformat()
            }
            
            wa_result = self.supabase.table("whatsapp_recommendations") \
                .insert(wa_rec_data) \
                .execute()
            
            if not wa_result.data or len(wa_result.data) == 0:
                raise AlphaBoardClientError("Failed to add to WhatsApp recommendations")
            
            wa_rec = wa_result.data[0]
            synced_to_app = False
            
            # 2. Check if user is linked and sync to public.recommendations
            account_status = await self.get_user_account_status(user_id)
            
            if account_status.get("is_linked") and account_status.get("supabase_user_id"):
                clerk_user_id = account_status["supabase_user_id"]
                
                # Get Supabase UUID
                actual_user_id = await self._get_supabase_uuid(clerk_user_id)
                
                if actual_user_id:
                    try:
                        # Add to public.recommendations
                        pub_rec_data = {
                            "user_id": actual_user_id,
                            "ticker": ticker_upper,
                            "action": action_upper,
                            "entry_price": price,
                            "status": status,
                            "thesis": thesis if thesis else None,
                            "entry_date": datetime.utcnow().isoformat()
                        }
                        
                        pub_result = self.supabase.table("recommendations") \
                            .insert(pub_rec_data) \
                            .execute()
                        
                        if pub_result.data and len(pub_result.data) > 0:
                            # Link WhatsApp rec to public rec
                            self.supabase.table("whatsapp_recommendations") \
                                .update({"recommendation_id": pub_result.data[0]["id"]}) \
                                .eq("id", wa_rec["id"]) \
                                .execute()
                            synced_to_app = True
                            logger.info(f"Synced recommendation {ticker_upper} to public.recommendations")
                    except Exception as sync_error:
                        logger.warning(f"Could not sync to public.recommendations: {sync_error}")
            
            logger.info(f"Added recommendation for {ticker_upper} from user {user_id} (synced: {synced_to_app})")
            return {
                **wa_rec,
                "synced_to_app": synced_to_app
            }
            
        except AlphaBoardClientError:
            raise
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
            # First, fetch news for the ticker (required for podcast generation)
            news = await self.get_news_for_ticker(ticker)
            
            if not news:
                # Try fetching from database directly as fallback
                # Try different ticker formats (.NS, .BO, base)
                ticker_variants = [ticker]
                base_ticker = ticker.replace('.NS', '').replace('.BO', '')
                if not ticker.endswith('.NS'):
                    ticker_variants.append(f"{base_ticker}.NS")
                if not ticker.endswith('.BO'):
                    ticker_variants.append(f"{base_ticker}.BO")
                if base_ticker != ticker:
                    ticker_variants.append(base_ticker)
                
                try:
                    result = self.supabase.table("news_articles") \
                        .select("*") \
                        .in_("ticker", ticker_variants) \
                        .order("published_at", desc=True) \
                        .limit(10) \
                        .execute()
                    news = result.data if result.data else []
                except Exception as e:
                    logger.warning(f"Could not fetch news from DB: {e}")
            
            if not news:
                logger.warning(f"No news found for {ticker}, podcast may be limited")
                # Create a minimal news item so API doesn't fail
                news = [{
                    "headline": f"Latest updates on {company_name}",
                    "summary_tldr": f"Recent market activity for {ticker}",
                    "published_at": datetime.utcnow().isoformat(),
                    "sentiment": "neutral"
                }]
            
            url = f"{self.api_base_url}/api/podcast/generate"
            payload = {
                "type": "single-stock",
                "ticker": ticker,
                "companyName": company_name,
                "news": news
            }
            
            logger.info(f"Generating podcast for {ticker} with {len(news)} news articles")
            
            response = await self._http_client.post(url, json=payload, timeout=60.0)
            
            if response.status_code != 200:
                logger.error(f"Podcast API error: {response.status_code}, response: {response.text}")
                return {"error": True, "status_code": response.status_code, "detail": response.text}
            
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
    # Price Alert Operations
    # =========================================================================
    
    async def create_price_alert(
        self,
        whatsapp_user_id: str,
        ticker: str,
        alert_type: str,
        trigger_price: float,
        message: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create a price alert trigger for a stock.
        
        Args:
            whatsapp_user_id: WhatsApp user ID
            ticker: Stock ticker
            alert_type: 'above'/'SELL' or 'below'/'BUY'
            trigger_price: Price at which to trigger alert
            message: Optional custom message (not used in triggers table)
            
        Returns:
            Created alert dict with sync status
        """
        ticker_upper = ticker.upper().strip()
        alert_type_input = alert_type.lower()
        
        # Convert to BUY/SELL format
        # below = BUY (alert when price drops below - good time to buy)
        # above = SELL (alert when price rises above - good time to sell)
        if alert_type_input in ("below", "buy"):
            db_alert_type = "BUY"
        elif alert_type_input in ("above", "sell"):
            db_alert_type = "SELL"
        else:
            db_alert_type = "BUY"  # Default to BUY
        
        try:
            result = {"synced_to_app": False, "ticker": ticker_upper, "alert_type": db_alert_type}
            
            # Check if user is linked
            account_status = await self.get_user_account_status(whatsapp_user_id)
            
            if account_status.get("is_linked") and account_status.get("supabase_user_id"):
                clerk_user_id = account_status["supabase_user_id"]
                actual_user_id = await self._get_supabase_uuid(clerk_user_id)
                
                if actual_user_id:
                    # First, find or create a WATCHLIST recommendation for this ticker
                    rec_result = self.supabase.table("recommendations") \
                        .select("id") \
                        .eq("user_id", actual_user_id) \
                        .eq("ticker", ticker_upper) \
                        .eq("status", "WATCHLIST") \
                        .limit(1) \
                        .execute()
                    
                    recommendation_id = None
                    if rec_result.data and len(rec_result.data) > 0:
                        recommendation_id = rec_result.data[0]["id"]
                    else:
                        # Create a WATCHLIST entry
                        new_rec = self.supabase.table("recommendations") \
                            .insert({
                                "user_id": actual_user_id,
                                "ticker": ticker_upper,
                                "action": "WATCH",
                                "status": "WATCHLIST",
                                "entry_date": datetime.utcnow().isoformat()
                            }) \
                            .execute()
                        if new_rec.data and len(new_rec.data) > 0:
                            recommendation_id = new_rec.data[0]["id"]
                    
                    if recommendation_id:
                        # Create alert in public.price_alert_triggers
                        alert_data = {
                            "user_id": actual_user_id,
                            "recommendation_id": recommendation_id,
                            "ticker": ticker_upper,
                            "alert_type": db_alert_type,
                            "trigger_price": trigger_price,
                            "is_active": True
                        }
                        
                        alert_result = self.supabase.table("price_alert_triggers") \
                            .insert(alert_data) \
                            .execute()
                        
                        if alert_result.data and len(alert_result.data) > 0:
                            result["synced_to_app"] = True
                            result["alert_id"] = alert_result.data[0].get("id")
                            result["recommendation_id"] = recommendation_id
                            logger.info(f"Created price alert for {ticker_upper} {db_alert_type} {trigger_price}")
            
            if not result.get("synced_to_app"):
                logger.warning(f"Could not sync price alert - user not linked")
            
            return result
            
        except Exception as e:
            logger.error(f"Error creating price alert: {e}")
            raise AlphaBoardClientError(f"Database error: {str(e)}")
    
    async def get_user_price_alerts(self, whatsapp_user_id: str) -> List[Dict[str, Any]]:
        """
        Get all active price alert triggers for a user.
        
        Args:
            whatsapp_user_id: WhatsApp user ID
            
        Returns:
            List of price alert triggers
        """
        try:
            account_status = await self.get_user_account_status(whatsapp_user_id)
            
            if not account_status.get("is_linked") or not account_status.get("supabase_user_id"):
                return []
            
            clerk_user_id = account_status["supabase_user_id"]
            actual_user_id = await self._get_supabase_uuid(clerk_user_id)
            
            if not actual_user_id:
                return []
            
            # Fetch from price_alert_triggers (user-set alerts)
            result = self.supabase.table("price_alert_triggers") \
                .select("*") \
                .eq("user_id", actual_user_id) \
                .eq("is_active", True) \
                .order("created_at", desc=True) \
                .execute()
            
            return result.data if result.data else []
            
        except Exception as e:
            logger.error(f"Error fetching price alerts: {e}")
            return []
    
    # =========================================================================
    # Admin Operations (Organization/Team Tracking)
    # =========================================================================
    
    async def check_user_is_admin(self, whatsapp_user_id: str) -> Dict[str, Any]:
        """
        Check if the linked user has admin/manager role in their organization.
        
        Args:
            whatsapp_user_id: WhatsApp user ID
            
        Returns:
            Dict with is_admin, organization_id, role
        """
        try:
            account_status = await self.get_user_account_status(whatsapp_user_id)
            
            if not account_status.get("is_linked") or not account_status.get("supabase_user_id"):
                return {"is_admin": False, "reason": "Account not linked"}
            
            clerk_user_id = account_status["supabase_user_id"]
            actual_user_id = await self._get_supabase_uuid(clerk_user_id)
            
            if not actual_user_id:
                return {"is_admin": False, "reason": "User not found"}
            
            # First check user_organization_membership (source of truth for org membership)
            membership_result = self.supabase.table("user_organization_membership") \
                .select("organization_id, role") \
                .eq("user_id", actual_user_id) \
                .limit(1) \
                .execute()
            
            org_id = None
            membership_role = None
            is_org_admin = False
            
            if membership_result.data and len(membership_result.data) > 0:
                membership = membership_result.data[0]
                org_id = membership.get("organization_id")
                membership_role = membership.get("role")
                is_org_admin = membership_role == "admin"
            
            # Get user's profile for additional info
            profile_result = self.supabase.table("profiles") \
                .select("id, username, role, organization_id") \
                .eq("id", actual_user_id) \
                    .limit(1) \
                    .execute()
                
            profile = {}
            profile_role = "analyst"
            if profile_result.data and len(profile_result.data) > 0:
                profile = profile_result.data[0]
                profile_role = profile.get("role", "analyst")
                # Sync organization_id to profile if it's missing but exists in membership
                if not profile.get("organization_id") and org_id:
                    try:
                        self.supabase.table("profiles") \
                            .update({"organization_id": org_id}) \
                            .eq("id", actual_user_id) \
                            .execute()
                        logger.info(f"Synced organization_id {org_id} to profile for user {actual_user_id}")
                    except Exception as sync_err:
                        logger.warning(f"Could not sync organization_id to profile: {sync_err}")
            
            # Admin = manager role in profile OR admin role in membership
            is_admin = profile_role == "manager" or is_org_admin
            
            # Use org_id from membership if available, fallback to profile
            if not org_id:
                org_id = profile.get("organization_id")
            
            return {
                "is_admin": is_admin,
                "role": membership_role or profile_role,
                "organization_id": org_id,
                "user_id": actual_user_id,
                "username": profile.get("username")
            }
            
        except Exception as e:
            logger.error(f"Error checking admin status: {e}")
            return {"is_admin": False, "reason": str(e)}
    
    async def get_organization_teams(self, organization_id: str) -> List[Dict[str, Any]]:
        """
        Get all teams in an organization.
        
        Args:
            organization_id: Organization UUID
            
        Returns:
            List of teams
        """
        try:
            result = self.supabase.table("teams") \
                .select("id, name") \
                .eq("org_id", organization_id) \
                .order("name") \
                .execute()
            
            return result.data if result.data else []
            
        except Exception as e:
            logger.error(f"Error fetching teams: {e}")
            return []
    
    async def get_team_members(self, team_id: str) -> List[Dict[str, Any]]:
        """
        Get all members of a team with their profiles.
        
        Args:
            team_id: Team UUID
            
        Returns:
            List of team members with profile info
        """
        try:
            # Get team memberships
            tm_result = self.supabase.table("team_members") \
                .select("user_id") \
                .eq("team_id", team_id) \
                .execute()
            
            if not tm_result.data:
                return []
            
            user_ids = [m["user_id"] for m in tm_result.data]
            
            # Get profiles for these users
            profiles_result = self.supabase.table("profiles") \
                .select("id, username, full_name, role") \
                .in_("id", user_ids) \
                .execute()
            
            members = []
            if profiles_result.data:
                for profile in profiles_result.data:
                    members.append({
                        "user_id": profile.get("id"),
                        "role": profile.get("role", "analyst"),
                        "username": profile.get("username"),
                        "full_name": profile.get("full_name")
                    })
            
            return members
            
        except Exception as e:
            logger.error(f"Error fetching team members: {e}")
            return []
    
    async def get_organization_members(self, organization_id: str) -> List[Dict[str, Any]]:
        """
        Get all members of an organization.
        
        Args:
            organization_id: Organization UUID
            
        Returns:
            List of organization members
        """
        try:
            # Get members from user_organization_membership (source of truth)
            membership_result = self.supabase.table("user_organization_membership") \
                .select("user_id, role") \
                .eq("organization_id", organization_id) \
                .execute()
            
            if not membership_result.data:
                return []
            
            # Get user IDs
            user_ids = [m["user_id"] for m in membership_result.data]
            
            # Get profiles for these users
            profiles_result = self.supabase.table("profiles") \
                .select("id, username, full_name, role") \
                .in_("id", user_ids) \
                .order("username") \
                .execute()
            
            # Combine membership role with profile data
            members = []
            if profiles_result.data:
                # Create a map of user_id -> membership_role
                role_map = {m["user_id"]: m.get("role", "analyst") for m in membership_result.data}
                
                for profile in profiles_result.data:
                    user_id = profile.get("id")
                    # Use membership role if available, otherwise profile role
                    member_role = role_map.get(user_id, profile.get("role", "analyst"))
                    members.append({
                        "id": user_id,
                        "user_id": user_id,  # Add for consistency with other methods
                        "username": profile.get("username"),
                        "full_name": profile.get("full_name"),
                        "role": member_role
                    })
            
            return members
            
        except Exception as e:
            logger.error(f"Error fetching organization members: {e}")
            return []
    
    async def get_analyst_recommendations_detailed(
        self,
        analyst_user_id: str,
        status: str = "OPEN"
    ) -> List[Dict[str, Any]]:
        """
        Get detailed recommendations for an analyst with all fields.
        
        Args:
            analyst_user_id: Analyst's Supabase UUID
            status: OPEN, CLOSED, or WATCHLIST
            
        Returns:
            List of recommendations with full details
        """
        try:
            logger.info(f"Fetching recommendations for analyst {analyst_user_id} with status filter: {status}")
            
            # First verify the analyst exists
            profile_check = self.supabase.table("profiles") \
                .select("id, username") \
                .eq("id", analyst_user_id) \
                .limit(1) \
                .execute()
            
            if not profile_check.data or len(profile_check.data) == 0:
                logger.warning(f"Analyst {analyst_user_id} not found in profiles table")
                return []
            
            logger.info(f"Found analyst profile: {profile_check.data[0].get('username')}")
            
            # Build query with explicit error handling - DIRECT query to public.recommendations
            result = None
            try:
                # Store service_key for header patching
                service_key = getattr(self, '_service_key', None)
                if not service_key:
                    # Try to get it from settings if available
                    from .config import get_settings
                    try:
                        settings = get_settings()
                        service_key = settings.SUPABASE_SERVICE_ROLE_KEY
                        self._service_key = service_key  # Cache it
                    except:
                        pass
                
                # CRITICAL: Ensure headers are set before EVERY query (for new secret format)
                if service_key and service_key.startswith("sb_secret_"):
                    self._ensure_headers_set(service_key)
                    logger.info("Headers ensured before recommendations query")
                
                # Direct query to public.recommendations table
                logger.info(f"Querying public.recommendations table for user_id={analyst_user_id}, status={status}")
                
                # Build query step by step for better debugging
                base_query = self.supabase.table("recommendations")
                select_query = base_query.select("*")
                user_query = select_query.eq("user_id", analyst_user_id)
                
                # Apply status filter if provided
                if status:
                    filtered_query = user_query.eq("status", status)
                    logger.info(f"Filtering by status: {status}")
                    ordered_query = filtered_query.order("entry_date", desc=True)
                else:
                    logger.info("No status filter - fetching all recommendations")
                    ordered_query = user_query.order("entry_date", desc=True)
                
                # Limit results
                final_query = ordered_query.limit(50)
                
                # Execute query
                logger.info(f"Executing query: recommendations WHERE user_id={analyst_user_id} AND status={status if status else 'ALL'}")
                result = final_query.execute()
                
                # Log result
                if result.data:
                    logger.info(f"✅ Query executed successfully, got {len(result.data)} recommendations")
                    # Log sample data for debugging
                    if len(result.data) > 0:
                        sample = result.data[0]
                        logger.info(f"Sample recommendation: ticker={sample.get('ticker')}, status={sample.get('status')}, user_id={sample.get('user_id')}")
                else:
                    logger.warning(f"⚠️ Query executed but returned no data")
                
                # Check for errors in the response
                if hasattr(result, 'error') and result.error:
                    logger.error(f"Supabase query error: {result.error}")
                    error_msg = str(result.error)
                    if "apikey" in error_msg.lower() or "api key" in error_msg.lower():
                        logger.error("API key error detected - ensuring headers are set")
                        self._ensure_headers_set(service_key)
                        # Retry query
                        result = query.limit(50).execute()
                    else:
                        return []
                
                logger.info(f"Query returned {len(result.data) if result.data else 0} recommendations")
                
            except Exception as query_error:
                logger.error(f"Error executing recommendations query: {query_error}", exc_info=True)
                error_str = str(query_error).lower()
                if "apikey" in error_str or "api key" in error_str:
                    logger.error("API key authentication failed - ensuring headers are set and retrying")
                    self._ensure_headers_set(service_key)
                    try:
                        # Retry with headers set
            query = self.supabase.table("recommendations") \
                .select("*") \
                .eq("user_id", analyst_user_id) \
                .order("entry_date", desc=True)
            if status:
                query = query.eq("status", status)
                        result = query.limit(50).execute()
                        logger.info(f"Retry query returned {len(result.data) if result.data else 0} recommendations")
                    except Exception as retry_error:
                        logger.error(f"Retry also failed: {retry_error}")
                        return []
                else:
                    return []
            
            # If no results with status filter, check if analyst has any recommendations at all
            if (not result or not result.data or len(result.data) == 0) and status:
                logger.info(f"No {status} recommendations found, checking if analyst has any recommendations...")
                try:
                    all_recs_check = self.supabase.table("recommendations") \
                        .select("status, ticker") \
                        .eq("user_id", analyst_user_id) \
                        .limit(10) \
                        .execute()
                    
                    if all_recs_check.data:
                        statuses = [r.get("status") for r in all_recs_check.data]
                        tickers = [r.get("ticker") for r in all_recs_check.data]
                        logger.info(f"Analyst has {len(all_recs_check.data)} recommendations with statuses: {set(statuses)}")
                        logger.info(f"Sample tickers: {tickers[:5]}")
                    else:
                        logger.info(f"Analyst has no recommendations at all in database")
                except Exception as check_error:
                    logger.error(f"Error checking all recommendations: {check_error}")
            
            recs = []
            if result and result.data:
                for rec in result.data:
                    entry_price = rec.get("entry_price")
                    current_price = rec.get("current_price")
                    target_price = rec.get("target_price")
                    
                    # Calculate return
                    return_pct = None
                    if entry_price and current_price and entry_price > 0:
                        return_pct = ((current_price - entry_price) / entry_price) * 100
                    
                    recs.append({
                        "ticker": rec.get("ticker"),
                        "action": rec.get("action", "BUY"),
                        "status": rec.get("status"),
                        "entry_price": entry_price,
                        "current_price": current_price,
                        "target_price": target_price,
                        "stop_loss": rec.get("stop_loss"),
                        "entry_date": rec.get("entry_date"),
                        "exit_date": rec.get("exit_date"),
                        "exit_price": rec.get("exit_price"),
                        "return_pct": return_pct,
                        "final_return_pct": rec.get("final_return_pct"),
                        "thesis": rec.get("thesis")
                    })
            
            logger.info(f"Returning {len(recs)} formatted recommendations")
            return recs
            
        except Exception as e:
            logger.error(f"Error fetching analyst recommendations: {e}", exc_info=True)
            return []
    
    async def get_analyst_performance(self, analyst_user_id: str) -> Dict[str, Any]:
        """
        Get performance stats for an analyst.
        
        Args:
            analyst_user_id: Analyst's Supabase UUID
            
        Returns:
            Performance stats
        """
        try:
            result = self.supabase.table("performance") \
                .select("*") \
                .eq("user_id", analyst_user_id) \
                .limit(1) \
                .execute()
            
            if result.data and len(result.data) > 0:
                return result.data[0]
            return {}
            
        except Exception as e:
            logger.error(f"Error fetching analyst performance: {e}")
            return {}
    
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
    
    # =========================================================================
    # News Source Validation
    # =========================================================================
    
    @staticmethod
    def is_credible_source(url: str) -> bool:
        """
        Check if a news URL is from a credible financial news source.
        
        Args:
            url: News article URL
            
        Returns:
            True if from credible source, False otherwise
        """
        is_credible, _, _ = get_source_from_url(url)
        return is_credible
    
    @staticmethod
    def get_source_name(url: str) -> str:
        """
        Get display name for a news source URL.
        
        Args:
            url: News article URL
            
        Returns:
            Source display name or 'Unknown'
        """
        _, source_name, domain = get_source_from_url(url)
        return source_name or domain or "Unknown"

