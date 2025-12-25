"""
Message Engine.
Central message routing and command parser for WhatsApp bot.
"""

import re
import logging
from typing import Optional, Dict, Any, Tuple

from .config import Settings
from .schemas import ParsedMessage
from .whatsapp_client import WhatsAppClient
from .alphaboard_client import AlphaBoardClient, AlphaBoardClientError
from .services.templates import Templates
from .services.market_reports import MarketReportService
from .conversation_state import state_manager, ConversationFlow

logger = logging.getLogger(__name__)


class MessageEngine:
    """
    Central message routing engine.
    Handles command parsing and response generation.
    """
    
    # Regex patterns for command parsing
    TICKER_PATTERN = re.compile(r'^[A-Z]{2,10}(?:\.[A-Z]{2})?$', re.IGNORECASE)
    
    # Command patterns
    ADD_WATCHLIST_PATTERNS = [
        re.compile(r'^add\s+([A-Z0-9.]+)(?:\s*[-:]\s*(.+))?$', re.IGNORECASE),
        re.compile(r'^watch\s+([A-Z0-9.]+)(?:\s*[-:]\s*(.+))?$', re.IGNORECASE),
    ]
    
    REC_PATTERN = re.compile(
        r'^rec(?:ommend)?\s+([A-Z0-9.]+)(?:\s*[@at]+\s*(\d+(?:\.\d+)?))?\s*(.*)$',
        re.IGNORECASE
    )
    
    PODCAST_PATTERN = re.compile(
        r'^podcast\s+(?:on\s+|about\s+)?(.+)$',
        re.IGNORECASE
    )
    
    NEWS_PATTERN = re.compile(
        r'^news\s+(?:on\s+|for\s+)?([A-Z0-9.]+)$',
        re.IGNORECASE
    )
    
    def __init__(self, settings: Settings):
        """
        Initialize message engine.
        
        Args:
            settings: Application settings
        """
        self.settings = settings
        self.wa_client = WhatsAppClient(settings)
        self.ab_client = AlphaBoardClient(settings)
        self.market_service = MarketReportService(settings)
    
    async def close(self):
        """Close all clients."""
        await self.wa_client.close()
        await self.ab_client.close()
    
    async def handle_incoming_message(self, message: ParsedMessage) -> None:
        """
        Handle an incoming message and send appropriate response.
        
        Args:
            message: Parsed incoming message
        """
        sender_phone = message.sender_phone
        
        try:
            # Mark message as read
            await self.wa_client.mark_message_read(message.raw_message_id)
            
            # Ensure user exists
            user = await self.ab_client.get_or_create_user_by_phone(sender_phone)
            user_id = user["id"]
            
            # Route based on message type
            if message.message_type == "text":
                await self._handle_text_message(sender_phone, user_id, message.text_body or "")
            
            elif message.message_type in ("interactive_button", "interactive_list"):
                await self._handle_interactive_reply(
                    sender_phone,
                    user_id,
                    message.interactive_id or "",
                    message.interactive_title or ""
                )
            
            else:
                # Unknown message type
                await self._send_help_message(sender_phone)
                
        except AlphaBoardClientError as e:
            logger.error(f"AlphaBoard error: {e}")
            await self._send_error_message(sender_phone)
        except Exception as e:
            logger.error(f"Error handling message: {e}")
            await self._send_error_message(sender_phone)
    
    async def _handle_text_message(self, phone: str, user_id: str, text: str) -> None:
        """
        Handle a text message and route to appropriate handler.
        
        Args:
            phone: Sender phone number
            user_id: WhatsApp user ID
            text: Message text
        """
        text = text.strip()
        text_lower = text.lower()
        
        # Check for cancel command first
        if text_lower in ("cancel", "exit", "quit", "stop"):
            if state_manager.is_in_flow(user_id):
                state_manager.cancel_flow(user_id)
                await self.wa_client.send_text_message(phone, "❌ Cancelled. Type *menu* to start over.")
            else:
                await self.wa_client.send_main_menu(phone)
            return
        
        # Check if user is in a conversation flow
        if state_manager.is_in_flow(user_id):
            await self._handle_conversation_flow(phone, user_id, text)
            return
        
        # Check for menu/help commands
        if text_lower in ("help", "menu", "hi", "hello", "start", "hey", "?"):
            await self.wa_client.send_main_menu(phone)
            return
        
        # Check for quick add rec command
        if text_lower in ("add", "new", "rec", "recommend", "add rec", "new rec"):
            await self._start_recommendation_flow(phone, user_id)
            return
        
        # Check for alert command
        if text_lower in ("alert", "set alert", "alerts", "price alert"):
            await self._start_alert_flow(phone, user_id)
            return
        
        # Check for signup/connect commands
        if text_lower in ("signup", "sign up", "register", "create account"):
            await self._handle_signup(phone, user_id)
            return
        
        if text_lower in ("connect", "link", "link account", "connect account", "signin", "sign in", "login"):
            await self._handle_connect_account(phone, user_id)
            return
        
        if text_lower in ("account", "my account", "account status", "status"):
            await self._handle_account_status(phone, user_id)
            return
        
        if text_lower in ("unlink", "unlink account", "disconnect", "disconnect account"):
            await self._handle_unlink_account(phone, user_id)
            return
        
        # Check for watchlist view
        if text_lower in ("my watchlist", "watchlist", "show watchlist", "list watchlist"):
            await self._handle_show_watchlist(phone, user_id)
            return
        
        # Check for recommendations view
        if text_lower in ("my recs", "my recommendations", "recommendations", "show recs", "recs"):
            await self._handle_show_recommendations(phone, user_id, show_closed=False)
            return
        
        # Check for history/closed positions view
        if text_lower in ("history", "closed", "closed recs", "pnl", "full pnl"):
            await self._handle_show_recommendations(phone, user_id, show_closed=True)
            return
        
        # Check for admin track command
        if text_lower in ("track", "track position", "track positions", "analyst", "team performance"):
            await self._handle_admin_track_start(phone, user_id)
            return
        
        # Check for market close
        if text_lower in ("market close", "market", "today summary", "daily report", "summary"):
            await self._handle_market_close(phone, user_id)
            return
        
        # Check for add to watchlist pattern
        for pattern in self.ADD_WATCHLIST_PATTERNS:
            match = pattern.match(text)
            if match:
                ticker = match.group(1).upper()
                note = match.group(2).strip() if match.group(2) else None
                await self._handle_add_watchlist(phone, user_id, ticker, note)
                return
        
        # Check for quick recommendation pattern (rec TCS @ 320 thesis)
        match = self.REC_PATTERN.match(text)
        if match:
            ticker = match.group(1).upper()
            price_str = match.group(2)
            price = float(price_str) if price_str else None
            thesis = match.group(3).strip() if match.group(3) else None
            await self._handle_add_recommendation_complete(phone, user_id, ticker, "BUY", price, thesis)
            return
        
        # Check for podcast request
        match = self.PODCAST_PATTERN.match(text)
        if match:
            topic = match.group(1).strip()
            await self._handle_podcast_request(phone, user_id, topic)
            return
        
        # Check for news request
        match = self.NEWS_PATTERN.match(text)
        if match:
            ticker = match.group(1).upper()
            await self._handle_news_request(phone, user_id, ticker)
            return
        
        # Check if it looks like a standalone ticker
        if self.TICKER_PATTERN.match(text):
            ticker = text.upper()
            await self._handle_ticker_query(phone, ticker)
            return
        
        # Fallback: show help with examples
        await self._send_fallback_help(phone)
    
    async def _handle_interactive_reply(
        self,
        phone: str,
        user_id: str,
        reply_id: str,
        reply_title: str
    ) -> None:
        """
        Handle an interactive button or list reply.
        
        Args:
            phone: Sender phone number
            user_id: WhatsApp user ID
            reply_id: Interactive reply ID
            reply_title: Interactive reply title
        """
        # Handle action selection for recommendation flow
        if reply_id.startswith("action_"):
            action = reply_id.replace("action_", "").upper()
            await self._handle_action_selected(phone, user_id, action)
            return
        
        # Handle thesis skip
        if reply_id == "thesis_skip":
            await self._handle_thesis_skip(phone, user_id)
            return
        
        # Map interactive IDs to actions
        if reply_id == "menu_add_watchlist":
            # Start watchlist flow
            state_manager.start_flow(user_id, ConversationFlow.ADD_WATCHLIST)
            await self.wa_client.send_text_message(
                phone,
                "👀 *Add to Watchlist*\n\nSend the stock ticker:\n\nExamples:\n• TCS\n• RELIANCE\n• INFY.NS"
            )
        
        elif reply_id == "menu_add_recommendation":
            # Start recommendation flow with action selector
            await self._start_recommendation_flow(phone, user_id)
        
        elif reply_id == "menu_set_alert":
            await self._start_alert_flow(phone, user_id)
        
        elif reply_id == "menu_show_watchlist":
            await self._handle_show_watchlist(phone, user_id)
        
        elif reply_id == "menu_my_recs":
            await self._handle_show_recommendations(phone, user_id)
        
        elif reply_id == "menu_market_close":
            await self._handle_market_close(phone, user_id)
        
        elif reply_id == "menu_news":
            await self.wa_client.send_text_message(
                phone,
                Templates.NEWS_PROMPT
            )
        
        elif reply_id == "menu_podcast":
            await self.wa_client.send_text_message(
                phone,
                Templates.PODCAST_PROMPT
            )
        
        elif reply_id == "menu_help":
            await self.wa_client.send_text_message(
                phone,
                Templates.HELP_MESSAGE
            )
        
        elif reply_id == "menu_connect_account":
            await self._handle_connect_account(phone, user_id)
        
        elif reply_id == "menu_account_status":
            await self._handle_account_status(phone, user_id)
        
        elif reply_id == "menu_signup":
            await self._handle_signup(phone, user_id)
        
        elif reply_id == "menu_track_analyst":
            await self._handle_admin_track_start(phone, user_id)
        
        elif reply_id.startswith("team_"):
            # Team selected in track analyst flow
            team_id = reply_id.replace("team_", "")
            await self._handle_team_selected(phone, user_id, team_id)
        
        elif reply_id.startswith("analyst_"):
            # Analyst selected in track analyst flow
            analyst_id = reply_id.replace("analyst_", "")
            await self._handle_analyst_selected(phone, user_id, analyst_id)
        
        elif reply_id == "track_all_org":
            await self._handle_track_all_organization(phone, user_id)
        
        elif reply_id.startswith("analyst_status_"):
            # View OPEN/CLOSED for analyst
            parts = reply_id.replace("analyst_status_", "").split("_", 1)
            if len(parts) == 2:
                status = parts[0].upper()  # OPEN or CLOSED
                analyst_id = parts[1]
                await self._handle_show_analyst_recs(phone, user_id, analyst_id, status)
        
        else:
            # Unknown interactive reply
            await self._send_fallback_help(phone)
    
    # =========================================================================
    # Command Handlers
    # =========================================================================
    
    async def _handle_add_watchlist(
        self,
        phone: str,
        user_id: str,
        ticker: str,
        note: Optional[str]
    ) -> None:
        """Handle add to watchlist command."""
        try:
            await self.ab_client.add_to_watchlist(user_id, ticker, note)
            
            response = f"✅ Added *{ticker}* to your AlphaBoard watchlist!"
            if note:
                response += f"\n📝 Note: {note}"
            response += "\n\n💡 Send \"my watchlist\" to see everything."
            
            await self.wa_client.send_text_message(phone, response)
            
        except AlphaBoardClientError as e:
            logger.error(f"Error adding to watchlist: {e}")
            await self.wa_client.send_text_message(
                phone,
                f"❌ Couldn't add {ticker} to watchlist. Please try again."
            )
    
    async def _handle_show_watchlist(self, phone: str, user_id: str) -> None:
        """Handle show watchlist command. Shows both WhatsApp and AlphaBoard watchlist if linked."""
        try:
            # Get WhatsApp watchlist
            wa_watchlist = await self.ab_client.list_watchlist(user_id)
            
            # Check if account is linked to get AlphaBoard watchlist too
            account_status = await self.ab_client.get_user_account_status(user_id)
            ab_watchlist = []
            price_alerts = {}
            
            if account_status.get("is_linked") and account_status.get("supabase_user_id"):
                ab_watchlist = await self.ab_client.get_alphaboard_watchlist(account_status["supabase_user_id"])
                # Get price alerts for the user
                alerts_list = await self.ab_client.get_user_price_alerts(user_id)
                for alert in alerts_list:
                    ticker = alert.get("ticker", "")
                    if ticker:
                        price_alerts[ticker] = alert
            
            # Combine watchlists (dedupe by ticker)
            all_items = {}
            
            # Add WhatsApp watchlist items
            for item in wa_watchlist:
                ticker = item["ticker"]
                created_at = item.get("created_at", "")
                date_str = created_at[:10] if created_at else ""
                all_items[ticker] = {
                    "ticker": ticker,
                    "note": item.get("note", ""),
                    "date_added": date_str,
                    "entry_price": None,
                    "current_price": None,
                    "source": "whatsapp"
                }
            
            # Add AlphaBoard watchlist items (with WATCHLIST status) - has more data
            for item in ab_watchlist:
                ticker = item.get("ticker", "")
                if not ticker:
                    continue
                entry_date = item.get("entry_date", "")
                date_str = entry_date[:10] if entry_date else ""
                entry_price = item.get("entry_price")
                current_price = item.get("current_price")
                
                # Merge or add
                if ticker in all_items:
                    # Update with richer data from AlphaBoard
                    all_items[ticker].update({
                        "entry_price": entry_price,
                        "current_price": current_price,
                        "date_added": date_str or all_items[ticker]["date_added"]
                    })
                else:
                    all_items[ticker] = {
                        "ticker": ticker,
                        "note": "",
                        "date_added": date_str,
                        "entry_price": entry_price,
                        "current_price": current_price,
                        "source": "alphaboard"
                    }
            
            if not all_items:
                await self.wa_client.send_text_message(
                    phone,
                    Templates.EMPTY_WATCHLIST
                )
                return
            
            # Format watchlist with new layout
            watchlist_items = list(all_items.values())
            
            lines = ["📋 *Your Watchlist*\n"]
            
            for i, item in enumerate(watchlist_items[:15], 1):
                ticker = item["ticker"]
                date_added = item.get("date_added", "")
                entry_price = item.get("entry_price")
                current_price = item.get("current_price")
                
                # Build line: Ticker
                line = f"{i}. *{ticker}*"
                
                # Date Added
                if date_added:
                    line += f"\n   📅 {date_added}"
                
                # Prices and Return
                if entry_price and current_price:
                    return_pct = ((current_price - entry_price) / entry_price) * 100
                    ret_emoji = "🟢" if return_pct >= 0 else "🔴"
                    line += f"\n   ₹{entry_price:,.0f} → ₹{current_price:,.0f} | {ret_emoji} {return_pct:+.1f}%"
                elif entry_price:
                    line += f"\n   Entry: ₹{entry_price:,.0f}"
                elif current_price:
                    line += f"\n   CMP: ₹{current_price:,.0f}"
                
                # Price Alert
                if ticker in price_alerts:
                    alert = price_alerts[ticker]
                    alert_type = alert.get("alert_type", "")
                    trigger_price = alert.get("trigger_price")
                    if trigger_price:
                        # BUY = alert when below, SELL = alert when above
                        direction = "below" if alert_type == "BUY" else "above"
                        line += f"\n   🔔 {direction} ₹{float(trigger_price):,.0f}"
                
                lines.append(line)
            
            if len(watchlist_items) > 15:
                lines.append(f"\n... and {len(watchlist_items) - 15} more")
            
            lines.append("\n💡 *add TCS* to add | *alert TCS* to set price alert")
            
            await self.wa_client.send_text_message(phone, "\n".join(lines))
            
        except AlphaBoardClientError as e:
            logger.error(f"Error fetching watchlist: {e}")
            await self._send_error_message(phone)
    
    async def _start_recommendation_flow(self, phone: str, user_id: str) -> None:
        """Start the interactive recommendation flow."""
        state_manager.start_flow(user_id, ConversationFlow.ADD_RECOMMENDATION)
        await self.wa_client.send_action_selector(phone)
    
    async def _start_alert_flow(self, phone: str, user_id: str) -> None:
        """Start the price alert flow."""
        state_manager.start_flow(user_id, ConversationFlow.SET_ALERT)
        await self.wa_client.send_alert_prompt(phone)
    
    async def _handle_action_selected(self, phone: str, user_id: str, action: str) -> None:
        """Handle action (BUY/SELL/WATCH) selection."""
        context = state_manager.get_context(user_id)
        
        if context.flow != ConversationFlow.ADD_RECOMMENDATION:
            # Not in a flow, start one
            state_manager.start_flow(user_id, ConversationFlow.ADD_RECOMMENDATION)
            context = state_manager.get_context(user_id)
        
        state_manager.advance_step(user_id, {"action": action})
        await self.wa_client.send_ticker_prompt(phone, action)
    
    async def _handle_thesis_skip(self, phone: str, user_id: str) -> None:
        """Handle thesis skip and complete flow."""
        context = state_manager.get_context(user_id)
        
        if context.flow == ConversationFlow.ADD_RECOMMENDATION:
            data = state_manager.complete_flow(user_id)
            await self._handle_add_recommendation_complete(
                phone, user_id,
                data.get("ticker", ""),
                data.get("action", "BUY"),
                data.get("price"),
                None  # No thesis
            )
    
    async def _handle_conversation_flow(self, phone: str, user_id: str, text: str) -> None:
        """Handle input during a conversation flow."""
        context = state_manager.get_context(user_id)
        
        if context.flow == ConversationFlow.ADD_RECOMMENDATION:
            await self._handle_recommendation_flow_input(phone, user_id, text, context)
        elif context.flow == ConversationFlow.ADD_WATCHLIST:
            await self._handle_watchlist_flow_input(phone, user_id, text, context)
        elif context.flow == ConversationFlow.SET_ALERT:
            await self._handle_alert_flow_input(phone, user_id, text, context)
        else:
            state_manager.cancel_flow(user_id)
            await self._send_fallback_help(phone)
    
    async def _handle_recommendation_flow_input(
        self, phone: str, user_id: str, text: str, context
    ) -> None:
        """Handle input during recommendation flow."""
        step = context.step
        
        if step == 2:
            # Waiting for ticker (and optional price)
            parsed = self._parse_ticker_price(text)
            if not parsed:
                await self.wa_client.send_text_message(
                    phone,
                    "❌ Couldn't understand that. Send ticker like:\n• TCS @ 3500\n• RELIANCE\n\nOr type *cancel* to exit."
                )
                return
            
            ticker, price = parsed
            action = context.data.get("action", "BUY")
            
            state_manager.advance_step(user_id, {"ticker": ticker, "price": price})
            
            # Ask for thesis
            await self.wa_client.send_thesis_prompt(phone, ticker, action, price)
        
        elif step == 3:
            # Waiting for thesis
            thesis = text.strip() if text.strip().lower() not in ("skip", "none", "-") else None
            data = state_manager.complete_flow(user_id)
            
            await self._handle_add_recommendation_complete(
                phone, user_id,
                data.get("ticker", ""),
                data.get("action", "BUY"),
                data.get("price"),
                thesis
            )
    
    async def _handle_watchlist_flow_input(
        self, phone: str, user_id: str, text: str, context
    ) -> None:
        """Handle input during watchlist flow."""
        parsed = self._parse_ticker_price(text)
        if not parsed:
            await self.wa_client.send_text_message(
                phone,
                "❌ Couldn't understand that. Send a ticker like:\n• TCS\n• RELIANCE\n\nOr type *cancel* to exit."
            )
            return
        
        ticker, _ = parsed
        state_manager.complete_flow(user_id)
        
        await self._handle_add_watchlist(phone, user_id, ticker, None)
    
    async def _handle_alert_flow_input(
        self, phone: str, user_id: str, text: str, context
    ) -> None:
        """Handle input during alert flow."""
        # Parse alert: "TCS below 3400" or "RELIANCE above 1600" or "TCS @ 3400"
        alert_pattern = re.compile(
            r'^([A-Z0-9.]+)\s*(below|above|@|at)?\s*(\d+(?:\.\d+)?)$',
            re.IGNORECASE
        )
        match = alert_pattern.match(text.strip())
        
        if not match:
            await self.wa_client.send_text_message(
                phone,
                "❌ Couldn't understand that. Try:\n• TCS below 3400\n• RELIANCE above 1600\n\nOr type *cancel* to exit."
            )
            return
        
        ticker = match.group(1).upper()
        direction_raw = (match.group(2) or "below").lower()
        price = float(match.group(3))
        
        # Map @ and at to "below" (alert when price drops to level)
        direction = "below" if direction_raw in ("@", "at", "below") else "above"
        
        state_manager.complete_flow(user_id)
        
        try:
            # Create price alert in the proper table
            result = await self.ab_client.create_price_alert(
                whatsapp_user_id=user_id,
                ticker=ticker,
                alert_type=direction,
                trigger_price=price
            )
            
            if result.get("synced_to_app"):
                await self.wa_client.send_text_message(
                    phone,
                    f"🔔 *Alert Created!*\n\n"
                    f"*{ticker}* {direction} ₹{price:,.0f}\n\n"
                    f"✅ Synced to AlphaBoard app\n"
                    f"📲 You'll get a WhatsApp message when triggered!"
                )
            else:
                await self.wa_client.send_text_message(
                    phone,
                    f"⚠️ *Alert Saved Locally*\n\n"
                    f"*{ticker}* {direction} ₹{price:,.0f}\n\n"
                    f"❌ Not synced - please *connect* your account first\n"
                    f"Type *connect* to link your AlphaBoard account."
                )
                
        except AlphaBoardClientError as e:
            logger.error(f"Error creating alert: {e}")
            await self.wa_client.send_text_message(
                phone,
                f"❌ Couldn't create alert. Please try again."
            )
    
    def _parse_ticker_price(self, text: str) -> Optional[Tuple[str, Optional[float]]]:
        """Parse ticker and optional price from text."""
        text = text.strip()
        
        # Pattern: TICKER @ PRICE or TICKER at PRICE or just TICKER
        pattern = re.compile(
            r'^([A-Z0-9.]+)(?:\s*[@at]+\s*(\d+(?:\.\d+)?))?',
            re.IGNORECASE
        )
        match = pattern.match(text)
        
        if not match:
            return None
        
        ticker = match.group(1).upper()
        
        # Validate ticker format
        if not re.match(r'^[A-Z]{2,15}(?:\.[A-Z]{2})?$', ticker):
            return None
        
        price_str = match.group(2)
        price = float(price_str) if price_str else None
        
        return (ticker, price)
    
    async def _handle_add_recommendation_complete(
        self,
        phone: str,
        user_id: str,
        ticker: str,
        action: str,
        price: Optional[float],
        thesis: Optional[str]
    ) -> None:
        """Complete adding a recommendation with all details."""
        try:
            result = await self.ab_client.add_recommendation(
                user_id, ticker, price, thesis, action
            )
            
            synced = result.get("synced_to_app", False)
            
            await self.wa_client.send_recommendation_confirmation(
                phone, ticker, action, price, thesis, synced
            )
            
        except AlphaBoardClientError as e:
            logger.error(f"Error adding recommendation: {e}")
            await self.wa_client.send_text_message(
                phone,
                f"❌ Couldn't log recommendation for {ticker}. Please try again."
            )
    
    async def _handle_add_recommendation(
        self,
        phone: str,
        user_id: str,
        ticker: str,
        price: Optional[float],
        thesis: Optional[str]
    ) -> None:
        """Handle add recommendation command (legacy, defaults to BUY)."""
        await self._handle_add_recommendation_complete(phone, user_id, ticker, "BUY", price, thesis)
    
    async def _handle_show_recommendations(self, phone: str, user_id: str, show_closed: bool = False) -> None:
        """Handle show recommendations command. Shows OPEN recs by default."""
        try:
            # Check if account is linked to get AlphaBoard recommendations
            account_status = await self.ab_client.get_user_account_status(user_id)
            ab_recs = []
            
            if account_status.get("is_linked") and account_status.get("supabase_user_id"):
                if show_closed:
                    ab_recs = await self.ab_client.get_alphaboard_closed_recommendations(
                        account_status["supabase_user_id"]
                    )
                else:
                    ab_recs = await self.ab_client.get_alphaboard_recommendations(
                        account_status["supabase_user_id"]
                    )
            
            # Also get WhatsApp-only recs if not showing closed
            wa_recs = []
            if not show_closed:
                wa_recs = await self.ab_client.list_recent_recommendations(user_id, days=90)
            
            # Combine recommendations (dedupe by ticker for open positions)
            all_recs = []
            seen_tickers = set()
            
            # Add AlphaBoard recs first (has current_price)
            for rec in ab_recs:
                ticker = rec.get("ticker", "")
                if ticker:
                    seen_tickers.add(ticker)
                    entry_price = rec.get("entry_price")
                    current_price = rec.get("current_price")
                    
                    # Calculate return
                    return_pct = None
                    if entry_price and current_price and entry_price > 0:
                        return_pct = ((current_price - entry_price) / entry_price) * 100
                    
                    all_recs.append({
                        "ticker": ticker,
                        "entry_price": entry_price,
                        "current_price": current_price,
                        "return_pct": return_pct,
                        "final_return_pct": rec.get("final_return_pct"),
                        "status": rec.get("status", "OPEN"),
                        "action": rec.get("action", "BUY"),
                        "entry_date": rec.get("entry_date")
                    })
            
            # Add WhatsApp recs that aren't synced (only for open view)
            if not show_closed:
                for rec in wa_recs:
                    ticker = rec.get("ticker", "")
                    if ticker and ticker not in seen_tickers:
                        all_recs.append({
                            "ticker": ticker,
                            "entry_price": rec.get("price"),
                            "current_price": None,
                            "return_pct": None,
                            "status": "OPEN",
                            "action": rec.get("action", "BUY"),
                            "source": "whatsapp_only"
                        })
            
            if not all_recs:
                if show_closed:
                    await self.wa_client.send_text_message(
                        phone,
                        "📊 No closed positions yet.\n\nType *my recs* to see open positions."
                    )
                else:
                    await self.wa_client.send_text_message(
                        phone,
                        "📊 No active recommendations.\n\n"
                        "💡 Type *add* to create your first pick!"
                    )
                return
            
            # Build formatted message
            is_linked = account_status.get("is_linked", False)
            
            if show_closed:
                lines = ["📊 *Closed Positions (History)*\n"]
            else:
                lines = ["📊 *Active Recommendations*\n"]
            
            for i, rec in enumerate(all_recs[:10], 1):
                ticker = rec["ticker"]
                entry = rec.get("entry_price")
                cmp = rec.get("current_price")
                return_pct = rec.get("return_pct") or rec.get("final_return_pct")
                action = rec.get("action", "BUY")
                
                # Format: BUY TICKER @ Entry | CMP | Return%
                line = f"{i}. *{action} {ticker}*"
                
                if entry:
                    line += f"\n   Entry ₹{entry:,.0f}"
                    if cmp:
                        line += f" → CMP ₹{cmp:,.0f}"
                    if return_pct is not None:
                        sign = "+" if return_pct >= 0 else ""
                        emoji = "🟢" if return_pct >= 0 else "🔴"
                        line += f" | {emoji} {sign}{return_pct:.1f}%"
                
                # Note if not synced
                if rec.get("source") == "whatsapp_only":
                    line += "\n   _(not synced - connect account)_"
                
                lines.append(line)
            
            if len(all_recs) > 10:
                lines.append(f"\n_...and {len(all_recs) - 10} more_")
            
            # Footer
            if not show_closed:
                lines.append("\n📜 Type *history* to see closed positions")
            lines.append("➕ Type *add* to log a new recommendation")
            
            await self.wa_client.send_text_message(phone, "\n".join(lines))
            
        except AlphaBoardClientError as e:
            logger.error(f"Error fetching recommendations: {e}")
            await self._send_error_message(phone)
    
    async def _handle_market_close(self, phone: str, user_id: str) -> None:
        """Handle market close summary request."""
        try:
            summary = await self.market_service.build_daily_summary()
            await self.wa_client.send_text_message(phone, summary)
            
        except Exception as e:
            logger.error(f"Error generating market summary: {e}")
            await self.wa_client.send_text_message(
                phone,
                "❌ Couldn't fetch market summary right now. Please try again later."
            )
    
    async def _handle_podcast_request(self, phone: str, user_id: str, topic: str) -> None:
        """Handle podcast request command - generate and send audio."""
        try:
            # Check if topic looks like a ticker
            if self.TICKER_PATTERN.match(topic):
                ticker = topic.upper()
                
                # Send "generating" message first
                await self.wa_client.send_text_message(
                    phone,
                    f"🎧 *Generating podcast for {ticker}...*\n\n"
                    f"This takes about 30 seconds. Please wait."
                )
                
                # Get company name for the ticker
                from .alphaboard_client import AlphaBoardClient
                company_name = ticker.replace('.NS', '').replace('.BO', '')
                
                # Generate podcast via API
                result = await self.ab_client.generate_podcast_via_api(ticker, company_name)
                
                if result.get("error"):
                    await self.wa_client.send_text_message(
                        phone,
                        f"❌ Couldn't generate podcast for {ticker}. Please try again."
                    )
                    return
                
                # Get audio and script
                audio_base64 = result.get("audioBase64")
                script = result.get("script", "")
                title = result.get("podcastTitle", f"Quick Take: {ticker}")
                key_points = result.get("keyPoints", [])
                
                # Send script/summary first
                summary_lines = [f"🎙️ *{title}*\n"]
                if key_points:
                    summary_lines.append("📝 *Key Points:*")
                    for point in key_points[:3]:
                        summary_lines.append(f"• {point}")
                
                await self.wa_client.send_text_message(phone, "\n".join(summary_lines))
                
                # Send audio if available
                if audio_base64:
                    import base64
                    audio_bytes = base64.b64decode(audio_base64)
                    
                    # Upload and send audio
                    audio_result = await self.wa_client.upload_and_send_audio(
                        phone,
                        audio_bytes,
                        filename=f"{ticker}_podcast.mp3"
                    )
                    
                    if audio_result.get("error"):
                        logger.warning(f"Could not send audio: {audio_result}")
                        await self.wa_client.send_text_message(
                            phone,
                            "⚠️ Audio couldn't be sent. Here's the script:\n\n"
                            f"_{script[:500]}{'...' if len(script) > 500 else ''}_"
                        )
                else:
                    # No audio, send script
                    await self.wa_client.send_text_message(
                        phone,
                        f"📜 *Script:*\n\n_{script[:800]}{'...' if len(script) > 800 else ''}_"
                    )
                
                # Log the request
                await self.ab_client.request_podcast(user_id, ticker)
                
            else:
                # Not a ticker - could be portfolio request
                await self.wa_client.send_text_message(
                    phone,
                    f"🎧 To generate a podcast, send:\n\n"
                    f"• *podcast TCS* - for a single stock\n"
                    f"• *podcast portfolio* - for your full portfolio\n\n"
                    f"Example: podcast RELIANCE"
                )
            
        except Exception as e:
            logger.error(f"Error generating podcast: {e}")
            await self.wa_client.send_text_message(
                phone,
                "❌ Couldn't generate podcast. Please try again later."
            )
    
    async def _handle_news_request(self, phone: str, user_id: str, ticker: str) -> None:
        """Handle news request command."""
        try:
            news = await self.ab_client.get_news_for_ticker(ticker)
            
            if not news:
                await self.wa_client.send_text_message(
                    phone,
                    f"📰 No recent news found for *{ticker}*.\n\n"
                    f"Try another ticker or check back later."
                )
                return
            
            # Format news summary with links
            lines = [f"📰 *Latest News: {ticker}*\n"]
            
            for article in news[:5]:
                headline = article.get("headline", "")[:80]
                summary = article.get("summary_tldr", "")[:120]
                sentiment = article.get("sentiment", "neutral")
                source_url = article.get("source_url", "")
                source = article.get("source", "")
                
                emoji = "🟢" if sentiment == "positive" else "🔴" if sentiment == "negative" else "⚪"
                
                # Format: emoji headline
                lines.append(f"{emoji} *{headline}*")
                
                # Summary on new line
                if summary:
                    lines.append(f"_{summary}_")
                
                # Link on separate line
                if source_url:
                    lines.append(f"🔗 {source_url}\n")
                else:
                    lines.append("")
            
            lines.append(f"🎧 Send *podcast {ticker}* for audio summary")
            
            await self.wa_client.send_text_message(phone, "\n".join(lines))
            
        except Exception as e:
            logger.error(f"Error fetching news: {e}")
            await self.wa_client.send_text_message(
                phone,
                f"❌ Couldn't fetch news for {ticker}. Please try again."
            )
    
    async def _handle_ticker_query(self, phone: str, ticker: str) -> None:
        """Handle standalone ticker query."""
        try:
            summary = await self.ab_client.get_stock_summary(ticker)
            price = await self.ab_client.get_stock_price(ticker)
            
            if not summary and not price:
                await self.wa_client.send_text_message(
                    phone,
                    f"❓ Couldn't find info for *{ticker}*.\n\n"
                    f"Make sure you're using a valid ticker symbol."
                )
                return
            
            # Format stock info
            company_name = summary.get("shortName", ticker)
            change = summary.get("regularMarketChange", 0)
            change_pct = summary.get("regularMarketChangePercent", 0)
            
            emoji = "🟢" if change >= 0 else "🔴"
            
            response = (
                f"📊 *{company_name}* ({ticker})\n\n"
                f"💰 Price: ₹{price:,.2f}\n"
                f"{emoji} Change: {'+' if change >= 0 else ''}{change:.2f} ({change_pct:+.2f}%)\n"
            )
            
            if summary.get("fiftyTwoWeekHigh"):
                response += f"📈 52W High: ₹{summary['fiftyTwoWeekHigh']:,.2f}\n"
            if summary.get("fiftyTwoWeekLow"):
                response += f"📉 52W Low: ₹{summary['fiftyTwoWeekLow']:,.2f}\n"
            
            response += (
                f"\n💡 Commands:\n"
                f"• *add {ticker}* – Add to watchlist\n"
                f"• *news {ticker}* – Get latest news\n"
                f"• *podcast {ticker}* – Get audio summary"
            )
            
            await self.wa_client.send_text_message(phone, response)
            
        except Exception as e:
            logger.error(f"Error fetching ticker info: {e}")
            await self._send_error_message(phone)
    
    # =========================================================================
    # Account Linking Handlers
    # =========================================================================
    
    async def _handle_signup(self, phone: str, user_id: str) -> None:
        """Handle signup command - show signup info."""
        try:
            # Check if already linked
            status = await self.ab_client.get_user_account_status(user_id)
            
            if status.get("is_linked"):
                username = status.get("username", "your account")
                await self.wa_client.send_text_message(
                    phone,
                    Templates.ACCOUNT_ALREADY_LINKED.format(username=username)
                )
            else:
                await self.wa_client.send_text_message(
                    phone,
                    Templates.SIGNUP_PROMPT
                )
                
        except AlphaBoardClientError as e:
            logger.error(f"Error in signup handler: {e}")
            await self.wa_client.send_text_message(phone, Templates.SIGNUP_PROMPT)
    
    async def _handle_connect_account(self, phone: str, user_id: str) -> None:
        """Handle connect account command - generate link code."""
        try:
            # Check if already linked
            status = await self.ab_client.get_user_account_status(user_id)
            
            if status.get("is_linked"):
                username = status.get("username", "your account")
                await self.wa_client.send_text_message(
                    phone,
                    Templates.ACCOUNT_ALREADY_LINKED.format(username=username)
                )
                return
            
            # Generate link code
            code = await self.ab_client.generate_link_code(user_id)
            
            await self.wa_client.send_text_message(
                phone,
                Templates.CONNECT_ACCOUNT_CODE.format(code=code)
            )
            
        except AlphaBoardClientError as e:
            logger.error(f"Error generating link code: {e}")
            await self._send_error_message(phone)
    
    async def _handle_account_status(self, phone: str, user_id: str) -> None:
        """Handle account status command."""
        try:
            status = await self.ab_client.get_user_account_status(user_id)
            
            if status.get("is_linked"):
                username = status.get("username") or status.get("full_name") or "your account"
                await self.wa_client.send_text_message(
                    phone,
                    Templates.ACCOUNT_ALREADY_LINKED.format(username=username)
                )
            else:
                await self.wa_client.send_text_message(
                    phone,
                    Templates.ACCOUNT_NOT_LINKED
                )
                
        except AlphaBoardClientError as e:
            logger.error(f"Error getting account status: {e}")
            await self._send_error_message(phone)
    
    async def _handle_unlink_account(self, phone: str, user_id: str) -> None:
        """Handle unlink account command."""
        try:
            # Check if linked
            status = await self.ab_client.get_user_account_status(user_id)
            
            if not status.get("is_linked"):
                await self.wa_client.send_text_message(
                    phone,
                    Templates.ACCOUNT_NOT_LINKED
                )
                return
            
            # Unlink the account
            self.ab_client.supabase.table("whatsapp_users") \
                .update({
                    "supabase_user_id": None,
                    "onboarding_completed": False
                }) \
                .eq("id", user_id) \
                .execute()
            
            await self.wa_client.send_text_message(
                phone,
                Templates.ACCOUNT_UNLINKED
            )
            
        except Exception as e:
            logger.error(f"Error unlinking account: {e}")
            await self._send_error_message(phone)
    
    # =========================================================================
    # Admin Tracking Handlers
    # =========================================================================
    
    async def _handle_admin_track_start(self, phone: str, user_id: str) -> None:
        """Handle admin track command - check if user is admin and show options."""
        try:
            admin_status = await self.ab_client.check_user_is_admin(user_id)
            
            if not admin_status.get("is_admin"):
                reason = admin_status.get("reason", "You need admin/manager access")
                await self.wa_client.send_text_message(
                    phone,
                    f"🔒 *Admin Access Required*\n\n"
                    f"This feature is only available to organization admins.\n"
                    f"Reason: {reason}\n\n"
                    f"Contact your organization manager for access."
                )
                return
            
            org_id = admin_status.get("organization_id")
            
            if not org_id:
                await self.wa_client.send_text_message(
                    phone,
                    "⚠️ You don't seem to be part of an organization yet.\n"
                    "Please set up your organization in the AlphaBoard web app first."
                )
                return
            
            # Store org_id in conversation state
            state_manager.start_flow(
                user_id,
                ConversationFlow.TRACK_ANALYST,
                {"organization_id": org_id, "admin_user_id": admin_status.get("user_id")}
            )
            
            # Get teams in organization
            teams = await self.ab_client.get_organization_teams(org_id)
            
            if teams:
                # Show team selection
                sections = [{
                    "title": "Select Team",
                    "rows": [
                        {
                            "id": f"team_{team['id']}",
                            "title": team["name"][:24],
                            "description": (team.get("description") or "View team analysts")[:72]
                        }
                        for team in teams[:10]
                    ]
                }]
                
                # Add "All Organization" option
                sections[0]["rows"].insert(0, {
                    "id": "track_all_org",
                    "title": "📊 All Analysts",
                    "description": "View all analysts in organization"
                })
                
                await self.wa_client.send_interactive_list(
                    phone,
                    body_text="📈 *Analyst Performance Tracking*\n\nSelect a team to view analyst positions or choose 'All Analysts' to see everyone.",
                    button_text="Select Team",
                    sections=sections,
                    header_text="Track Positions"
                )
            else:
                # No teams, show all members
                await self._handle_track_all_organization(phone, user_id)
                
        except Exception as e:
            logger.error(f"Error starting admin track: {e}")
            await self._send_error_message(phone)
    
    async def _handle_team_selected(self, phone: str, user_id: str, team_id: str) -> None:
        """Handle team selection in track flow."""
        try:
            context = state_manager.get_context(user_id)
            
            if context.flow != ConversationFlow.TRACK_ANALYST:
                await self._send_fallback_help(phone)
                return
            
            # Get team members
            members = await self.ab_client.get_team_members(team_id)
            
            if not members:
                await self.wa_client.send_text_message(
                    phone,
                    "📭 No analysts found in this team."
                )
                state_manager.cancel_flow(user_id)
                return
            
            # Store team_id
            state_manager.advance_step(user_id, {"team_id": team_id})
            
            # Show analyst selection
            sections = [{
                "title": "Select Analyst",
                "rows": [
                    {
                        "id": f"analyst_{member['user_id']}",
                        "title": (member.get("full_name") or member.get("username") or "Unknown")[:24],
                        "description": f"Role: {member.get('role', 'analyst')}"[:72]
                    }
                    for member in members[:10]
                ]
            }]
            
            await self.wa_client.send_interactive_list(
                phone,
                body_text="👤 *Select Analyst*\n\nChoose an analyst to view their positions.",
                button_text="Select Analyst",
                sections=sections,
                header_text="Team Analysts"
            )
            
        except Exception as e:
            logger.error(f"Error handling team selection: {e}")
            await self._send_error_message(phone)
    
    async def _handle_track_all_organization(self, phone: str, user_id: str) -> None:
        """Show all analysts in organization."""
        try:
            context = state_manager.get_context(user_id)
            org_id = context.data.get("organization_id")
            
            if not org_id:
                # Try to get org_id again
                admin_status = await self.ab_client.check_user_is_admin(user_id)
                org_id = admin_status.get("organization_id")
            
            if not org_id:
                await self.wa_client.send_text_message(
                    phone,
                    "⚠️ Organization not found. Please try again."
                )
                return
            
            members = await self.ab_client.get_organization_members(org_id)
            
            if not members:
                await self.wa_client.send_text_message(
                    phone,
                    "📭 No analysts found in your organization."
                )
                state_manager.cancel_flow(user_id)
                return
            
            # Show all analysts
            sections = [{
                "title": "All Analysts",
                "rows": [
                    {
                        "id": f"analyst_{member['id']}",
                        "title": (member.get("full_name") or member.get("username") or "Unknown")[:24],
                        "description": f"Role: {member.get('role', 'analyst')}"[:72]
                    }
                    for member in members[:10]
                ]
            }]
            
            await self.wa_client.send_interactive_list(
                phone,
                body_text=f"👥 *Organization Analysts* ({len(members)})\n\nSelect an analyst to view their positions.",
                button_text="Select Analyst",
                sections=sections,
                header_text="All Analysts"
            )
            
        except Exception as e:
            logger.error(f"Error showing all organization analysts: {e}")
            await self._send_error_message(phone)
    
    async def _handle_analyst_selected(self, phone: str, user_id: str, analyst_id: str) -> None:
        """Handle analyst selection - show position type options."""
        try:
            context = state_manager.get_context(user_id)
            state_manager.advance_step(user_id, {"analyst_id": analyst_id})
            
            # Show OPEN/CLOSED selection
            await self.wa_client.send_interactive_buttons(
                phone,
                body_text="📊 *Select Position Type*\n\nWhat positions do you want to view?",
                buttons=[
                    {"id": f"analyst_status_OPEN_{analyst_id}", "title": "📈 Open Positions"},
                    {"id": f"analyst_status_CLOSED_{analyst_id}", "title": "📉 Closed (History)"},
                    {"id": f"analyst_status_ALL_{analyst_id}", "title": "📋 All Positions"}
                ]
            )
            
        except Exception as e:
            logger.error(f"Error handling analyst selection: {e}")
            await self._send_error_message(phone)
    
    async def _handle_show_analyst_recs(
        self,
        phone: str,
        user_id: str,
        analyst_id: str,
        status: str
    ) -> None:
        """Show analyst recommendations in detailed format."""
        try:
            # Get analyst profile
            profile_result = self.ab_client.supabase.table("profiles") \
                .select("username, full_name") \
                .eq("id", analyst_id) \
                .limit(1) \
                .execute()
            
            analyst_name = "Analyst"
            if profile_result.data and len(profile_result.data) > 0:
                profile = profile_result.data[0]
                analyst_name = profile.get("full_name") or profile.get("username") or "Analyst"
            
            # Get recommendations
            status_filter = None if status == "ALL" else status
            recs = await self.ab_client.get_analyst_recommendations_detailed(analyst_id, status_filter)
            
            # Get performance stats
            performance = await self.ab_client.get_analyst_performance(analyst_id)
            
            if not recs:
                await self.wa_client.send_text_message(
                    phone,
                    f"📭 *{analyst_name}*\n\nNo {status.lower()} positions found."
                )
                state_manager.cancel_flow(user_id)
                return
            
            # Build detailed output
            status_label = "All" if status == "ALL" else status.capitalize()
            lines = [
                f"👤 *{analyst_name}* - {status_label} Positions\n"
            ]
            
            # Performance summary if available
            if performance:
                win_rate = performance.get("win_rate")
                total_return = performance.get("total_return_pct")
                total_ideas = performance.get("total_ideas")
                
                perf_line = ""
                if total_ideas:
                    perf_line += f"📊 {total_ideas} ideas"
                if win_rate is not None:
                    perf_line += f" | Win: {win_rate:.0f}%"
                if total_return is not None:
                    emoji = "🟢" if total_return >= 0 else "🔴"
                    perf_line += f" | {emoji} {total_return:+.1f}%"
                if perf_line:
                    lines.append(perf_line + "\n")
            
            lines.append("─" * 20 + "\n")
            
            # Table header explanation
            lines.append("*Entry* → *CMP* | *Return* | *Target*\n")
            
            for i, rec in enumerate(recs[:15], 1):
                ticker = rec.get("ticker", "???")
                action = rec.get("action", "BUY")
                entry_price = rec.get("entry_price")
                current_price = rec.get("current_price")
                target_price = rec.get("target_price")
                return_pct = rec.get("return_pct")
                entry_date = rec.get("entry_date", "")[:10]  # YYYY-MM-DD
                rec_status = rec.get("status", "OPEN")
                
                # Action emoji
                action_emoji = "🟢" if action == "BUY" else "🔴" if action == "SELL" else "👀"
                
                # Build line
                line = f"{i}. {action_emoji} *{action} {ticker}*"
                
                # Date
                if entry_date:
                    line += f"\n   📅 {entry_date}"
                
                # Prices
                if entry_price:
                    line += f"\n   ₹{entry_price:,.0f}"
                    if current_price:
                        line += f" → ₹{current_price:,.0f}"
                
                # Return
                if return_pct is not None:
                    ret_emoji = "🟢" if return_pct >= 0 else "🔴"
                    line += f" | {ret_emoji} {return_pct:+.1f}%"
                elif rec.get("final_return_pct") is not None:
                    final_ret = rec["final_return_pct"]
                    ret_emoji = "🟢" if final_ret >= 0 else "🔴"
                    line += f" | {ret_emoji} {final_ret:+.1f}% (final)"
                
                # Target
                if target_price:
                    line += f"\n   🎯 Target: ₹{target_price:,.0f}"
                
                # Status indicator for closed
                if rec_status == "CLOSED":
                    exit_price = rec.get("exit_price")
                    if exit_price:
                        line += f"\n   ❌ Exited @ ₹{exit_price:,.0f}"
                
                lines.append(line + "\n")
            
            if len(recs) > 15:
                lines.append(f"\n... and {len(recs) - 15} more positions")
            
            # End flow
            state_manager.cancel_flow(user_id)
            
            await self.wa_client.send_text_message(phone, "\n".join(lines))
            
        except Exception as e:
            logger.error(f"Error showing analyst recs: {e}")
            await self._send_error_message(phone)
            state_manager.cancel_flow(user_id)
    
    # =========================================================================
    # Helper Methods
    # =========================================================================
    
    async def _send_help_message(self, phone: str) -> None:
        """Send help message to user."""
        await self.wa_client.send_text_message(phone, Templates.HELP_MESSAGE)
    
    async def _send_fallback_help(self, phone: str) -> None:
        """Send fallback help with examples."""
        await self.wa_client.send_text_message(phone, Templates.FALLBACK_HELP)
    
    async def _send_error_message(self, phone: str) -> None:
        """Send generic error message."""
        await self.wa_client.send_text_message(phone, Templates.ERROR_MESSAGE)

