"""
Message Templates.
Canned responses, menus, and help messages for WhatsApp bot.
"""


class Templates:
    """Collection of message templates for WhatsApp bot responses."""
    
    # =========================================================================
    # Welcome & Help Messages
    # =========================================================================
    
    WELCOME_MESSAGE = """👋 *Welcome to AlphaBoard!*

I'm your personal stock analysis assistant. Here's what I can help you with:

📈 *Track Stocks*
• Add stocks to your watchlist
• Log recommendations with price targets

📰 *Stay Informed*
• Get daily market close summaries
• Latest news on any stock

🎧 *Audio Insights*
• Request AI-generated podcasts

Type *menu* anytime to see all options!"""
    
    HELP_MESSAGE = """📚 *AlphaBoard Commands*

*Portfolio Actions:*
• `add TCS` – Add to watchlist
• `add INFY - long term` – Add with note
• `watch RELIANCE` – Add to watchlist
• `my watchlist` – View your watchlist
• `rec HDFC @ 1500 thesis` – Log recommendation
• `my recs` – View recommendations

*Market Info:*
• `market close` – Today's summary
• `news TCS` – Latest news
• `TCS` – Quick stock info

*Podcasts:*
• `podcast TCS` – Generate audio summary
• `podcast market today` – Topic podcast

*General:*
• `menu` – Open main menu
• `help` – Show this message

💡 *Examples:*
• add TCS - long term compounding
• rec INFY @ 1650 digital transformation play
• podcast NIFTY 50 weekly"""
    
    FALLBACK_HELP = """🤔 I didn't quite get that.

*Try these:*
• `add TCS` – Add to watchlist
• `rec INFY @ 1650 long term` – Log a pick
• `market close` – Today's summary
• `news RELIANCE` – Get news
• `podcast TCS` – Audio summary

Or type *menu* to see all options! 📋"""
    
    # =========================================================================
    # Prompt Messages
    # =========================================================================
    
    ADD_WATCHLIST_PROMPT = """➕ *Add to Watchlist*

Send a message like:
• `add TCS`
• `add INFY - growth stock`
• `watch RELIANCE - value play`

The ticker should be in NSE/BSE format."""
    
    ADD_RECOMMENDATION_PROMPT = """📊 *Add Recommendation*

Send a message like:
• `rec TCS @ 3500 strong fundamentals`
• `recommend INFY at 1600 digital play`

Format: `rec TICKER @ PRICE thesis`
(Price and thesis are optional)"""
    
    NEWS_PROMPT = """📰 *Get Stock News*

Send: `news TICKER`

Examples:
• `news TCS`
• `news RELIANCE`
• `news HDFCBANK`

I'll fetch the latest headlines and summaries."""
    
    PODCAST_PROMPT = """🎧 *Request Podcast*

Send: `podcast TOPIC`

Examples:
• `podcast TCS` – Stock-specific podcast
• `podcast NIFTY 50 today` – Market overview
• `podcast IT sector rally` – Theme-based

I'll queue an AI-generated audio summary for you."""
    
    # =========================================================================
    # Empty State Messages
    # =========================================================================
    
    EMPTY_WATCHLIST = """📋 *Your Watchlist is Empty*

Start tracking stocks by sending:
• `add TCS`
• `add INFY - growth stock`
• `watch RELIANCE`

I'll keep them organized for you! 📈"""
    
    EMPTY_RECOMMENDATIONS = """📊 *No Recommendations Yet*

Log your first stock pick:
• `rec TCS @ 3500 strong moat`
• `rec INFY @ 1600 long term bet`

We'll track your performance in AlphaBoard! 📈"""
    
    # =========================================================================
    # Status Messages
    # =========================================================================
    
    ERROR_MESSAGE = """⚠️ Oops, something went wrong on our side.

Please try again in a moment. If the issue persists, try:
• Typing `menu` for options
• Checking your command format

Sorry for the inconvenience! 🙏"""
    
    PROCESSING_MESSAGE = """⏳ Working on it..."""
    
    PODCAST_QUEUED = """🎧 *Podcast Queued*

We're generating your audio summary. This usually takes 1-2 minutes.

You'll receive a notification when it's ready in AlphaBoard! 🔔"""
    
    # =========================================================================
    # Daily Report Templates
    # =========================================================================
    
    DAILY_CLOSE_HEADER = """📈 *Market Close Summary*
_{date}_

"""
    
    DAILY_CLOSE_FOOTER = """

---
💡 Reply `my watchlist` to check your stocks
📊 Reply `menu` for more options"""
    
    # =========================================================================
    # Subscription Messages
    # =========================================================================
    
    SUBSCRIBED_DAILY = """✅ *Subscribed to Daily Reports*

You'll receive the market close summary every trading day at 4:30 PM IST.

To unsubscribe anytime, send: `unsubscribe daily`"""
    
    UNSUBSCRIBED_DAILY = """🔕 *Unsubscribed from Daily Reports*

You won't receive daily market summaries anymore.

To subscribe again, send: `subscribe daily`"""
    
    # =========================================================================
    # Onboarding Messages
    # =========================================================================
    
    ONBOARDING_INTRO = """👋 *Welcome to AlphaBoard!*

Let's get you set up in a few quick steps.

First, what should I call you?
(Just reply with your name)"""
    
    ONBOARDING_COMPLETE = """🎉 *You're all set, {name}!*

Here's what you can do:
• Track stocks on your watchlist
• Log recommendations
• Get daily market updates
• Request AI podcasts

Type *menu* to get started!"""
    
    # =========================================================================
    # Account Linking Messages
    # =========================================================================
    
    CONNECT_ACCOUNT_INTRO = """🔗 *Connect Your AlphaBoard Account*

Link your WhatsApp to your AlphaBoard web account to:
• ✅ Sync your watchlist across devices
• ✅ See your recommendations in the app
• ✅ Track performance on the web dashboard
• ✅ Access all your data anywhere

Reply *connect* to get started!"""
    
    CONNECT_ACCOUNT_CODE = """🔐 *Your Link Code*

Your one-time code is:

*{code}*

*To connect your account:*
1️⃣ Open AlphaBoard web app
2️⃣ Go to Settings → Connect WhatsApp
3️⃣ Enter this code: *{code}*

⏰ This code expires in *10 minutes*

_Don't have an AlphaBoard account? Sign up at alphaboard.theunicornlabs.com_"""
    
    ACCOUNT_LINKED_SUCCESS = """🎉 *Account Connected!*

Your WhatsApp is now linked to your AlphaBoard account (*{username}*)!

✅ Your watchlist has been synced
✅ Your recommendations are linked

You can now:
• Add stocks here and see them in the web app
• View your full portfolio performance online
• Get personalized daily reports

Type *menu* to continue!"""
    
    ACCOUNT_ALREADY_LINKED = """✅ *Account Already Connected*

Your WhatsApp is linked to: *{username}*

Your watchlist and recommendations sync automatically between WhatsApp and the web app.

💡 Want to unlink? Type *unlink account*"""
    
    ACCOUNT_NOT_LINKED = """ℹ️ *Account Not Connected*

Your WhatsApp is not linked to an AlphaBoard web account.

Connecting gives you:
• Full portfolio dashboard
• Performance tracking
• Cross-device sync

Type *connect* to link your account!"""
    
    ACCOUNT_UNLINKED = """🔓 *Account Unlinked*

Your WhatsApp has been disconnected from your AlphaBoard account.

Your WhatsApp watchlist and recommendations remain here, but won't sync to the web app.

Type *connect* anytime to link again!"""
    
    SIGNUP_PROMPT = """🚀 *Sign Up for AlphaBoard*

Create your free account at:
👉 *alphaboard.theunicornlabs.com*

After signing up:
1️⃣ Type *connect* here
2️⃣ Enter the code in the web app
3️⃣ Your data syncs automatically!

Already have an account? Type *connect* now!"""
    
    # =========================================================================
    # Format Helpers
    # =========================================================================
    
    @staticmethod
    def format_price(price: float) -> str:
        """Format price with Indian numbering system."""
        if price >= 10000000:  # 1 Crore
            return f"₹{price/10000000:.2f}Cr"
        elif price >= 100000:  # 1 Lakh
            return f"₹{price/100000:.2f}L"
        else:
            return f"₹{price:,.2f}"
    
    @staticmethod
    def format_change(change: float, change_pct: float) -> str:
        """Format price change with emoji."""
        emoji = "🟢" if change >= 0 else "🔴"
        sign = "+" if change >= 0 else ""
        return f"{emoji} {sign}{change:.2f} ({sign}{change_pct:.2f}%)"
    
    @staticmethod
    def format_watchlist_item(index: int, ticker: str, note: str = None) -> str:
        """Format a single watchlist item."""
        line = f"{index}. *{ticker}*"
        if note:
            line += f" – {note}"
        return line
    
    @staticmethod
    def format_recommendation(
        index: int,
        ticker: str,
        price: float = None,
        thesis: str = None
    ) -> str:
        """Format a single recommendation."""
        line = f"{index}. *{ticker}*"
        if price:
            line += f" @ ₹{price:,.0f}"
        if thesis:
            truncated = thesis[:50] + "..." if len(thesis) > 50 else thesis
            line += f"\n   _{truncated}_"
        return line

