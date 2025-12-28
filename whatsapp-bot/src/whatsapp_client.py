"""
WhatsApp Cloud API Client.
Thin wrapper for Meta WhatsApp Business Cloud API calls.
"""

import logging
from typing import Optional, List, Dict, Any
import httpx

from .config import Settings

logger = logging.getLogger(__name__)


class WhatsAppClient:
    """
    Client for Meta WhatsApp Cloud API.
    Handles sending text messages, template messages, and interactive menus.
    """
    
    def __init__(self, settings: Settings):
        """
        Initialize WhatsApp client.
        
        Args:
            settings: Application settings containing API credentials
        """
        self.access_token = settings.META_WHATSAPP_ACCESS_TOKEN
        self.api_version = settings.META_WHATSAPP_API_VERSION
        self.phone_number_id = settings.META_WHATSAPP_PHONE_NUMBER_ID
        self.base_url = f"https://graph.facebook.com/{self.api_version}/{self.phone_number_id}/messages"
        
        self._client = httpx.AsyncClient(
            timeout=30.0,
            headers={
                "Authorization": f"Bearer {self.access_token}",
                "Content-Type": "application/json"
            }
        )
    
    async def close(self):
        """Close the HTTP client."""
        await self._client.aclose()
    
    async def _send_request(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Send request to WhatsApp API.
        
        Args:
            payload: JSON payload to send
            
        Returns:
            API response as dict
        """
        try:
            response = await self._client.post(self.base_url, json=payload)
            
            if response.status_code != 200:
                logger.error(
                    f"WhatsApp API error: status={response.status_code}, "
                    f"response={response.text}"
                )
                return {"error": True, "status_code": response.status_code}
            
            return response.json()
            
        except httpx.TimeoutException:
            logger.error("WhatsApp API timeout")
            return {"error": True, "message": "Timeout"}
        except Exception as e:
            logger.error(f"WhatsApp API error: {e}")
            return {"error": True, "message": str(e)}
    
    async def send_text_message(self, to: str, body: str) -> Dict[str, Any]:
        """
        Send a text message to a WhatsApp user.
        
        Args:
            to: Recipient phone number in E.164 format (e.g., "919876543210")
            body: Message text content
            
        Returns:
            API response
        """
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to,
            "type": "text",
            "text": {
                "preview_url": False,
                "body": body
            }
        }
        
        logger.info(f"Sending text message to {to[:6]}***")
        return await self._send_request(payload)
    
    async def send_template_message(
        self,
        to: str,
        template_name: str,
        language_code: str = "en_US",
        components: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Send a pre-approved template message.
        Used for proactive messages like daily market close reports.
        
        Args:
            to: Recipient phone number in E.164 format
            template_name: Name of the approved template
            language_code: Template language code (e.g., "en_US")
            components: Optional template components (header, body, button params)
            
        Returns:
            API response
        """
        template_payload = {
            "name": template_name,
            "language": {
                "code": language_code
            }
        }
        
        if components:
            template_payload["components"] = components
        
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to,
            "type": "template",
            "template": template_payload
        }
        
        logger.info(f"Sending template '{template_name}' to {to[:6]}***")
        return await self._send_request(payload)
    
    async def send_audio_from_url(
        self,
        to: str,
        audio_url: str,
        caption: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Send an audio file from URL to a WhatsApp user.
        
        Args:
            to: Recipient phone number in E.164 format
            audio_url: Public URL of the audio file (must be accessible)
            caption: Optional caption for the audio
            
        Returns:
            API response
        """
        audio_payload = {
            "link": audio_url
        }
        
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to,
            "type": "audio",
            "audio": audio_payload
        }
        
        logger.info(f"Sending audio from URL to {to[:6]}***")
        return await self._send_request(payload)
    
    async def upload_and_send_audio(
        self,
        to: str,
        audio_bytes: bytes,
        filename: str = "podcast.mp3",
        caption: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Upload audio bytes and send to WhatsApp user.
        Uses WhatsApp Media API to upload first, then send.
        
        Based on: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media
        
        Args:
            to: Recipient phone number in E.164 format
            audio_bytes: Audio file bytes (MP3)
            filename: Filename for the upload
            caption: Optional caption
            
        Returns:
            API response
        """
        try:
            logger.info(f"Uploading audio ({len(audio_bytes)} bytes) for {to[:6]}***")
            
            # Step 1: Upload media to WhatsApp Cloud API
            upload_url = f"https://graph.facebook.com/{self.api_version}/{self.phone_number_id}/media"
            
            # Per WhatsApp docs: multipart/form-data with file, type, messaging_product
            # Use data dict for form fields and files dict for file upload
            data = {
                'messaging_product': 'whatsapp',
                'type': 'audio/mpeg'
            }
            
            files = {
                'file': (filename, audio_bytes, 'audio/mpeg')
            }
            
            # Create a fresh client for upload to avoid content-type conflicts
            import httpx
            async with httpx.AsyncClient(timeout=120.0) as upload_client:
                upload_response = await upload_client.post(
                    upload_url,
                    data=data,
                    files=files,
                    headers={"Authorization": f"Bearer {self.access_token}"}
                )
            
            logger.info(f"Upload response: {upload_response.status_code}")
            
            if upload_response.status_code != 200:
                error_text = upload_response.text[:500]
                logger.error(f"Media upload failed: {upload_response.status_code} - {error_text}")
                return {"error": True, "message": f"Upload failed: {error_text}"}
            
            upload_data = upload_response.json()
            media_id = upload_data.get("id")
            
            if not media_id:
                logger.error(f"No media_id in upload response: {upload_data}")
                return {"error": True, "message": "No media ID returned"}
            
            logger.info(f"Media uploaded successfully, ID: {media_id}")
            
            # Step 2: Send audio message using media_id
            payload = {
                "messaging_product": "whatsapp",
                "recipient_type": "individual",
                "to": to,
                "type": "audio",
                "audio": {
                    "id": media_id
                }
            }
            
            logger.info(f"Sending audio message to {to[:6]}***")
            result = await self._send_request(payload)
            
            if result.get("error"):
                logger.error(f"Failed to send audio: {result}")
            else:
                logger.info(f"Audio sent successfully to {to[:6]}***")
            
            return result
            
        except Exception as e:
            logger.error(f"Error uploading and sending audio: {e}", exc_info=True)
            return {"error": True, "message": str(e)}
    
    async def send_interactive_buttons(
        self,
        to: str,
        body_text: str,
        buttons: List[Dict[str, str]],
        header_text: Optional[str] = None,
        footer_text: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Send an interactive message with buttons.
        Maximum 3 buttons allowed by WhatsApp.
        
        Args:
            to: Recipient phone number
            body_text: Main message body
            buttons: List of buttons, each with "id" and "title" keys
            header_text: Optional header text
            footer_text: Optional footer text
            
        Returns:
            API response
        """
        interactive_payload = {
            "type": "button",
            "body": {
                "text": body_text
            },
            "action": {
                "buttons": [
                    {
                        "type": "reply",
                        "reply": {
                            "id": btn["id"],
                            "title": btn["title"][:20]  # WhatsApp limits to 20 chars
                        }
                    }
                    for btn in buttons[:3]  # Max 3 buttons
                ]
            }
        }
        
        if header_text:
            interactive_payload["header"] = {
                "type": "text",
                "text": header_text
            }
        
        if footer_text:
            interactive_payload["footer"] = {
                "text": footer_text
            }
        
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to,
            "type": "interactive",
            "interactive": interactive_payload
        }
        
        logger.info(f"Sending interactive buttons to {to[:6]}***")
        return await self._send_request(payload)
    
    async def send_interactive_list(
        self,
        to: str,
        body_text: str,
        button_text: str,
        sections: List[Dict[str, Any]],
        header_text: Optional[str] = None,
        footer_text: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Send an interactive list message.
        
        Args:
            to: Recipient phone number
            body_text: Main message body
            button_text: Text on the button that opens the list
            sections: List sections with title and rows
            header_text: Optional header text
            footer_text: Optional footer text
            
        Returns:
            API response
        """
        interactive_payload = {
            "type": "list",
            "body": {
                "text": body_text
            },
            "action": {
                "button": button_text[:20],  # WhatsApp limits to 20 chars
                "sections": sections
            }
        }
        
        if header_text:
            interactive_payload["header"] = {
                "type": "text",
                "text": header_text
            }
        
        if footer_text:
            interactive_payload["footer"] = {
                "text": footer_text
            }
        
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to,
            "type": "interactive",
            "interactive": interactive_payload
        }
        
        logger.info(f"Sending interactive list to {to[:6]}***")
        return await self._send_request(payload)
    
    async def send_main_menu(self, to: str) -> Dict[str, Any]:
        """
        Send the main menu to a user.
        
        Args:
            to: Recipient phone number
            
        Returns:
            API response
        """
        # WhatsApp limit: max 10 rows total across all sections
        sections = [
            {
                "title": "Quick Actions",
                "rows": [
                    {
                        "id": "menu_add_recommendation",
                        "title": "📈 Add Recommendation",
                        "description": "Log a BUY/SELL pick"
                    },
                    {
                        "id": "menu_add_watchlist",
                        "title": "👀 Add to Watchlist",
                        "description": "Track a stock"
                    },
                    {
                        "id": "menu_set_alert",
                        "title": "🔔 Set Price Alert",
                        "description": "Get price notifications"
                    }
                ]
            },
            {
                "title": "Portfolio & Market",
                "rows": [
                    {
                        "id": "menu_my_recs",
                        "title": "📊 My Recommendations",
                        "description": "View your active picks"
                    },
                    {
                        "id": "menu_show_watchlist",
                        "title": "📋 My Watchlist",
                        "description": "View tracked stocks"
                    },
                    {
                        "id": "menu_news",
                        "title": "📰 News & Podcast",
                        "description": "Type: news TCS"
                    }
                ]
            },
            {
                "title": "Account",
                "rows": [
                    {
                        "id": "menu_connect_account",
                        "title": "🔗 Connect Account",
                        "description": "Link to web app"
                    },
                    {
                        "id": "menu_track_analyst",
                        "title": "📊 Track Analyst",
                        "description": "Admin only"
                    },
                    {
                        "id": "menu_help",
                        "title": "❓ Help",
                        "description": "Commands & tips"
                    }
                ]
            }
        ]
        
        return await self.send_interactive_list(
            to=to,
            body_text="Welcome to AlphaBoard! 📈\n\nTrack your stock picks and beat the market.",
            button_text="Open Menu",
            sections=sections,
            header_text="AlphaBoard Menu",
            footer_text="Reply 'help' anytime"
        )
    
    async def send_action_selector(self, to: str) -> Dict[str, Any]:
        """
        Send action type selector for recommendation.
        """
        buttons = [
            {"id": "action_buy", "title": "📈 BUY"},
            {"id": "action_sell", "title": "📉 SELL"},
            {"id": "action_watch", "title": "👀 WATCH"}
        ]
        
        return await self.send_interactive_buttons(
            to=to,
            body_text="What type of recommendation?\n\n• *BUY* - You're buying this stock\n• *SELL* - You're shorting/selling\n• *WATCH* - Add to watchlist with alerts",
            buttons=buttons,
            header_text="Add Recommendation"
        )
    
    async def send_ticker_prompt(self, to: str, action: str) -> Dict[str, Any]:
        """
        Prompt for ticker and price input.
        """
        action_upper = action.upper()
        if action_upper == "WATCH":
            message = (
                f"📊 *Adding to Watchlist*\n\n"
                f"Send the stock ticker:\n\n"
                f"Examples:\n"
                f"• TCS\n"
                f"• RELIANCE\n"
                f"• INFY.NS"
            )
        else:
            message = (
                f"📊 *New {action_upper} Recommendation*\n\n"
                f"Send ticker and entry price:\n\n"
                f"Examples:\n"
                f"• TCS @ 3500\n"
                f"• RELIANCE @ 1550\n"
                f"• INFY (we'll use current price)"
            )
        
        return await self.send_text_message(to, message)
    
    async def send_thesis_prompt(self, to: str, ticker: str, action: str, price: Optional[float]) -> Dict[str, Any]:
        """
        Prompt for thesis/notes with skip option.
        """
        price_str = f" @ ₹{price:,.0f}" if price else ""
        
        buttons = [
            {"id": "thesis_skip", "title": "Skip"},
        ]
        
        message = (
            f"✅ *{action.upper()} {ticker}*{price_str}\n\n"
            f"Add your investment thesis/notes:\n\n"
            f"_(Or tap Skip to save without notes)_"
        )
        
        return await self.send_interactive_buttons(
            to=to,
            body_text=message,
            buttons=buttons,
            header_text="Add Notes"
        )
    
    async def send_alert_prompt(self, to: str) -> Dict[str, Any]:
        """
        Prompt for price alert setup.
        """
        message = (
            "🔔 *Set Price Alert*\n\n"
            "Send ticker with target price:\n\n"
            "Examples:\n"
            "• TCS below 3400\n"
            "• RELIANCE above 1600\n"
            "• INFY @ 1500 (alerts both ways)"
        )
        
        return await self.send_text_message(to, message)
    
    async def send_recommendation_confirmation(
        self,
        to: str,
        ticker: str,
        action: str,
        price: Optional[float],
        thesis: Optional[str],
        synced_to_app: bool = False
    ) -> Dict[str, Any]:
        """
        Send confirmation after adding recommendation.
        """
        price_str = f" @ ₹{price:,.0f}" if price else ""
        
        lines = [
            f"✅ *{action.upper()} {ticker}*{price_str}",
        ]
        
        if thesis:
            lines.append(f"📝 _{thesis}_")
        
        if synced_to_app:
            lines.append("\n🌐 Synced to AlphaBoard app!")
            lines.append("📊 Type *my recs* to see all positions")
        else:
            lines.append("\n⚠️ Not synced to web app")
            lines.append("💡 Type *connect* to link your account")
        
        return await self.send_text_message(to, "\n".join(lines))
    
    async def mark_message_read(self, message_id: str) -> Dict[str, Any]:
        """
        Mark a message as read (shows blue ticks).
        
        Args:
            message_id: WhatsApp message ID to mark as read
            
        Returns:
            API response
        """
        payload = {
            "messaging_product": "whatsapp",
            "status": "read",
            "message_id": message_id
        }
        
        return await self._send_request(payload)
    
    async def health_check(self) -> bool:
        """
        Check if WhatsApp API is accessible.
        
        Returns:
            True if API is healthy, False otherwise
        """
        try:
            url = f"https://graph.facebook.com/{self.api_version}/{self.phone_number_id}"
            response = await self._client.get(url)
            return response.status_code == 200
        except Exception as e:
            logger.error(f"WhatsApp health check failed: {e}")
            return False

