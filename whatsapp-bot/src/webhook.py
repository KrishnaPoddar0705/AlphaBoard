"""
WhatsApp Webhook Routes.
Handles webhook verification and incoming message processing.
"""

import logging
from typing import Optional
from fastapi import APIRouter, Query, Request, HTTPException, Depends, BackgroundTasks

from .config import Settings, get_settings
from .schemas import WhatsAppWebhookPayload, ParsedMessage, WebhookResponse
from .engine import MessageEngine

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhook", tags=["webhook"])


def get_engine(settings: Settings = Depends(get_settings)) -> MessageEngine:
    """Dependency to get message engine instance."""
    return MessageEngine(settings)


@router.get("")
async def verify_webhook(
    hub_mode: Optional[str] = Query(None, alias="hub.mode"),
    hub_verify_token: Optional[str] = Query(None, alias="hub.verify_token"),
    hub_challenge: Optional[str] = Query(None, alias="hub.challenge"),
    settings: Settings = Depends(get_settings)
):
    """
    Webhook verification endpoint for Meta WhatsApp.
    
    Meta sends a GET request with:
    - hub.mode: Should be "subscribe"
    - hub.verify_token: Should match our configured verify token
    - hub.challenge: A string we need to echo back
    
    Returns:
        The hub.challenge value if verification succeeds
        
    Raises:
        HTTPException: 403 if verification fails
    """
    logger.info(f"Webhook verification request: mode={hub_mode}")
    
    if hub_mode == "subscribe" and hub_verify_token == settings.META_WHATSAPP_VERIFY_TOKEN:
        logger.info("Webhook verification successful")
        # Return the challenge as plain text (not JSON)
        return int(hub_challenge) if hub_challenge else ""
    
    logger.warning(f"Webhook verification failed: token mismatch or invalid mode")
    raise HTTPException(status_code=403, detail="Verification failed")


@router.post("", response_model=WebhookResponse)
async def handle_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    settings: Settings = Depends(get_settings)
):
    """
    Handle incoming WhatsApp webhook events.
    
    Processes incoming messages and routes them to the message engine.
    Always returns 200 to acknowledge receipt, even if processing fails.
    
    Returns:
        WebhookResponse with status "EVENT_RECEIVED"
    """
    try:
        # Parse raw JSON body
        body = await request.json()
        logger.debug(f"Webhook payload: {body}")
        
        # Validate basic structure
        if body.get("object") != "whatsapp_business_account":
            logger.debug("Ignoring non-WhatsApp webhook")
            return WebhookResponse()
        
        # Parse the payload
        try:
            payload = WhatsAppWebhookPayload(**body)
        except Exception as parse_error:
            logger.error(f"Failed to parse webhook payload: {parse_error}")
            return WebhookResponse()
        
        # Process each entry and change
        for entry in payload.entry:
            for change in entry.changes:
                if change.field != "messages":
                    continue
                
                value = change.value
                phone_number_id = value.metadata.phone_number_id
                
                # Process messages
                if value.messages:
                    for message in value.messages:
                        parsed = parse_incoming_message(message, phone_number_id)
                        if parsed:
                            # Process message in background to return 200 quickly
                            background_tasks.add_task(
                                process_message_async,
                                parsed,
                                settings
                            )
        
        return WebhookResponse()
        
    except Exception as e:
        logger.error(f"Webhook handler error: {e}")
        # Always return 200 to prevent Meta from retrying
        return WebhookResponse()


def parse_incoming_message(message: dict, phone_number_id: str) -> Optional[ParsedMessage]:
    """
    Parse incoming WhatsApp message into normalized format.
    
    Args:
        message: Raw message dict from webhook
        phone_number_id: Phone number ID from metadata
        
    Returns:
        ParsedMessage or None if message type not supported
    """
    try:
        from datetime import datetime
        
        message_type = message.get("type", "")
        sender_phone = message.get("from", "")
        timestamp_str = message.get("timestamp", "")
        message_id = message.get("id", "")
        
        # Parse timestamp
        try:
            timestamp = datetime.fromtimestamp(int(timestamp_str))
        except:
            timestamp = datetime.utcnow()
        
        # Parse based on message type
        if message_type == "text":
            text_body = message.get("text", {}).get("body", "")
            return ParsedMessage(
                sender_phone=sender_phone,
                message_type="text",
                text_body=text_body,
                phone_number_id=phone_number_id,
                timestamp=timestamp,
                raw_message_id=message_id
            )
        
        elif message_type == "interactive":
            interactive = message.get("interactive", {})
            interactive_type = interactive.get("type", "")
            
            if interactive_type == "button_reply":
                reply = interactive.get("button_reply", {})
                return ParsedMessage(
                    sender_phone=sender_phone,
                    message_type="interactive_button",
                    interactive_id=reply.get("id", ""),
                    interactive_title=reply.get("title", ""),
                    phone_number_id=phone_number_id,
                    timestamp=timestamp,
                    raw_message_id=message_id
                )
            
            elif interactive_type == "list_reply":
                reply = interactive.get("list_reply", {})
                return ParsedMessage(
                    sender_phone=sender_phone,
                    message_type="interactive_list",
                    interactive_id=reply.get("id", ""),
                    interactive_title=reply.get("title", ""),
                    phone_number_id=phone_number_id,
                    timestamp=timestamp,
                    raw_message_id=message_id
                )
        
        logger.debug(f"Unsupported message type: {message_type}")
        return None
        
    except Exception as e:
        logger.error(f"Error parsing message: {e}")
        return None


async def process_message_async(parsed: ParsedMessage, settings: Settings):
    """
    Process a parsed message asynchronously.
    
    Args:
        parsed: Parsed message to process
        settings: Application settings
    """
    engine = None
    try:
        engine = MessageEngine(settings)
        await engine.handle_incoming_message(parsed)
    except Exception as e:
        logger.error(f"Error processing message: {e}")
    finally:
        if engine:
            await engine.close()

