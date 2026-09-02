from pydantic import BaseModel, model_validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID

# Analysts publish an expected IRR (annualised %) over a horizon *range*, not an
# absolute price. Horizons are fixed six-month buckets spanning 0-60 months; these
# bounds mirror the CHECK constraints in database/migration_add_irr_targets.sql.
IRR_TIMEFRAME_BOUNDARIES = [0, 6, 12, 18, 24, 30, 36, 42, 48, 54, 60]
IRR_TIMEFRAME_BUCKETS = list(zip(IRR_TIMEFRAME_BOUNDARIES[:-1], IRR_TIMEFRAME_BOUNDARIES[1:]))
IRR_MIN = -100.0
IRR_MAX = 1000.0


class IrrTargetFields(BaseModel):
    """Mixin for the IRR target + horizon pair. The two are only meaningful together."""

    target_irr: Optional[float] = None  # Expected annualised IRR, in percent
    timeframe_start_months: Optional[int] = None
    timeframe_end_months: Optional[int] = None

    @model_validator(mode="after")
    def _check_irr_and_timeframe(self):
        if self.target_irr is not None and not (IRR_MIN <= self.target_irr <= IRR_MAX):
            raise ValueError(f"target_irr must be between {IRR_MIN} and {IRR_MAX}")

        start, end = self.timeframe_start_months, self.timeframe_end_months
        if (start is None) != (end is None):
            raise ValueError("timeframe_start_months and timeframe_end_months must be set together")
        if start is not None and (start, end) not in IRR_TIMEFRAME_BUCKETS:
            valid = ", ".join(f"{a}-{b}" for a, b in IRR_TIMEFRAME_BUCKETS)
            raise ValueError(f"timeframe must be one of: {valid} (months)")

        # An IRR without its horizon is not interpretable.
        if self.target_irr is not None and start is None:
            raise ValueError("target_irr requires a timeframe")
        return self

class RecommendationCreate(IrrTargetFields):
    ticker: str
    action: str # BUY or SELL
    entry_price: float
    target_price: Optional[float] = None
    stop_loss: Optional[float] = None
    benchmark_ticker: str = "^NSEI"
    thesis: Optional[str] = None
    images: Optional[List[str]] = []
    weight_pct: Optional[float] = None  # Optional weight percentage (0-100)
    # target_price is DEPRECATED -- retained so pre-IRR clients keep working.

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

# IRR Target Models (table is still named price_targets for historical reasons)
class PriceTargetCreate(IrrTargetFields):
    ticker: str
    # DEPRECATED: legacy clients may still post an absolute price instead of an IRR.
    target_price: Optional[float] = None
    target_date: Optional[datetime] = None

    @model_validator(mode="after")
    def _require_a_target(self):
        if self.target_irr is None and self.target_price is None:
            raise ValueError("Either target_irr or target_price is required")
        return self


class PriceTargetResponse(BaseModel):
    id: UUID
    user_id: UUID
    ticker: str
    created_at: datetime
    target_irr: Optional[float] = None
    timeframe_start_months: Optional[int] = None
    timeframe_end_months: Optional[int] = None
    # Legacy fields, present only on rows created before IRR targets.
    target_price: Optional[float] = None
    target_date: Optional[datetime] = None

