"""
Tests for WhatsApp and AlphaBoard clients.
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
import httpx

from src.whatsapp_client import WhatsAppClient
from src.alphaboard_client import AlphaBoardClient, AlphaBoardClientError


class TestWhatsAppClient:
    """Tests for WhatsAppClient class."""
    
    @pytest.fixture
    def client(self, test_settings):
        """Create WhatsApp client with test settings."""
        return WhatsAppClient(test_settings)
    
    @pytest.mark.asyncio
    async def test_send_text_message_payload(self, client):
        """Test send_text_message builds correct payload."""
        with patch.object(client._client, 'post', new_callable=AsyncMock) as mock_post:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {"messages": [{"id": "msg_123"}]}
            mock_post.return_value = mock_response
            
            await client.send_text_message("919876543210", "Hello!")
            
            mock_post.assert_called_once()
            call_kwargs = mock_post.call_args[1]
            payload = call_kwargs['json']
            
            assert payload['messaging_product'] == 'whatsapp'
            assert payload['to'] == '919876543210'
            assert payload['type'] == 'text'
            assert payload['text']['body'] == 'Hello!'
    
    @pytest.mark.asyncio
    async def test_send_template_message_payload(self, client):
        """Test send_template_message builds correct payload."""
        with patch.object(client._client, 'post', new_callable=AsyncMock) as mock_post:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {"messages": [{"id": "msg_123"}]}
            mock_post.return_value = mock_response
            
            await client.send_template_message(
                "919876543210",
                "daily_market_close",
                "en_US"
            )
            
            mock_post.assert_called_once()
            call_kwargs = mock_post.call_args[1]
            payload = call_kwargs['json']
            
            assert payload['type'] == 'template'
            assert payload['template']['name'] == 'daily_market_close'
            assert payload['template']['language']['code'] == 'en_US'
    
    @pytest.mark.asyncio
    async def test_send_interactive_buttons_payload(self, client):
        """Test send_interactive_buttons builds correct payload."""
        with patch.object(client._client, 'post', new_callable=AsyncMock) as mock_post:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {"messages": [{"id": "msg_123"}]}
            mock_post.return_value = mock_response
            
            buttons = [
                {"id": "btn_1", "title": "Option 1"},
                {"id": "btn_2", "title": "Option 2"}
            ]
            
            await client.send_interactive_buttons(
                "919876543210",
                "Choose an option:",
                buttons
            )
            
            mock_post.assert_called_once()
            call_kwargs = mock_post.call_args[1]
            payload = call_kwargs['json']
            
            assert payload['type'] == 'interactive'
            assert payload['interactive']['type'] == 'button'
            assert len(payload['interactive']['action']['buttons']) == 2
    
    @pytest.mark.asyncio
    async def test_send_interactive_list_payload(self, client):
        """Test send_interactive_list builds correct payload."""
        with patch.object(client._client, 'post', new_callable=AsyncMock) as mock_post:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {"messages": [{"id": "msg_123"}]}
            mock_post.return_value = mock_response
            
            sections = [
                {
                    "title": "Section 1",
                    "rows": [
                        {"id": "row_1", "title": "Row 1"}
                    ]
                }
            ]
            
            await client.send_interactive_list(
                "919876543210",
                "Choose from list:",
                "Open Menu",
                sections
            )
            
            mock_post.assert_called_once()
            call_kwargs = mock_post.call_args[1]
            payload = call_kwargs['json']
            
            assert payload['type'] == 'interactive'
            assert payload['interactive']['type'] == 'list'
            assert payload['interactive']['action']['button'] == 'Open Menu'
    
    @pytest.mark.asyncio
    async def test_api_error_handling(self, client):
        """Test API error handling doesn't raise."""
        with patch.object(client._client, 'post', new_callable=AsyncMock) as mock_post:
            mock_response = MagicMock()
            mock_response.status_code = 400
            mock_response.text = "Bad request"
            mock_post.return_value = mock_response
            
            result = await client.send_text_message("919876543210", "Test")
            
            assert result.get('error') is True
            assert result.get('status_code') == 400


class TestAlphaBoardClient:
    """Tests for AlphaBoardClient class."""
    
    @pytest.fixture
    def client(self, test_settings):
        """Create AlphaBoard client with mocked Supabase."""
        with patch('src.alphaboard_client.create_client') as mock_create:
            mock_supabase = MagicMock()
            mock_create.return_value = mock_supabase
            client = AlphaBoardClient(test_settings)
            client.supabase = mock_supabase
            return client
    
    @pytest.mark.asyncio
    async def test_get_or_create_user_existing(self, client):
        """Test getting existing user by phone."""
        mock_result = MagicMock()
        mock_result.data = [{"id": "user_123", "phone": "919876543210"}]
        
        client.supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_result
        client.supabase.table.return_value.update.return_value.eq.return_value.execute.return_value = mock_result
        
        user = await client.get_or_create_user_by_phone("919876543210")
        
        assert user["id"] == "user_123"
        assert user["phone"] == "919876543210"
    
    @pytest.mark.asyncio
    async def test_get_or_create_user_new(self, client):
        """Test creating new user when not found."""
        mock_empty = MagicMock()
        mock_empty.data = []
        
        mock_created = MagicMock()
        mock_created.data = [{"id": "new_user", "phone": "919876543210"}]
        
        # First call (select) returns empty, second call (insert) returns new user
        client.supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_empty
        client.supabase.table.return_value.insert.return_value.execute.return_value = mock_created
        
        user = await client.get_or_create_user_by_phone("919876543210")
        
        assert user["id"] == "new_user"
    
    @pytest.mark.asyncio
    async def test_add_to_watchlist(self, client):
        """Test adding to watchlist."""
        mock_empty = MagicMock()
        mock_empty.data = []
        
        mock_result = MagicMock()
        mock_result.data = [{"id": "wl_123", "ticker": "TCS", "note": "test"}]
        
        client.supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = mock_empty
        client.supabase.table.return_value.insert.return_value.execute.return_value = mock_result
        
        item = await client.add_to_watchlist("user_123", "TCS", "test")
        
        assert item["ticker"] == "TCS"
    
    @pytest.mark.asyncio
    async def test_list_watchlist(self, client):
        """Test listing watchlist."""
        mock_result = MagicMock()
        mock_result.data = [
            {"id": "1", "ticker": "TCS"},
            {"id": "2", "ticker": "INFY"}
        ]
        
        client.supabase.table.return_value.select.return_value.eq.return_value.order.return_value.execute.return_value = mock_result
        
        items = await client.list_watchlist("user_123")
        
        assert len(items) == 2
        assert items[0]["ticker"] == "TCS"
    
    @pytest.mark.asyncio
    async def test_add_recommendation(self, client):
        """Test adding recommendation."""
        mock_result = MagicMock()
        mock_result.data = [{
            "id": "rec_123",
            "ticker": "INFY",
            "price": 1650.0,
            "thesis": "digital play"
        }]
        
        client.supabase.table.return_value.insert.return_value.execute.return_value = mock_result
        
        rec = await client.add_recommendation("user_123", "INFY", 1650.0, "digital play")
        
        assert rec["ticker"] == "INFY"
        assert rec["price"] == 1650.0
    
    @pytest.mark.asyncio
    async def test_database_error_handling(self, client):
        """Test database error raises AlphaBoardClientError."""
        client.supabase.table.return_value.select.return_value.eq.return_value.execute.side_effect = Exception("DB error")
        
        with pytest.raises(AlphaBoardClientError):
            await client.get_or_create_user_by_phone("919876543210")

