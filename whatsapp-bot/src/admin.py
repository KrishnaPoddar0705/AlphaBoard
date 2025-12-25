"""
Admin Routes.
Administrative endpoints for monitoring and management.
"""

import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Header, BackgroundTasks
from pydantic import BaseModel

from .config import Settings, get_settings
from .schemas import HealthCheckResponse, AdminRecommendationsResponse
from .alphaboard_client import AlphaBoardClient
from .whatsapp_client import WhatsAppClient
from .tasks.daily_close_job import send_daily_close_to_all_subscribed

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])

# API router for web app integration (non-admin)
api_router = APIRouter(prefix="/api", tags=["api"])


# ============================================================================
# Request/Response Models for API
# ============================================================================

class VerifyLinkCodeRequest(BaseModel):
    """Request model for verifying a link code."""
    code: str
    supabase_user_id: str


class VerifyLinkCodeResponse(BaseModel):
    """Response model for link code verification."""
    success: bool
    message: str
    phone: Optional[str] = None
    whatsapp_user_id: Optional[str] = None


class AccountStatusResponse(BaseModel):
    """Response model for account status."""
    is_linked: bool
    whatsapp_phone: Optional[str] = None
    username: Optional[str] = None
    full_name: Optional[str] = None


# ============================================================================
# API Endpoints (for AlphaBoard Web App)
# ============================================================================

@api_router.post("/whatsapp/verify-link-code", response_model=VerifyLinkCodeResponse)
async def verify_link_code(
    request: VerifyLinkCodeRequest,
    settings: Settings = Depends(get_settings)
):
    """
    Verify a WhatsApp link code and connect accounts.
    Called from AlphaBoard web app when user enters the 6-digit code.
    
    Args:
        request: Contains code and supabase_user_id
        
    Returns:
        VerifyLinkCodeResponse with success status
    """
    ab_client = None
    wa_client = None
    
    try:
        ab_client = AlphaBoardClient(settings)
        
        result = await ab_client.verify_link_code(
            code=request.code.upper().strip(),
            supabase_user_id=request.supabase_user_id
        )
        
        if result.get("success"):
            # Send WhatsApp confirmation message
            try:
                wa_client = WhatsAppClient(settings)
                phone = result.get("phone")
                if phone:
                    # Get user's name from profiles if available
                    # Need to translate Clerk ID to Supabase UUID first
                    username = "there"
                    try:
                        # Look up Supabase UUID from clerk_user_mapping
                        mapping_result = ab_client.supabase.table("clerk_user_mapping") \
                            .select("supabase_user_id") \
                            .eq("clerk_user_id", request.supabase_user_id) \
                            .limit(1) \
                            .execute()
                        
                        if mapping_result.data and len(mapping_result.data) > 0:
                            actual_user_id = mapping_result.data[0].get("supabase_user_id")
                            profile_result = ab_client.supabase.table("profiles") \
                                .select("username, full_name") \
                                .eq("id", actual_user_id) \
                                .execute()
                            
                            if profile_result.data and len(profile_result.data) > 0:
                                profile = profile_result.data[0]
                                username = profile.get("full_name") or profile.get("username") or "there"
                    except Exception as profile_err:
                        logger.warning(f"Could not fetch profile for confirmation: {profile_err}")
                        # Continue with generic greeting
                    
                    confirmation_msg = (
                        f"🎉 *Account Connected Successfully!*\n\n"
                        f"Hey {username}! Your WhatsApp is now linked to your AlphaBoard account.\n\n"
                        f"✅ Your watchlist and recommendations will sync automatically\n"
                        f"✅ Type *my watchlist* to see your stocks\n"
                        f"✅ Type *my recs* to see your recommendations\n\n"
                        f"Happy investing! 📈"
                    )
                    await wa_client.send_text_message(phone, confirmation_msg)
            except Exception as wa_error:
                logger.error(f"Failed to send WhatsApp confirmation: {wa_error}")
                # Don't fail the whole request if WhatsApp message fails
            
            return VerifyLinkCodeResponse(
                success=True,
                message="Account linked successfully! Your WhatsApp is now connected.",
                phone=result.get("phone"),
                whatsapp_user_id=result.get("whatsapp_user_id")
            )
        else:
            return VerifyLinkCodeResponse(
                success=False,
                message=result.get("error", "Invalid or expired code. Please try again.")
            )
            
    except Exception as e:
        logger.error(f"Error verifying link code: {e}")
        return VerifyLinkCodeResponse(
            success=False,
            message="An error occurred. Please try again."
        )
    finally:
        if ab_client:
            await ab_client.close()
        if wa_client:
            await wa_client.close()


