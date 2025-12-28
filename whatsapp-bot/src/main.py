"""
WhatsApp Bot Service for AlphaBoard.
FastAPI application entrypoint.
"""

import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import get_settings
from .webhook import router as webhook_router
from .admin import router as admin_router, api_router

# Configure basic logging first (before loading settings)
logging.basicConfig(
    level=logging.INFO,  # Default level, will be updated after settings load
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Lazy settings loading - only load when actually needed
_settings = None

def get_app_settings():
    """Get settings instance, loading it lazily on first access."""
    global _settings
    if _settings is None:
        _settings = get_settings()
        # Update logging level after settings are loaded
        logging.getLogger().setLevel(getattr(logging, _settings.LOG_LEVEL))
    return _settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.
    Handles startup and shutdown events.
    """
    # Load settings on startup
    settings = get_app_settings()
    
    # Startup - validate critical settings
    logger.info(f"Starting WhatsApp Bot Service (env={settings.ENVIRONMENT})")
    
    # Validate required settings (warn if missing, but don't fail)
    missing_settings = []
    if not settings.META_WHATSAPP_ACCESS_TOKEN:
        missing_settings.append("META_WHATSAPP_ACCESS_TOKEN")
    if not settings.META_WHATSAPP_PHONE_NUMBER_ID:
        missing_settings.append("META_WHATSAPP_PHONE_NUMBER_ID")
    if not settings.META_WHATSAPP_VERIFY_TOKEN:
        missing_settings.append("META_WHATSAPP_VERIFY_TOKEN")
    if not settings.SUPABASE_URL:
        missing_settings.append("SUPABASE_URL")
    if not settings.SUPABASE_SERVICE_ROLE_KEY:
        missing_settings.append("SUPABASE_SERVICE_ROLE_KEY")
    
    if missing_settings:
        logger.warning(f"⚠️ Missing environment variables: {', '.join(missing_settings)}")
        logger.warning("⚠️ Some features may not work until these are configured")
    else:
        logger.info(f"WhatsApp Phone ID: {settings.META_WHATSAPP_PHONE_NUMBER_ID}")
        logger.info(f"AlphaBoard API: {settings.ALPHABOARD_API_BASE_URL}")
    
    yield
    
    # Shutdown
    logger.info("Shutting down WhatsApp Bot Service")


# Create FastAPI application
# Settings will be loaded lazily when needed
# Check environment directly for docs (avoid loading full settings at import)
enable_docs = os.getenv("ENVIRONMENT", "local") in ("local", "dev")

app = FastAPI(
    title="AlphaBoard WhatsApp Bot",
    description="WhatsApp bot service for AlphaBoard stock analysis platform",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if enable_docs else None,
    redoc_url="/redoc" if enable_docs else None,
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Handle unhandled exceptions gracefully."""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )


# Health check endpoint
@app.get("/")
async def root():
    """Root endpoint - basic health check."""
    return {
        "status": "ok",
        "service": "AlphaBoard WhatsApp Bot",
        "version": "1.0.0"
    }


@app.get("/health")
async def health():
    """Health check endpoint for load balancers."""
    return {"status": "healthy"}


# Include routers
app.include_router(webhook_router)
app.include_router(admin_router)
app.include_router(api_router)  # API endpoints for web app integration


# CLI entry point
def main():
    """Run the application using uvicorn."""
    import uvicorn
    
    settings = get_app_settings()
    uvicorn.run(
        "src.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.is_development,
        log_level=settings.LOG_LEVEL.lower()
    )


if __name__ == "__main__":
    main()

