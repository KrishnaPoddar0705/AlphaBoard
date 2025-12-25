"""
Daily Close Job.
Sends daily market close reports to subscribed WhatsApp users.
"""

import logging
import asyncio
from typing import List, Dict, Any

from ..config import Settings
from ..whatsapp_client import WhatsAppClient
from ..alphaboard_client import AlphaBoardClient
from ..services.market_reports import MarketReportService

logger = logging.getLogger(__name__)


async def send_daily_close_to_all_subscribed(settings: Settings) -> Dict[str, Any]:
    """
    Send daily market close report to all subscribed users.
    
    This function is designed to be triggered by:
    - An external scheduler (cron, Render cron job)
    - Manual admin endpoint trigger
    
    Args:
        settings: Application settings
        
    Returns:
        Summary dict with success/failure counts
    """
    logger.info("Starting daily close broadcast")
    
    wa_client = None
    ab_client = None
    market_service = None
    
    results = {
        "total_subscribers": 0,
        "sent_success": 0,
        "sent_failed": 0,
        "errors": []
    }
    
    try:
        # Initialize clients
        wa_client = WhatsAppClient(settings)
        ab_client = AlphaBoardClient(settings)
        market_service = MarketReportService(settings)
        
        # Get all daily subscribers
        subscribers = await ab_client.list_daily_subscribed_users()
        results["total_subscribers"] = len(subscribers)
        
        if not subscribers:
            logger.info("No subscribers found for daily report")
            return results
        
        logger.info(f"Sending daily close to {len(subscribers)} subscribers")
        
        # Build base summary once
        base_summary = await market_service.build_daily_summary()
        
        # Send to each subscriber
        for user in subscribers:
            phone = user.get("phone", "")
            user_id = user.get("id", "")
            
            if not phone:
                logger.warning(f"Skipping user {user_id}: no phone number")
                continue
            
            try:
                # Try to send using template (required for proactive messages)
                if settings.WHATSAPP_DAILY_TEMPLATE_NAME:
                    # Get user's watchlist for personalization
                    watchlist = await ab_client.list_watchlist(user_id)
                    tickers = [item["ticker"] for item in watchlist[:3]]
                    
                    # Build template components
                    components = market_service.get_template_components(base_summary)
                    
                    await wa_client.send_template_message(
                        to=phone,
                        template_name=settings.WHATSAPP_DAILY_TEMPLATE_NAME,
                        language_code=settings.WHATSAPP_DAILY_TEMPLATE_LANG,
                        components=components
                    )
                else:
                    # Fallback: Send as regular message (only works within 24h window)
                    # Get personalized summary if user has watchlist
                    watchlist = await ab_client.list_watchlist(user_id)
                    
                    if watchlist:
                        summary = await market_service.build_personalized_summary(
                            user_id, watchlist
                        )
                    else:
                        summary = base_summary
                    
                    await wa_client.send_text_message(to=phone, body=summary)
                
                results["sent_success"] += 1
                logger.debug(f"Sent daily close to {phone[:6]}***")
                
                # Rate limiting: wait between messages to avoid throttling
                await asyncio.sleep(0.5)
                
            except Exception as user_error:
                logger.error(f"Failed to send to {phone[:6]}***: {user_error}")
                results["sent_failed"] += 1
                results["errors"].append({
                    "phone": f"{phone[:6]}***",
                    "error": str(user_error)
                })
        
        logger.info(
            f"Daily close broadcast complete: "
            f"{results['sent_success']} sent, {results['sent_failed']} failed"
        )
        
        return results
        
    except Exception as e:
        logger.error(f"Daily close job failed: {e}")
        results["errors"].append({"job_error": str(e)})
        return results
        
    finally:
        # Clean up clients
        if wa_client:
            await wa_client.close()
        if ab_client:
            await ab_client.close()
        if market_service:
            await market_service.close()


async def broadcast_to_users(
    settings: Settings,
    message: str,
    subscriber_only: bool = True
) -> Dict[str, Any]:
    """
    Broadcast a custom message to users.
    
    Args:
        settings: Application settings
        message: Message to send
        subscriber_only: If True, only send to daily subscribers
        
    Returns:
        Summary dict with success/failure counts
    """
    logger.info(f"Starting broadcast (subscriber_only={subscriber_only})")
    
    wa_client = None
    ab_client = None
    
    results = {
        "total_users": 0,
        "sent_success": 0,
        "sent_failed": 0,
        "errors": []
    }
    
    try:
        wa_client = WhatsAppClient(settings)
        ab_client = AlphaBoardClient(settings)
        
        # Get users
        if subscriber_only:
            users = await ab_client.list_daily_subscribed_users()
        else:
            # Get all users (note: this could be large)
            result = ab_client.supabase.table("whatsapp_users") \
                .select("*") \
                .execute()
            users = result.data or []
        
        results["total_users"] = len(users)
        
        if not users:
            logger.info("No users found for broadcast")
            return results
        
        logger.info(f"Broadcasting to {len(users)} users")
        
        for user in users:
            phone = user.get("phone", "")
            
            if not phone:
                continue
            
            try:
                await wa_client.send_text_message(to=phone, body=message)
                results["sent_success"] += 1
                
                # Rate limiting
                await asyncio.sleep(0.5)
                
            except Exception as user_error:
                logger.error(f"Failed to send to {phone[:6]}***: {user_error}")
                results["sent_failed"] += 1
                results["errors"].append({
                    "phone": f"{phone[:6]}***",
                    "error": str(user_error)
                })
        
        logger.info(
            f"Broadcast complete: "
            f"{results['sent_success']} sent, {results['sent_failed']} failed"
        )
        
        return results
        
    except Exception as e:
        logger.error(f"Broadcast failed: {e}")
        results["errors"].append({"job_error": str(e)})
        return results
        
    finally:
        if wa_client:
            await wa_client.close()
        if ab_client:
            await ab_client.close()


def run_daily_close_sync(settings: Settings) -> Dict[str, Any]:
    """
    Synchronous wrapper for daily close job.
    Useful for running from non-async contexts (e.g., cron).
    
    Args:
        settings: Application settings
        
    Returns:
        Summary dict
    """
    return asyncio.run(send_daily_close_to_all_subscribed(settings))


# Entry point for external schedulers
if __name__ == "__main__":
    import sys
    from ..config import get_settings
    
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    try:
        settings = get_settings()
        results = run_daily_close_sync(settings)
        
        print(f"Daily close job completed:")
        print(f"  Total subscribers: {results['total_subscribers']}")
        print(f"  Sent successfully: {results['sent_success']}")
        print(f"  Failed: {results['sent_failed']}")
        
        if results['sent_failed'] > 0:
            sys.exit(1)
        sys.exit(0)
        
    except Exception as e:
        print(f"Daily close job failed: {e}")
        sys.exit(1)