@api_router.get("/whatsapp/account-status/{supabase_user_id}", response_model=AccountStatusResponse)
async def get_account_status(
    supabase_user_id: str,
    settings: Settings = Depends(get_settings)
):
    """
    Check if a Supabase user has a linked WhatsApp account.
    Called from AlphaBoard web app to show link status.
    
    Args:
        supabase_user_id: AlphaBoard/Supabase user ID
        
    Returns:
        AccountStatusResponse with link status
    """
    ab_client = None
    
    try:
        ab_client = AlphaBoardClient(settings)
        
        # Find WhatsApp user linked to this Supabase user (without FK join)
        result = ab_client.supabase.table("whatsapp_users") \
            .select("phone, display_name") \
            .eq("supabase_user_id", supabase_user_id) \
            .execute()
        
        if result.data and len(result.data) > 0:
            user = result.data[0]
            
            # Fetch profile separately - need to translate Clerk ID to Supabase UUID first
            username = None
            full_name = None
            try:
                # Look up Supabase UUID from clerk_user_mapping
                mapping_result = ab_client.supabase.table("clerk_user_mapping") \
                    .select("supabase_user_id") \
                    .eq("clerk_user_id", supabase_user_id) \
                    .limit(1) \
                    .execute()
                
                if mapping_result.data and len(mapping_result.data) > 0:
                    actual_user_id = mapping_result.data[0].get("supabase_user_id")
                    profile_result = ab_client.supabase.table("profiles") \
                        .select("username, full_name") \
                        .eq("id", actual_user_id) \
                        .execute()
                    if profile_result.data and len(profile_result.data) > 0:
                        profile = profile_result.data[0]
                        username = profile.get("username")
                        full_name = profile.get("full_name")
            except Exception as profile_err:
                logger.warning(f"Could not fetch profile for {supabase_user_id}: {profile_err}")
            
            return AccountStatusResponse(
                is_linked=True,
                whatsapp_phone=user.get("phone"),
                username=username or user.get("display_name"),
                full_name=full_name
            )
        
        return AccountStatusResponse(is_linked=False)
        
    except Exception as e:
        logger.error(f"Error getting account status: {e}")
        return AccountStatusResponse(is_linked=False)
    finally:
        if ab_client:
            await ab_client.close()


