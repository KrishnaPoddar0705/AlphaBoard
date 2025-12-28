"""
Configuration management for WhatsApp Bot service.
Uses pydantic BaseSettings for environment variable loading and validation.
"""

import os
from functools import lru_cache
from typing import Literal, Set
from pydantic_settings import BaseSettings


# =============================================================================
# Credible News Sources Whitelist
# Only news from these domains will be shown with links
# =============================================================================

CREDIBLE_NEWS_SOURCES: Set[str] = {
    # Indian Markets
    "economictimes.indiatimes.com",
    "moneycontrol.com",
    "livemint.com",
    "business-standard.com",
    "financialexpress.com",
    "ndtvprofit.com",
    "zeebiz.com",
    "businesstoday.in",
    "thehindubusinessline.com",
    "bseindia.com",
    "nseindia.com",
    "screener.in",
    "tijorifinance.com",
    "valueresearchonline.com",
    
    # US/Global Markets
    "reuters.com",
    "bloomberg.com",
    "wsj.com",
    "cnbc.com",
    "marketwatch.com",
    "seekingalpha.com",
    "fool.com",
    "finance.yahoo.com",
    "investors.com",
    "barrons.com",
    "ft.com",
    "benzinga.com",
    "investopedia.com",
    "thestreet.com",
    "kiplinger.com",
    "morningstar.com",
    
    # News Agencies
    "apnews.com",
    "news.google.com",  # Only if redirects to credible source
}

# Mapping of domain to display name
NEWS_SOURCE_NAMES = {
    "economictimes.indiatimes.com": "Economic Times",
    "moneycontrol.com": "Moneycontrol",
    "livemint.com": "Mint",
    "business-standard.com": "Business Standard",
    "financialexpress.com": "Financial Express",
    "ndtvprofit.com": "NDTV Profit",
    "zeebiz.com": "Zee Business",
    "businesstoday.in": "Business Today",
    "thehindubusinessline.com": "Hindu Business Line",
    "reuters.com": "Reuters",
    "bloomberg.com": "Bloomberg",
    "wsj.com": "Wall Street Journal",
    "cnbc.com": "CNBC",
    "marketwatch.com": "MarketWatch",
    "seekingalpha.com": "Seeking Alpha",
    "fool.com": "Motley Fool",
    "finance.yahoo.com": "Yahoo Finance",
    "investors.com": "Investor's Business Daily",
    "barrons.com": "Barron's",
    "ft.com": "Financial Times",
    "benzinga.com": "Benzinga",
    "morningstar.com": "Morningstar",
}


def get_source_from_url(url: str) -> tuple[bool, str, str]:
    """
    Check if URL is from a credible source and extract source info.
    
    Args:
        url: The news article URL
        
    Returns:
        Tuple of (is_credible, source_name, domain)
    """
    if not url:
        return False, "", ""
    
    try:
        from urllib.parse import urlparse
        parsed = urlparse(url)
        domain = parsed.netloc.lower()
        
        # Remove www. prefix
        if domain.startswith("www."):
            domain = domain[4:]
        
        # Check if domain matches any credible source
        for credible_domain in CREDIBLE_NEWS_SOURCES:
            if credible_domain in domain or domain.endswith(credible_domain):
                source_name = NEWS_SOURCE_NAMES.get(credible_domain, credible_domain.split('.')[0].title())
                return True, source_name, domain
        
        return False, "", domain
    except Exception:
        return False, "", ""


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.
    All settings can be overridden via .env file or environment variables.
    """
    
    # =========================================================================
    # Meta WhatsApp Cloud API Configuration
    # =========================================================================
    # These fields are optional at startup - will be validated when actually used
    META_WHATSAPP_ACCESS_TOKEN: str = ""
    META_WHATSAPP_API_VERSION: str = "v22.0"
    META_WHATSAPP_PHONE_NUMBER_ID: str = ""
    META_WHATSAPP_VERIFY_TOKEN: str = ""
    
    # =========================================================================
    # Supabase Configuration (Direct DB Access)
    # =========================================================================
    # These fields are optional at startup - will be validated when actually used
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    
    # =========================================================================
    # AlphaBoard Backend API Configuration
    # =========================================================================
    ALPHABOARD_API_BASE_URL: str = "http://localhost:8000"
    ALPHABOARD_API_KEY: str = ""
    
    # =========================================================================
    # Market Data API Configuration (Optional)
    # =========================================================================
    MARKET_DATA_API_BASE_URL: str = ""
    MARKET_DATA_API_KEY: str = ""
    
    # =========================================================================
    # WhatsApp Template Configuration
    # =========================================================================
    WHATSAPP_DAILY_TEMPLATE_NAME: str = "daily_market_close"
    WHATSAPP_DAILY_TEMPLATE_LANG: str = "en_US"
    
    # =========================================================================
    # Admin Configuration
    # =========================================================================
    ADMIN_API_KEY: str = ""
    
    # =========================================================================
    # Application Configuration
    # =========================================================================
    ENVIRONMENT: Literal["local", "dev", "prod"] = "local"
    LOG_LEVEL: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    
    # =========================================================================
    # Server Configuration
    # =========================================================================
    HOST: str = "0.0.0.0"
    # PORT defaults to 8001, but BaseSettings will automatically read from PORT env var if set
    PORT: int = 8001
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True
    
    @property
    def whatsapp_api_url(self) -> str:
        """Get the full WhatsApp API URL for sending messages."""
        return f"https://graph.facebook.com/{self.META_WHATSAPP_API_VERSION}/{self.META_WHATSAPP_PHONE_NUMBER_ID}/messages"
    
    @property
    def is_production(self) -> bool:
        """Check if running in production environment."""
        return self.ENVIRONMENT == "prod"
    
    @property
    def is_development(self) -> bool:
        """Check if running in development environment."""
        return self.ENVIRONMENT in ("local", "dev")


@lru_cache()
def get_settings() -> Settings:
    """
    Get cached settings instance.
    Use this function for dependency injection in FastAPI routes.
    
    Returns:
        Settings: Cached settings instance
    """
    return Settings()

