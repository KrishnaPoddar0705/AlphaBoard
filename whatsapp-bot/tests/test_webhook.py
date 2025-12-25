"""
Tests for webhook routes.
"""

import pytest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient

from src.main import app
from src.config import get_settings


class TestWebhookVerification:
    """Tests for webhook verification endpoint."""
    
    def test_verify_webhook_success(self, client):
        """Test successful webhook verification."""
        settings = get_settings()
        
        response = client.get(
            "/webhook",
            params={
                "hub.mode": "subscribe",
                "hub.verify_token": settings.META_WHATSAPP_VERIFY_TOKEN,
                "hub.challenge": "12345"
            }
        )
        
        assert response.status_code == 200
        assert response.text == "12345"
    
    def test_verify_webhook_invalid_token(self, client):
        """Test webhook verification with invalid token."""
        response = client.get(
            "/webhook",
            params={
                "hub.mode": "subscribe",
                "hub.verify_token": "wrong_token",
                "hub.challenge": "12345"
            }
        )
        
        assert response.status_code == 403
    
    def test_verify_webhook_wrong_mode(self, client):
        """Test webhook verification with wrong mode."""
        settings = get_settings()
        
        response = client.get(
            "/webhook",
            params={
                "hub.mode": "unsubscribe",
                "hub.verify_token": settings.META_WHATSAPP_VERIFY_TOKEN,
                "hub.challenge": "12345"
            }
        )
        
        assert response.status_code == 403
    
    def test_verify_webhook_missing_params(self, client):
        """Test webhook verification with missing parameters."""
        response = client.get("/webhook")
        
        assert response.status_code == 403


class TestWebhookIncoming:
    """Tests for incoming message webhook."""
    
    def test_webhook_post_success(self, client, sample_webhook_payload):
        """Test successful message webhook."""
        with patch('src.webhook.process_message_async', new_callable=AsyncMock):
            response = client.post("/webhook", json=sample_webhook_payload)
        
        assert response.status_code == 200
        assert response.json() == {"status": "EVENT_RECEIVED"}
    
    def test_webhook_post_non_whatsapp(self, client):
        """Test webhook ignores non-WhatsApp events."""
        payload = {
            "object": "instagram",
            "entry": []
        }
        
        response = client.post("/webhook", json=payload)
        
        assert response.status_code == 200
        assert response.json() == {"status": "EVENT_RECEIVED"}
    
    def test_webhook_post_empty_messages(self, client):
        """Test webhook handles empty messages array."""
        payload = {
            "object": "whatsapp_business_account",
            "entry": [
                {
                    "id": "123",
                    "changes": [
                        {
                            "value": {
                                "messaging_product": "whatsapp",
                                "metadata": {
                                    "display_phone_number": "15551234567",
                                    "phone_number_id": "123456789"
                                },
                                "messages": []
                            },
                            "field": "messages"
                        }
                    ]
                }
            ]
        }
        
        response = client.post("/webhook", json=payload)
        
        assert response.status_code == 200
        assert response.json() == {"status": "EVENT_RECEIVED"}
    
    def test_webhook_post_malformed_json(self, client):
        """Test webhook handles malformed JSON gracefully."""
        response = client.post(
            "/webhook",
            content="not valid json",
            headers={"Content-Type": "application/json"}
        )
        
        # Should return 422 for invalid JSON
        assert response.status_code in (200, 422)
    
    def test_webhook_post_interactive_message(self, client, sample_interactive_payload):
        """Test webhook handles interactive replies."""
        with patch('src.webhook.process_message_async', new_callable=AsyncMock):
            response = client.post("/webhook", json=sample_interactive_payload)
        
        assert response.status_code == 200
        assert response.json() == {"status": "EVENT_RECEIVED"}