@api_router.post("/whatsapp/unlink/{supabase_user_id}")
async def unlink_whatsapp_account(
    supabase_user_id: str,
    settings: Settings = Depends(get_settings)
):
    """
    Unlink WhatsApp account from Supabase user.
    Called from AlphaBoard web app settings.
    
    Args:
        supabase_user_id: AlphaBoard/Supabase user ID
        
    Returns:
        Status message
    """
    ab_client = None
    
    try:
        ab_client = AlphaBoardClient(settings)
        
        # Update WhatsApp user to remove link
        result = ab_client.supabase.table("whatsapp_users") \
            .update({
                "supabase_user_id": None,
                "onboarding_completed": False
            }) \
            .eq("supabase_user_id", supabase_user_id) \
            .execute()
        
        if result.data and len(result.data) > 0:
            return {
                "success": True,
                "message": "WhatsApp account unlinked successfully."
            }
        
        return {
            "success": False,
            "message": "No linked WhatsApp account found."
        }
        
    except Exception as e:
        logger.error(f"Error unlinking account: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if ab_client:
            await ab_client.close()


@api_router.get("/whatsapp/watchlist/{supabase_user_id}")
async def get_synced_watchlist(
    supabase_user_id: str,
    settings: Settings = Depends(get_settings)
):
    """
    Get WhatsApp watchlist items for a linked user.
    Can be used to show WhatsApp-added items in web app.
    
    Args:
        supabase_user_id: AlphaBoard/Supabase user ID
        
    Returns:
        List of watchlist items from WhatsApp
    """
    ab_client = None
    
    try:
        ab_client = AlphaBoardClient(settings)
        
        # Get WhatsApp user ID
        wa_user = ab_client.supabase.table("whatsapp_users") \
            .select("id") \
            .eq("supabase_user_id", supabase_user_id) \
            .execute()
        
        if not wa_user.data or len(wa_user.data) == 0:
            return {"items": [], "message": "No linked WhatsApp account"}
        
        whatsapp_user_id = wa_user.data[0]["id"]
        
        # Get watchlist
        watchlist = await ab_client.list_watchlist(whatsapp_user_id)
        
        return {
            "items": watchlist,
            "count": len(watchlist)
        }
        
    except Exception as e:
        logger.error(f"Error getting synced watchlist: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if ab_client:
            await ab_client.close()


def verify_admin_key(
    x_admin_key: Optional[str] = Header(None),
    settings: Settings = Depends(get_settings)
) -> bool:
    """
    Verify admin API key from header.
    
    Args:
        x_admin_key: Admin key from header
        settings: Application settings
        
    Returns:
        True if authorized
        
    Raises:
        HTTPException: 403 if unauthorized
    """
    if not settings.ADMIN_API_KEY:
        # Allow access if no admin key is configured (development mode)
        logger.warning("Admin endpoints accessible without authentication (no ADMIN_API_KEY set)")
        return True
    
    if x_admin_key != settings.ADMIN_API_KEY:
        raise HTTPException(status_code=403, detail="Invalid admin key")
    
    return True


@router.get("/health", response_model=HealthCheckResponse)
async def admin_health_check(
    settings: Settings = Depends(get_settings),
    _: bool = Depends(verify_admin_key)
):
    """
    Check health of all service dependencies.
    
    Returns:
        HealthCheckResponse with status of each dependency
    """
    wa_client = None
    ab_client = None
    
    try:
        # Check WhatsApp API
        wa_client = WhatsAppClient(settings)
        whatsapp_status = "healthy" if await wa_client.health_check() else "unhealthy"
    except Exception as e:
        logger.error(f"WhatsApp health check failed: {e}")
        whatsapp_status = "error"
    finally:
        if wa_client:
            await wa_client.close()
    
    try:
        # Check AlphaBoard API
        ab_client = AlphaBoardClient(settings)
        alphaboard_status = "healthy" if await ab_client.health_check() else "unhealthy"
    except Exception as e:
        logger.error(f"AlphaBoard health check failed: {e}")
        alphaboard_status = "error"
    
    try:
        # Check Database
        if ab_client:
            db_status = "healthy" if ab_client.database_health_check() else "unhealthy"
        else:
            ab_client = AlphaBoardClient(settings)
            db_status = "healthy" if ab_client.database_health_check() else "unhealthy"
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        db_status = "error"
    finally:
        if ab_client:
            await ab_client.close()
    
    # Overall status
    all_healthy = all([
        whatsapp_status == "healthy",
        alphaboard_status == "healthy",
        db_status == "healthy"
    ])
    
    return HealthCheckResponse(
        status="healthy" if all_healthy else "degraded",
        whatsapp_api=whatsapp_status,
        alphaboard_api=alphaboard_status,
        database=db_status
    )


@router.get("/recommendations/daily", response_model=AdminRecommendationsResponse)
async def get_daily_recommendations(
    days: int = 1,
    settings: Settings = Depends(get_settings),
    _: bool = Depends(verify_admin_key)
):
    """
    Get recommendations added via WhatsApp in the last N days.
    
    Args:
        days: Number of days to look back (default 1)
        
    Returns:
        AdminRecommendationsResponse with count and items
    """
    ab_client = None
    
    try:
        ab_client = AlphaBoardClient(settings)
        recommendations = await ab_client.admin_list_new_recommendations(days=days)
        
        # Format items for response
        items = []
        for rec in recommendations:
            user_info = rec.get("whatsapp_users", {}) or {}
            items.append({
                "id": rec.get("id"),
                "user_phone": user_info.get("phone", "unknown"),
                "user_name": user_info.get("display_name"),
                "ticker": rec.get("ticker"),
                "price": rec.get("price"),
                "thesis": rec.get("thesis"),
                "created_at": rec.get("created_at")
            })
        
        return AdminRecommendationsResponse(
            count=len(items),
            items=items
        )
        
    except Exception as e:
        logger.error(f"Error fetching daily recommendations: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if ab_client:
            await ab_client.close()


@router.get("/watchlist/stats")
async def get_watchlist_stats(
    settings: Settings = Depends(get_settings),
    _: bool = Depends(verify_admin_key)
):
    """
    Get aggregate watchlist statistics.
    
    Returns:
        Dict with watchlist stats
    """
    ab_client = None
    
    try:
        ab_client = AlphaBoardClient(settings)
        
        # Get total users
        users_result = ab_client.supabase.table("whatsapp_users") \
            .select("id", count="exact") \
            .execute()
        total_users = users_result.count if hasattr(users_result, 'count') else len(users_result.data or [])
        
        # Get total watchlist items
        watchlist_result = ab_client.supabase.table("whatsapp_watchlist") \
            .select("id", count="exact") \
            .execute()
        total_watchlist_items = watchlist_result.count if hasattr(watchlist_result, 'count') else len(watchlist_result.data or [])
        
        # Get daily subscribers count
        subscribers_result = ab_client.supabase.table("whatsapp_users") \
            .select("id", count="exact") \
            .eq("is_daily_subscriber", True) \
            .execute()
        daily_subscribers = subscribers_result.count if hasattr(subscribers_result, 'count') else len(subscribers_result.data or [])
        
        # Get top watched tickers
        top_tickers_result = ab_client.supabase.rpc(
            "get_top_watched_tickers",
            {"limit_count": 10}
        ).execute() if False else None  # RPC not implemented yet
        
        return {
            "total_users": total_users,
            "total_watchlist_items": total_watchlist_items,
            "daily_subscribers": daily_subscribers,
            "top_tickers": []  # Would need a DB function
        }
        
    except Exception as e:
        logger.error(f"Error fetching watchlist stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if ab_client:
            await ab_client.close()


@router.post("/run-daily-close")
async def trigger_daily_close(
    background_tasks: BackgroundTasks,
    settings: Settings = Depends(get_settings),
    _: bool = Depends(verify_admin_key)
):
    """
    Manually trigger daily close report broadcast.
    Runs in background to avoid timeout.
    
    Returns:
        Status message
    """
    try:
        # Run in background
        background_tasks.add_task(send_daily_close_to_all_subscribed, settings)
        
        return {
            "status": "queued",
            "message": "Daily close broadcast has been queued. Check logs for progress."
        }
        
    except Exception as e:
        logger.error(f"Error triggering daily close: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/users")
async def list_users(
    limit: int = 50,
    offset: int = 0,
    settings: Settings = Depends(get_settings),
    _: bool = Depends(verify_admin_key)
):
    """
    List WhatsApp users.
    
    Args:
        limit: Maximum users to return
        offset: Pagination offset
        
    Returns:
        List of users
    """
    ab_client = None
    
    try:
        ab_client = AlphaBoardClient(settings)
        
        result = ab_client.supabase.table("whatsapp_users") \
            .select("*") \
            .order("created_at", desc=True) \
            .range(offset, offset + limit - 1) \
            .execute()
        
        return {
            "users": result.data or [],
            "count": len(result.data or []),
            "offset": offset,
            "limit": limit
        }
        
    except Exception as e:
        logger.error(f"Error listing users: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if ab_client:
            await ab_client.close()


@router.post("/broadcast")
async def broadcast_message(
    message: str,
    background_tasks: BackgroundTasks,
    subscriber_only: bool = True,
    settings: Settings = Depends(get_settings),
    _: bool = Depends(verify_admin_key)
):
    """
    Broadcast a message to all users (or subscribers only).
    
    Args:
        message: Message to broadcast
        subscriber_only: If True, only send to daily subscribers
        
    Returns:
        Status message
    """
    from .tasks.daily_close_job import broadcast_to_users
    
    try:
        background_tasks.add_task(
            broadcast_to_users,
            settings,
            message,
            subscriber_only
        )
        
        return {
            "status": "queued",
            "message": "Broadcast has been queued. Check logs for progress.",
            "subscriber_only": subscriber_only
        }
        
    except Exception as e:
        logger.error(f"Error triggering broadcast: {e}")
        raise HTTPException(status_code=500, detail=str(e))

