"""
Admin Routes.
Administrative endpoints for monitoring and management.
"""

import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Header, BackgroundTasks

from .config import Settings, get_settings
from .schemas import HealthCheckResponse, AdminRecommendationsResponse
from .alphaboard_client import AlphaBoardClient
from .whatsapp_client import WhatsAppClient
from .tasks.daily_close_job import send_daily_close_to_all_subscribed

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])


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

