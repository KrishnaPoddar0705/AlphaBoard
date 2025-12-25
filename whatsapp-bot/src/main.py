"""
WhatsApp Bot Service for AlphaBoard.
FastAPI application entrypoint.
"""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import get_settings
from .webhook import router as webhook_router
from .admin import router as admin_router

# Configure logging
settings = get_settings()
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.
    Handles startup and shutdown events.
    """
    # Startup
    logger.info(f"Starting WhatsApp Bot Service (env={settings.ENVIRONMENT})")
    logger.info(f"WhatsApp Phone ID: {settings.META_WHATSAPP_PHONE_NUMBER_ID}")
    logger.info(f"AlphaBoard API: {settings.ALPHABOARD_API_BASE_URL}")
    
    yield
    
    # Shutdown
    logger.info("Shutting down WhatsApp Bot Service")


# Create FastAPI application
app = FastAPI(
    title="AlphaBoard WhatsApp Bot",
    description="WhatsApp bot service for AlphaBoard stock analysis platform",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.is_development else None,
    redoc_url="/redoc" if settings.is_development else None,
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


# CLI entry point
def main():
    """Run the application using uvicorn."""
    import uvicorn
    
    uvicorn.run(
        "src.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.is_development,
        log_level=settings.LOG_LEVEL.lower()
    )


if __name__ == "__main__":
    main()

