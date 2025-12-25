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
        
        # Check for menu/help commands
        if text_lower in ("help", "menu", "hi", "hello", "start", "hey", "?"):
            await self.wa_client.send_main_menu(phone)
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
        if text_lower in ("my recs", "my recommendations", "recommendations", "show recs"):
            await self._handle_show_recommendations(phone, user_id)
            return
        
        # Check for market close
        if text_lower in ("market close", "market", "today summary", "daily report", "summary"):
            await self._handle_market_close(phone, user_id)
            return
        
        # Check for add to watchlist
        for pattern in self.ADD_WATCHLIST_PATTERNS:
            match = pattern.match(text)
            if match:
                ticker = match.group(1).upper()
                note = match.group(2).strip() if match.group(2) else None
                await self._handle_add_watchlist(phone, user_id, ticker, note)
                return
        
        # Check for recommendation
        match = self.REC_PATTERN.match(text)
        if match:
            ticker = match.group(1).upper()
            price_str = match.group(2)
            price = float(price_str) if price_str else None
            thesis = match.group(3).strip() if match.group(3) else None
            await self._handle_add_recommendation(phone, user_id, ticker, price, thesis)
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
        # Map interactive IDs to actions
        if reply_id == "menu_add_watchlist":
            await self.wa_client.send_text_message(
                phone,
                Templates.ADD_WATCHLIST_PROMPT
            )
        
        elif reply_id == "menu_add_recommendation":
            await self.wa_client.send_text_message(
                phone,
                Templates.ADD_RECOMMENDATION_PROMPT
            )
        
        elif reply_id == "menu_show_watchlist":
            await self._handle_show_watchlist(phone, user_id)
        
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
        """Handle show watchlist command."""
        try:
            watchlist = await self.ab_client.list_watchlist(user_id)
            
            if not watchlist:
                await self.wa_client.send_text_message(
                    phone,
                    Templates.EMPTY_WATCHLIST
                )
                return
            
            # Format watchlist
            lines = ["📋 *Your Watchlist*\n"]
            for i, item in enumerate(watchlist[:10], 1):
                ticker = item["ticker"]
                note = item.get("note", "")
                line = f"{i}. *{ticker}*"
                if note:
                    line += f" – {note}"
                lines.append(line)
            
            if len(watchlist) > 10:
                lines.append(f"\n... and {len(watchlist) - 10} more")
            
            lines.append("\n💡 Send \"add TCS - note\" to add more stocks.")
            
            await self.wa_client.send_text_message(phone, "\n".join(lines))
            
        except AlphaBoardClientError as e:
            logger.error(f"Error fetching watchlist: {e}")
            await self._send_error_message(phone)
    
    async def _handle_add_recommendation(
        self,
        phone: str,
        user_id: str,
        ticker: str,
        price: Optional[float],
        thesis: Optional[str]
    ) -> None:
        """Handle add recommendation command."""
        try:
            await self.ab_client.add_recommendation(user_id, ticker, price, thesis)
            
            response = f"📈 Logged your recommendation:\n\n*BUY {ticker}*"
            if price:
                response += f" @ ₹{price:,.2f}"
            if thesis:
                response += f"\n\n📝 Thesis: {thesis}"
            response += "\n\n✅ We'll track this in AlphaBoard!"
            
            await self.wa_client.send_text_message(phone, response)
            
        except AlphaBoardClientError as e:
            logger.error(f"Error adding recommendation: {e}")
            await self.wa_client.send_text_message(
                phone,
                f"❌ Couldn't log recommendation for {ticker}. Please try again."
            )
    
    async def _handle_show_recommendations(self, phone: str, user_id: str) -> None:
        """Handle show recommendations command."""
        try:
            recs = await self.ab_client.list_recent_recommendations(user_id, days=30)
            
            if not recs:
                await self.wa_client.send_text_message(
                    phone,
                    "📊 You haven't added any recommendations recently.\n\n"
                    "💡 Try: *rec INFY @ 1650 long term bet*"
                )
                return
            
            lines = ["📊 *Your Recent Recommendations*\n"]
            for i, rec in enumerate(recs[:10], 1):
                ticker = rec["ticker"]
                price = rec.get("price")
                thesis = rec.get("thesis", "")
                
                line = f"{i}. *{ticker}*"
                if price:
                    line += f" @ ₹{price:,.0f}"
                if thesis:
                    line += f"\n   _{thesis[:50]}{'...' if len(thesis) > 50 else ''}_"
                lines.append(line)
            
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
        """Handle podcast request command."""
        try:
            # Create podcast request
            await self.ab_client.request_podcast(user_id, topic)
            
            # Check if topic looks like a ticker
            if self.TICKER_PATTERN.match(topic):
                ticker = topic.upper()
                response = (
                    f"🎧 *Podcast Request Queued*\n\n"
                    f"We're generating a podcast for *{ticker}*.\n\n"
                    f"You'll be notified when it's ready in AlphaBoard. "
                    f"This usually takes 1-2 minutes."
                )
            else:
                response = (
                    f"🎧 *Podcast Request Queued*\n\n"
                    f"Topic: _{topic}_\n\n"
                    f"You'll be notified when it's ready in AlphaBoard."
                )
            
            await self.wa_client.send_text_message(phone, response)
            
        except AlphaBoardClientError as e:
            logger.error(f"Error creating podcast request: {e}")
            await self.wa_client.send_text_message(
                phone,
                "❌ Couldn't queue podcast request. Please try again."
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
            
            # Format news summary
            lines = [f"📰 *Latest News: {ticker}*\n"]
            
            for article in news[:5]:
                headline = article.get("headline", "")[:100]
                summary = article.get("summary_tldr", "")[:150]
                sentiment = article.get("sentiment", "neutral")
                
                emoji = "🟢" if sentiment == "positive" else "🔴" if sentiment == "negative" else "⚪"
                
                lines.append(f"{emoji} *{headline}*")
                if summary:
                    lines.append(f"_{summary}_\n")
            
            lines.append("💡 Send \"podcast " + ticker + "\" for an audio summary.")
            
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

