from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID

class RecommendationCreate(BaseModel):
    ticker: str
    action: str # BUY or SELL
    entry_price: float
    target_price: Optional[float] = None
    stop_loss: Optional[float] = None
    benchmark_ticker: str = "^NSEI"
    thesis: Optional[str] = None
    images: Optional[List[str]] = []
    weight_pct: Optional[float] = None  # Optional weight percentage (0-100)

class RecommendationResponse(RecommendationCreate):
    id: UUID
    user_id: UUID
    current_price: Optional[float]
    entry_date: datetime
    status: str
    final_return_pct: Optional[float]
    final_alpha_pct: Optional[float]

class PerformanceResponse(BaseModel):
    user_id: UUID
    username: Optional[str]
    total_return_pct: float
    alpha_pct: float
    total_ideas: int
    win_rate: float
    last_updated: datetime

class StockPrice(BaseModel):
    ticker: str
    price: float

class NewsArticle(BaseModel):
    id: Optional[UUID] = None
    ticker: str
    headline: str
    source: str
    source_url: str
    published_at: datetime
    summary_tldr: Optional[str] = None
    sentiment: Optional[str] = None
    impact_score: Optional[int] = None
    full_content: Optional[str] = None
    fetched_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

class ELI5Request(BaseModel):
    headline: str
    content: str

class ELI5Response(BaseModel):
    eli5_summary: str

class ThesisGenerateRequest(BaseModel):
    ticker: str
    analyst_notes: Optional[str] = None

class ThesisResponse(BaseModel):
    ticker: str
    generated_at: str
    summary: str
    bullCase: str
    bearCase: str
    baseCase: str
    risks: List[str]
    catalysts: List[str]
    rating: str
    ratingJustification: str

class ExportPDFRequest(BaseModel):
    thesis: ThesisResponse

class ExportNotionRequest(BaseModel):
    thesis: ThesisResponse
    notion_page_title: Optional[str] = None

# Performance Models
class PerformanceMetricsResponse(BaseModel):
    summary_metrics: Dict[str, float]
    monthly_returns: List[Dict[str, Any]]
    yearly_returns: List[Dict[str, Any]]
    portfolio_breakdown: List[Dict[str, Any]]
    best_trades: List[Dict[str, Any]]
    worst_trades: List[Dict[str, Any]]

class MonthlyReturnsMatrix(BaseModel):
    user_id: UUID
    year: int
    month: int
    return_pct: float

class PortfolioAllocation(BaseModel):
    ticker: str
    weight_pct: float
    value: float
    invested_amount: Optional[float] = None

class PortfolioBalance(BaseModel):
    user_id: str
    initial_balance: float
    current_balance: float
    available_cash: float
    total_invested: float

# Podcast Models
class PodcastSingleStockRequest(BaseModel):
    ticker: str
    companyName: str
    news: List[NewsArticle]

class PodcastPortfolioRequest(BaseModel):
    weekStart: str
    weekEnd: str
    portfolioNews: Dict[str, List[NewsArticle]]

class PodcastHighlight(BaseModel):
    ticker: str
    summary: str

class PodcastResponse(BaseModel):
    podcastTitle: str
    duration: str
    script: str
    keyPoints: Optional[List[str]] = None
    highlights: Optional[List[PodcastHighlight]] = None
    audioBase64: Optional[str] = None

