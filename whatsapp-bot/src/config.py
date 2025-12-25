"""
Configuration management for WhatsApp Bot service.
Uses pydantic BaseSettings for environment variable loading and validation.
"""

from functools import lru_cache
from typing import Literal
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.
    All settings can be overridden via .env file or environment variables.
    """
    
    # =========================================================================
    # Meta WhatsApp Cloud API Configuration
    # =========================================================================
    META_WHATSAPP_ACCESS_TOKEN: str
    META_WHATSAPP_API_VERSION: str = "v22.0"
    META_WHATSAPP_PHONE_NUMBER_ID: str
    META_WHATSAPP_VERIFY_TOKEN: str
    
    # =========================================================================
    # Supabase Configuration (Direct DB Access)
    # =========================================================================
    SUPABASE_URL: str
    SUPABASE_SERVICE_ROLE_KEY: str
    
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

