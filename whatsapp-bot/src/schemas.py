"""
Pydantic models for WhatsApp Bot service.
Defines schemas for incoming messages, API payloads, and responses.
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from uuid import UUID


# =============================================================================
# WhatsApp Webhook Schemas
# =============================================================================

class WhatsAppTextMessage(BaseModel):
    """Text message content from WhatsApp."""
    body: str


class WhatsAppInteractiveReply(BaseModel):
    """Interactive reply (button/list) from WhatsApp."""
    id: str
    title: str


class WhatsAppInteractive(BaseModel):
    """Interactive message content from WhatsApp."""
    type: str  # "button_reply" or "list_reply"
    button_reply: Optional[WhatsAppInteractiveReply] = None
    list_reply: Optional[WhatsAppInteractiveReply] = None


class WhatsAppMessage(BaseModel):
    """Parsed incoming WhatsApp message."""
    message_id: str = Field(alias="id")
    from_phone: str = Field(alias="from")
    timestamp: str
    type: str  # "text", "interactive", "image", etc.
    text: Optional[WhatsAppTextMessage] = None
    interactive: Optional[WhatsAppInteractive] = None
    
    class Config:
        populate_by_name = True


class WhatsAppContact(BaseModel):
    """Contact information from WhatsApp."""
    wa_id: str
    profile: Optional[Dict[str, Any]] = None


class WhatsAppMetadata(BaseModel):
    """Metadata from WhatsApp webhook."""
    display_phone_number: str
    phone_number_id: str


class WhatsAppValue(BaseModel):
    """Value object from WhatsApp webhook."""
    messaging_product: str
    metadata: WhatsAppMetadata
    contacts: Optional[List[WhatsAppContact]] = None
    messages: Optional[List[WhatsAppMessage]] = None


class WhatsAppChange(BaseModel):
    """Change object from WhatsApp webhook."""
    value: WhatsAppValue
    field: str


class WhatsAppEntry(BaseModel):
    """Entry object from WhatsApp webhook."""
    id: str
    changes: List[WhatsAppChange]


class WhatsAppWebhookPayload(BaseModel):
    """Full WhatsApp webhook payload."""
    object: str
    entry: List[WhatsAppEntry]


# =============================================================================
# Parsed Message Schema (Internal)
# =============================================================================

class ParsedMessage(BaseModel):
    """Normalized message for internal processing."""
    sender_phone: str
    message_type: str  # "text", "interactive_button", "interactive_list"
    text_body: Optional[str] = None
    interactive_id: Optional[str] = None
    interactive_title: Optional[str] = None
    phone_number_id: str
    timestamp: datetime
    raw_message_id: str


# =============================================================================
# WhatsApp User Schemas
# =============================================================================

class WhatsAppUserBase(BaseModel):
    """Base schema for WhatsApp user."""
    phone: str
    display_name: Optional[str] = None
    is_daily_subscriber: bool = True


class WhatsAppUserCreate(WhatsAppUserBase):
    """Schema for creating a WhatsApp user."""
    pass


class WhatsAppUser(WhatsAppUserBase):
    """Full WhatsApp user schema."""
    id: UUID
    supabase_user_id: Optional[UUID] = None
    onboarding_completed: bool = False
    created_at: datetime
    last_active_at: datetime
    
    class Config:
        from_attributes = True


# =============================================================================
# Watchlist Schemas
# =============================================================================

class WatchlistItemBase(BaseModel):
    """Base schema for watchlist item."""
    ticker: str
    note: Optional[str] = None


class WatchlistItemCreate(WatchlistItemBase):
    """Schema for creating a watchlist item."""
    pass


class WatchlistItem(WatchlistItemBase):
    """Full watchlist item schema."""
    id: UUID
    whatsapp_user_id: UUID
    created_at: datetime
    
    class Config:
        from_attributes = True


# =============================================================================
# Recommendation Schemas
# =============================================================================

class RecommendationBase(BaseModel):
    """Base schema for recommendation."""
    ticker: str
    price: Optional[float] = None
    thesis: Optional[str] = None


class RecommendationCreate(RecommendationBase):
    """Schema for creating a recommendation."""
    pass


class WhatsAppRecommendation(RecommendationBase):
    """Full WhatsApp recommendation schema."""
    id: UUID
    whatsapp_user_id: UUID
    recommendation_id: Optional[UUID] = None
    source: str = "whatsapp"
    created_at: datetime
    
    class Config:
        from_attributes = True


# =============================================================================
# Podcast Request Schemas
# =============================================================================

class PodcastRequestBase(BaseModel):
    """Base schema for podcast request."""
    topic: str


class PodcastRequestCreate(PodcastRequestBase):
    """Schema for creating a podcast request."""
    pass


class PodcastRequest(PodcastRequestBase):
    """Full podcast request schema."""
    id: UUID
    whatsapp_user_id: UUID
    podcast_id: Optional[UUID] = None
    status: str = "pending"
    created_at: datetime
    completed_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


# =============================================================================
# API Response Schemas
# =============================================================================

class WebhookResponse(BaseModel):
    """Response for webhook endpoints."""
    status: str = "EVENT_RECEIVED"


class HealthCheckResponse(BaseModel):
    """Response for health check endpoint."""
    status: str
    whatsapp_api: str
    alphaboard_api: str
    database: str


class AdminRecommendationsResponse(BaseModel):
    """Response for admin recommendations endpoint."""
    count: int
    items: List[Dict[str, Any]]


# =============================================================================
# Market Report Schemas
# =============================================================================

class MarketIndex(BaseModel):
    """Market index data."""
    name: str
    value: float
    change_pct: float


class TopMover(BaseModel):
    """Top mover stock data."""
    ticker: str
    name: str
    change_pct: float


class MarketCloseSummary(BaseModel):
    """Daily market close summary."""
    date: datetime
    indices: List[MarketIndex]
    top_gainers: List[TopMover]
    top_losers: List[TopMover]
    summary_text: str
    theme: Optional[str] = None

