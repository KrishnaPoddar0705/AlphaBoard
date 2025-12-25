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
        sections = [
            {
                "title": "Portfolio Actions",
                "rows": [
                    {
                        "id": "menu_add_watchlist",
                        "title": "Add to Watchlist",
                        "description": "Add a stock to track"
                    },
                    {
                        "id": "menu_add_recommendation",
                        "title": "Add Recommendation",
                        "description": "Log a stock pick"
                    },
                    {
                        "id": "menu_show_watchlist",
                        "title": "My Watchlist",
                        "description": "View your tracked stocks"
                    }
                ]
            },
            {
                "title": "Market Info",
                "rows": [
                    {
                        "id": "menu_market_close",
                        "title": "Market Close",
                        "description": "Today's market summary"
                    },
                    {
                        "id": "menu_news",
                        "title": "Latest News",
                        "description": "Get stock news"
                    },
                    {
                        "id": "menu_podcast",
                        "title": "Request Podcast",
                        "description": "Generate audio summary"
                    }
                ]
            },
            {
                "title": "Help",
                "rows": [
                    {
                        "id": "menu_help",
                        "title": "Help & Commands",
                        "description": "See available commands"
                    }
                ]
            }
        ]
        
        return await self.send_interactive_list(
            to=to,
            body_text="Welcome to AlphaBoard! 📈\n\nWhat would you like to do?",
            button_text="Open Menu",
            sections=sections,
            header_text="AlphaBoard Menu",
            footer_text="Reply 'help' anytime for commands"
        )
    
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

