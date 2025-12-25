"""
Tests for message engine and command routing.
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from datetime import datetime

from src.engine import MessageEngine
from src.schemas import ParsedMessage


class TestMessageEngine:
    """Tests for MessageEngine class."""
    
    @pytest.fixture
    def engine(self, test_settings, mock_whatsapp_client, mock_alphaboard_client):
        """Create engine with mocked clients."""
        engine = MessageEngine(test_settings)
        engine.wa_client = mock_whatsapp_client
        engine.ab_client = mock_alphaboard_client
        return engine
    
    @pytest.fixture
    def make_message(self):
        """Factory for creating test messages."""
        def _make(text: str = "hello", msg_type: str = "text"):
            return ParsedMessage(
                sender_phone="919876543210",
                message_type=msg_type,
                text_body=text if msg_type == "text" else None,
                interactive_id=text if msg_type.startswith("interactive") else None,
                interactive_title=text if msg_type.startswith("interactive") else None,
                phone_number_id="123456789",
                timestamp=datetime.utcnow(),
                raw_message_id="wamid.123"
            )
        return _make
    
    @pytest.mark.asyncio
    async def test_help_command(self, engine, make_message):
        """Test help command sends main menu."""
        message = make_message("help")
        
        await engine.handle_incoming_message(message)
        
        engine.wa_client.send_main_menu.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_menu_command(self, engine, make_message):
        """Test menu command sends main menu."""
        message = make_message("menu")
        
        await engine.handle_incoming_message(message)
        
        engine.wa_client.send_main_menu.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_add_watchlist_simple(self, engine, make_message):
        """Test simple add to watchlist command."""
        message = make_message("add TCS")
        
        await engine.handle_incoming_message(message)
        
        engine.ab_client.add_to_watchlist.assert_called_once()
        call_args = engine.ab_client.add_to_watchlist.call_args
        assert call_args[0][1] == "TCS"  # ticker
        assert call_args[0][2] is None  # note
    
    @pytest.mark.asyncio
    async def test_add_watchlist_with_note(self, engine, make_message):
        """Test add to watchlist with note."""
        message = make_message("add INFY - long term compounding")
        
        await engine.handle_incoming_message(message)
        
        engine.ab_client.add_to_watchlist.assert_called_once()
        call_args = engine.ab_client.add_to_watchlist.call_args
        assert call_args[0][1] == "INFY"
        assert call_args[0][2] == "long term compounding"
    
    @pytest.mark.asyncio
    async def test_watch_command(self, engine, make_message):
        """Test watch command adds to watchlist."""
        message = make_message("watch RELIANCE")
        
        await engine.handle_incoming_message(message)
        
        engine.ab_client.add_to_watchlist.assert_called_once()
        call_args = engine.ab_client.add_to_watchlist.call_args
        assert call_args[0][1] == "RELIANCE"
    
    @pytest.mark.asyncio
    async def test_show_watchlist(self, engine, make_message):
        """Test show watchlist command."""
        message = make_message("my watchlist")
        
        await engine.handle_incoming_message(message)
        
        engine.ab_client.list_watchlist.assert_called_once()
        engine.wa_client.send_text_message.assert_called()
    
    @pytest.mark.asyncio
    async def test_recommendation_full(self, engine, make_message):
        """Test full recommendation command."""
        message = make_message("rec INFY @ 1650 long term bet")
        
        await engine.handle_incoming_message(message)
        
        engine.ab_client.add_recommendation.assert_called_once()
        call_args = engine.ab_client.add_recommendation.call_args
        assert call_args[0][1] == "INFY"  # ticker
        assert call_args[0][2] == 1650.0  # price
        assert "long term bet" in call_args[0][3]  # thesis
    
    @pytest.mark.asyncio
    async def test_recommendation_no_price(self, engine, make_message):
        """Test recommendation without price."""
        message = make_message("rec TCS great company")
        
        await engine.handle_incoming_message(message)
        
        engine.ab_client.add_recommendation.assert_called_once()
        call_args = engine.ab_client.add_recommendation.call_args
        assert call_args[0][1] == "TCS"
        assert call_args[0][2] is None  # no price
    
    @pytest.mark.asyncio
    async def test_podcast_request(self, engine, make_message):
        """Test podcast request command."""
        message = make_message("podcast TCS")
        
        await engine.handle_incoming_message(message)
        
        engine.ab_client.request_podcast.assert_called_once()
        call_args = engine.ab_client.request_podcast.call_args
        assert call_args[0][1] == "TCS"
    
    @pytest.mark.asyncio
    async def test_podcast_topic(self, engine, make_message):
        """Test podcast with topic."""
        message = make_message("podcast on market today")
        
        await engine.handle_incoming_message(message)
        
        engine.ab_client.request_podcast.assert_called_once()
        call_args = engine.ab_client.request_podcast.call_args
        assert "market today" in call_args[0][1]
    
    @pytest.mark.asyncio
    async def test_news_request(self, engine, make_message):
        """Test news request command."""
        message = make_message("news TCS")
        
        await engine.handle_incoming_message(message)
        
        engine.ab_client.get_news_for_ticker.assert_called_once_with("TCS")
    
    @pytest.mark.asyncio
    async def test_market_close(self, engine, make_message):
        """Test market close command."""
        message = make_message("market close")
        
        with patch.object(engine.market_service, 'build_daily_summary', new_callable=AsyncMock) as mock_summary:
            mock_summary.return_value = "Market summary text"
            await engine.handle_incoming_message(message)
        
        mock_summary.assert_called_once()
        engine.wa_client.send_text_message.assert_called()
    
    @pytest.mark.asyncio
    async def test_ticker_query(self, engine, make_message):
        """Test standalone ticker query."""
        message = make_message("TCS")
        
        await engine.handle_incoming_message(message)
        
        engine.ab_client.get_stock_summary.assert_called_once_with("TCS")
        engine.ab_client.get_stock_price.assert_called_once_with("TCS")
    
    @pytest.mark.asyncio
    async def test_interactive_watchlist_menu(self, engine, make_message):
        """Test interactive menu selection for watchlist."""
        message = ParsedMessage(
            sender_phone="919876543210",
            message_type="interactive_list",
            interactive_id="menu_show_watchlist",
            interactive_title="My Watchlist",
            phone_number_id="123456789",
            timestamp=datetime.utcnow(),
            raw_message_id="wamid.123"
        )
        
        await engine.handle_incoming_message(message)
        
        engine.ab_client.list_watchlist.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_fallback_unknown_command(self, engine, make_message):
        """Test fallback for unknown command."""
        message = make_message("some random text that doesn't match")
        
        await engine.handle_incoming_message(message)
        
        # Should send fallback help message
        engine.wa_client.send_text_message.assert_called()
        call_args = engine.wa_client.send_text_message.call_args
        assert "Try" in call_args[0][1] or "didn't" in call_args[0][1]

