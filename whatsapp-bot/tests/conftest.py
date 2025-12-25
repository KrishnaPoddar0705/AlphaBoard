"""
Pytest configuration and fixtures.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock
from fastapi.testclient import TestClient

from src.config import Settings
from src.main import app


@pytest.fixture
def test_settings():
    """Create test settings with mock values."""
    return Settings(
        META_WHATSAPP_ACCESS_TOKEN="test_token",
        META_WHATSAPP_API_VERSION="v22.0",
        META_WHATSAPP_PHONE_NUMBER_ID="123456789",
        META_WHATSAPP_VERIFY_TOKEN="test_verify_token",
        SUPABASE_URL="https://test.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY="test_service_key",
        ALPHABOARD_API_BASE_URL="http://localhost:8000",
        ADMIN_API_KEY="test_admin_key",
        ENVIRONMENT="local",
        LOG_LEVEL="DEBUG"
    )


@pytest.fixture
def client():
    """Create FastAPI test client."""
    return TestClient(app)


@pytest.fixture
def mock_whatsapp_client():
    """Create mock WhatsApp client."""
    mock = AsyncMock()
    mock.send_text_message = AsyncMock(return_value={"messages": [{"id": "msg_123"}]})
    mock.send_template_message = AsyncMock(return_value={"messages": [{"id": "msg_123"}]})
    mock.send_interactive_buttons = AsyncMock(return_value={"messages": [{"id": "msg_123"}]})
    mock.send_interactive_list = AsyncMock(return_value={"messages": [{"id": "msg_123"}]})
    mock.send_main_menu = AsyncMock(return_value={"messages": [{"id": "msg_123"}]})
    mock.mark_message_read = AsyncMock(return_value={"success": True})
    mock.health_check = AsyncMock(return_value=True)
    mock.close = AsyncMock()
    return mock


@pytest.fixture
def mock_alphaboard_client():
    """Create mock AlphaBoard client."""
    mock = AsyncMock()
    mock.get_or_create_user_by_phone = AsyncMock(return_value={
        "id": "user_123",
        "phone": "919876543210",
        "display_name": "Test User",
        "is_daily_subscriber": True
    })
    mock.add_to_watchlist = AsyncMock(return_value={
        "id": "wl_123",
        "ticker": "TCS",
        "note": None
    })
    mock.list_watchlist = AsyncMock(return_value=[
        {"id": "wl_1", "ticker": "TCS", "note": "long term"},
        {"id": "wl_2", "ticker": "INFY", "note": None}
    ])
    mock.add_recommendation = AsyncMock(return_value={
        "id": "rec_123",
        "ticker": "INFY",
        "price": 1650.0,
        "thesis": "digital play"
    })
    mock.list_recent_recommendations = AsyncMock(return_value=[])
    mock.request_podcast = AsyncMock(return_value={
        "id": "pod_123",
        "topic": "TCS",
        "status": "pending"
    })
    mock.get_news_for_ticker = AsyncMock(return_value=[
        {
            "headline": "TCS reports strong Q3",
            "summary_tldr": "Beat estimates by 5%",
            "sentiment": "positive"
        }
    ])
    mock.get_stock_summary = AsyncMock(return_value={
        "shortName": "Tata Consultancy Services",
        "regularMarketPrice": 3500.0,
        "regularMarketChange": 50.0,
        "regularMarketChangePercent": 1.5
    })
    mock.get_stock_price = AsyncMock(return_value=3500.0)
    mock.health_check = AsyncMock(return_value=True)
    mock.database_health_check = MagicMock(return_value=True)
    mock.close = AsyncMock()
    return mock


@pytest.fixture
def sample_webhook_payload():
    """Sample WhatsApp webhook payload for testing."""
    return {
        "object": "whatsapp_business_account",
        "entry": [
            {
                "id": "123456789",
                "changes": [
                    {
                        "value": {
                            "messaging_product": "whatsapp",
                            "metadata": {
                                "display_phone_number": "15551234567",
                                "phone_number_id": "123456789"
                            },
                            "contacts": [
                                {
                                    "profile": {"name": "Test User"},
                                    "wa_id": "919876543210"
                                }
                            ],
                            "messages": [
                                {
                                    "from": "919876543210",
                                    "id": "wamid.123",
                                    "timestamp": "1640000000",
                                    "type": "text",
                                    "text": {"body": "add TCS"}
                                }
                            ]
                        },
                        "field": "messages"
                    }
                ]
            }
        ]
    }


@pytest.fixture
def sample_interactive_payload():
    """Sample interactive reply webhook payload."""
    return {
        "object": "whatsapp_business_account",
        "entry": [
            {
                "id": "123456789",
                "changes": [
                    {
                        "value": {
                            "messaging_product": "whatsapp",
                            "metadata": {
                                "display_phone_number": "15551234567",
                                "phone_number_id": "123456789"
                            },
                            "contacts": [
                                {
                                    "profile": {"name": "Test User"},
                                    "wa_id": "919876543210"
                                }
                            ],
                            "messages": [
                                {
                                    "from": "919876543210",
                                    "id": "wamid.456",
                                    "timestamp": "1640000000",
                                    "type": "interactive",
                                    "interactive": {
                                        "type": "list_reply",
                                        "list_reply": {
                                            "id": "menu_show_watchlist",
                                            "title": "My Watchlist"
                                        }
                                    }
                                }
                            ]
                        },
                        "field": "messages"
                    }
                ]
            }
        ]
    }

