from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends, Request, Query
from fastapi.responses import StreamingResponse
import base64
import json
from fastapi.middleware.cors import CORSMiddleware
from .models import (
    RecommendationCreate, RecommendationResponse, StockPrice, NewsArticle, 
    ELI5Request, ELI5Response, ThesisGenerateRequest, ThesisResponse,
    ExportPDFRequest, ExportNotionRequest,
    PodcastSingleStockRequest, PodcastPortfolioRequest, PodcastResponse,
    PerformanceMetricsResponse, MonthlyReturnsMatrix, PortfolioAllocation,
    PriceTargetCreate, PriceTargetResponse
)
from .market import (
    get_current_price, 
    search_stocks, 
    get_stock_details,
    get_stock_summary,
    get_stock_history_data,
    get_financials_data,
    get_balance_sheet_data,
    get_cash_flow_data,
    get_quarterly_data,
    get_dividends_data,
    get_earnings_data,
    generate_investment_thesis
)
from .news import (
    get_news_with_refresh,
    cache_news_for_ticker,
    explain_like_im_12
)
from .podcast import (
    generate_podcast_script,
    generate_tts_audio,
    get_company_name
)
from .db import supabase
from .logic import update_user_performance
from .performance import calculate_comprehensive_performance, compute_portfolio_allocation, compute_monthly_returns_matrix
from typing import List, Dict

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Analyst Leaderboard API"}

@app.get("/market/search")
def search_market(q: str):
    return search_stocks(q)

@app.get("/market/price/{ticker}")
def get_price(ticker: str):
    price = get_current_price(ticker)
    if price is None:
        raise HTTPException(status_code=404, detail="Ticker not found")
    return {"ticker": ticker, "price": price}

@app.get("/market/details/{ticker}")
def get_details(ticker: str):
    # Deprecated or for full load
    details = get_stock_details(ticker)
    if not details:
        raise HTTPException(status_code=404, detail="Stock details not found")
    return details

@app.get("/market/summary/{ticker}")
def get_summary_endpoint(ticker: str):
    return get_stock_summary(ticker)

@app.get("/market/history/{ticker}")
def get_history_endpoint(ticker: str):
    return get_stock_history_data(ticker)

@app.get("/market/financials/income/{ticker}")
def get_income_endpoint(ticker: str):
    return get_financials_data(ticker)

@app.get("/market/financials/balance/{ticker}")
def get_balance_endpoint(ticker: str):
    return get_balance_sheet_data(ticker)

@app.get("/market/financials/cashflow/{ticker}")
def get_cashflow_endpoint(ticker: str):
    return get_cash_flow_data(ticker)

@app.get("/market/financials/quarterly/{ticker}")
def get_quarterly_endpoint(ticker: str):
    return get_quarterly_data(ticker)

@app.get("/market/dividends/{ticker}")
def get_dividends_endpoint(ticker: str):
    return get_dividends_data(ticker)

@app.get("/market/earnings/{ticker}")
def get_earnings_endpoint(ticker: str):
    return get_earnings_data(ticker)


@app.post("/recommendations")
def create_recommendation(rec: RecommendationCreate, background_tasks: BackgroundTasks):
    # 1. Get current price if entry price is 0 (market order) or validate
    current_price = get_current_price(rec.ticker)
    
    # 2. Insert into DB
    # Note: In a real app, we'd extract user_id from JWT token (Depends(get_current_user))
    # For this MVP, we expect the frontend to send the user_id or we mock it?
    # The Supabase client in frontend handles auth. 
    # The backend needs the user_id. 
    # We'll add a header or simplified payload for MVP since we are using supabase-js on frontend directly mostly?
    # Actually, for this backend to write as the user, it needs the user's token or we use service role (admin).
    # Using service role (in db.py) means we can write anything.
    # We'll ask frontend to pass 'user_id' in the body for now (insecure but fits MVP speed).
    # Wait, the Schema says `user_id` is FK to profiles.
    
    # Let's assume the request includes `user_id` (I need to update model or pass it separately)
    # I will update the model in memory or just expect it in a hacky way
    # Or better: Client sends a token, we verify.
    # Simplest MVP: Client sends user_id in header 'x-user-id'.
    pass

# Re-defining to include user_id from header for MVP simplicity
@app.post("/recommendations/create")
def create_rec_endpoint(rec: RecommendationCreate, user_id: str, background_tasks: BackgroundTasks):
    # Fetch current benchmark price to store? 
    # Logic.py handles calculation dynamically, but storing entry bench price is better.
    # I'll stick to logic.py approach.
    
    data = rec.dict()
    
    # Extract price_target and target_date before inserting into recommendations table
    # These are stored separately in the price_targets table
    price_target = data.pop('price_target', None)
    target_date = data.pop('target_date', None)
    
    data['user_id'] = user_id
    
    # DON'T set organization_id on recommendations - they follow the user's profile.organization_id
    # This allows recommendations to be portable when users move between organizations
    
    # Force entry price check
    if data['entry_price'] == 0:
         price = get_current_price(data['ticker'])
         if price:
             data['entry_price'] = price
         else:
             raise HTTPException(status_code=400, detail="Could not fetch price")

    # Fetch and store entry benchmark price
    benchmark_ticker = data.get('benchmark_ticker', '^NSEI')
    try:
        from .market import get_current_price
        entry_bench_price = get_current_price(benchmark_ticker)
        if entry_bench_price:
            data['entry_benchmark_price'] = entry_bench_price
    except:
        pass  # Continue without benchmark price if fetch fails
    
    # Initialize portfolio balance if needed
    from .portfolio import get_portfolio_balance, calculate_position_size, update_portfolio_balance
    balance = get_portfolio_balance(user_id)
    available_balance = float(balance.get('available_cash', 1000000))
    
    # Handle weight and position_size calculation
    weight_pct = data.get('weight_pct')
    entry_price = float(data.get('entry_price', 0))
    
    if entry_price <= 0:
        raise HTTPException(status_code=400, detail="Entry price must be greater than 0")
    
    if weight_pct is not None:
        # User provided weight, validate it sums to 100% with other positions
        from .performance import validate_and_rebalance_weights
        validation_result = validate_and_rebalance_weights(user_id, weight_pct)
        
        if not validation_result['valid']:
            raise HTTPException(status_code=400, detail=validation_result['error'])
        
        # Calculate invested_amount and position_size based on weight
        invested_amount, position_size = calculate_position_size(weight_pct, entry_price, available_balance)
        data['weight_pct'] = weight_pct
        data['invested_amount'] = invested_amount
        data['position_size'] = position_size
    else:
        # No weight provided, will be calculated in rebalance function
        data['weight_pct'] = None
        data['invested_amount'] = 0
        data['position_size'] = None
    
    res = supabase.table("recommendations").insert(data).execute()
    
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create recommendation")
    
    # If price_target is provided, create a price target entry in the price_targets table
    if price_target is not None:
        try:
            # target_date might already be a string (ISO format) from frontend
            target_date_str = None
            if target_date:
                if isinstance(target_date, str):
                    target_date_str = target_date
                else:
                    target_date_str = target_date.isoformat()
            
            price_target_data = {
                "user_id": user_id,
                "ticker": data['ticker'],
                "target_price": float(price_target),
                "target_date": target_date_str
            }
            # DON'T set organization_id - price targets follow user's current profile
            supabase.table("price_targets").insert(price_target_data).execute()
        except Exception as e:
            # Log error but don't fail the recommendation creation
            print(f"Warning: Failed to create price target: {str(e)}")
    
    # Rebalance weights and calculate position_size for all positions
    from .performance import rebalance_portfolio_weights
    background_tasks.add_task(rebalance_portfolio_weights, user_id)
    
    # Update portfolio balance
    background_tasks.add_task(update_portfolio_balance, user_id)
        
    # Trigger performance update (both basic and comprehensive)
    background_tasks.add_task(update_user_performance, user_id)
    # Also trigger comprehensive performance recalculation in background
    background_tasks.add_task(calculate_comprehensive_performance, user_id)
    
    return res.data[0]

@app.get("/leaderboard")
def get_leaderboard():
    # Fetch performance table sorted by alpha
    res = supabase.table("performance").select("*, profiles(username)").order("alpha_pct", desc=True).execute()
    return res.data

@app.post("/update-stats/{user_id}")
def trigger_update(user_id: str):
    update_user_performance(user_id)
    return {"status": "updated"}

# PRICE TARGET ENDPOINTS

@app.post("/price-targets", response_model=PriceTargetResponse)
def create_price_target(price_target: PriceTargetCreate, user_id: str = Query(...)):
    """
    Create a new price target for a user+ticker combination.
    Price targets are immutable once created.
    """
    try:
        print(f"Creating price target for user_id={user_id}, ticker={price_target.ticker}, target_price={price_target.target_price}")
        
        # DON'T fetch organization_id - price targets follow user's current profile
        data = {
            "user_id": user_id,
            "ticker": price_target.ticker,
            "target_price": float(price_target.target_price),
            "target_date": price_target.target_date.isoformat() if price_target.target_date else None
        }
        # organization_id is NOT set - follows user's profile.organization_id
        
        print(f"Inserting price target data: {data}")
        
        try:
            res = supabase.table("price_targets").insert(data).execute()
            print(f"Insert response: {res}")
        except Exception as insert_error:
            print(f"Supabase insert exception: {type(insert_error).__name__}: {str(insert_error)}")
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"Database insert error: {str(insert_error)}")
        
        # Check for errors in the response (Supabase Python client may raise exceptions instead)
        if hasattr(res, 'error') and res.error:
            print(f"Supabase error in response: {res.error}")
            error_msg = str(res.error) if isinstance(res.error, dict) else res.error
            raise HTTPException(status_code=500, detail=f"Database error: {error_msg}")
        
        if not res.data or len(res.data) == 0:
            print(f"No data returned from insert. Response object: {res}, type: {type(res)}")
            raise HTTPException(status_code=500, detail="Failed to create price target - no data returned")
        
        print(f"Successfully created price target: {res.data[0]}")
        return res.data[0]
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        print(f"Unexpected exception creating price target: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error creating price target: {str(e)}")

@app.get("/price-targets/{ticker}")
def get_price_targets(ticker: str, user_id: str = Query(...)):
    """
    Get all price targets for current user's ticker, ordered by creation date.
    """
    try:
        res = supabase.table("price_targets")\
            .select("*")\
            .eq("user_id", user_id)\
            .eq("ticker", ticker)\
            .order("created_at", desc=False)\
            .execute()
        
        return res.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching price targets: {str(e)}")

@app.get("/price-targets/analyst/{analyst_user_id}/{ticker}")
def get_analyst_price_targets(analyst_user_id: str, ticker: str):
    """
    Get all price targets for a specific analyst's ticker, ordered by creation date.
    Used for displaying in analyst profile.
    """
    try:
        res = supabase.table("price_targets")\
            .select("*")\
            .eq("user_id", analyst_user_id)\
            .eq("ticker", ticker)\
            .order("created_at", desc=False)\
            .execute()
        
        return res.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching analyst price targets: {str(e)}")

# NEWS ENDPOINTS

@app.get("/news/{ticker}")
def get_news(ticker: str, force_refresh: bool = False):
    """
    Get news for a ticker. 
    - Checks cache first (last 7 days)
    - If cache miss (< 5 articles) or force_refresh=True, fetches 25 recent articles
    - Summarizes articles with GPT and caches them
    """
    try:
        news = get_news_with_refresh(ticker, force_refresh=force_refresh)
        return {"ticker": ticker, "articles": news, "count": len(news)}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error fetching news: {str(e)}")

@app.post("/news/eli5")
def get_eli5_summary(request: ELI5Request):
    """
    Generate an ELI5 (Explain Like I'm 12) summary for an article
    """
    try:
        eli5_summary = explain_like_im_12(request.content, request.headline)
        return ELI5Response(eli5_summary=eli5_summary)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating ELI5 summary: {str(e)}")

@app.post("/news/refresh/{ticker}")
def refresh_news(ticker: str, background_tasks: BackgroundTasks):
    """
    Manually trigger news refresh for a ticker (runs in background)
    """
    background_tasks.add_task(cache_news_for_ticker, ticker)
    return {"status": "refresh_scheduled", "ticker": ticker}

# AI THESIS ENDPOINTS

@app.post("/api/ai/generateThesis", response_model=ThesisResponse)
def generate_thesis(request: ThesisGenerateRequest):
    """
    Generate AI-powered investment thesis for a stock.
    Aggregates fundamentals, technicals, and sentiment data.
    """
    try:
        thesis_data = generate_investment_thesis(request.ticker, request.analyst_notes)
        
        # Convert to response model
        return ThesisResponse(
            ticker=thesis_data.get("ticker", request.ticker),
            generated_at=thesis_data.get("generated_at", ""),
            summary=thesis_data.get("summary", ""),
            bullCase=thesis_data.get("bullCase", ""),
            bearCase=thesis_data.get("bearCase", ""),
            baseCase=thesis_data.get("baseCase", ""),
            risks=thesis_data.get("risks", []),
            catalysts=thesis_data.get("catalysts", []),
            rating=thesis_data.get("rating", "Hold"),
            ratingJustification=thesis_data.get("ratingJustification", "")
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error generating thesis: {str(e)}")

@app.post("/api/export/pdf")
def export_pdf(request: ExportPDFRequest):
    """
    Export thesis to PDF (server-side).
    Note: For MVP, we'll return the thesis data and let frontend handle PDF generation.
    In production, use reportlab or weasyprint here.
    """
    # For now, return thesis data - frontend will handle PDF generation
    return {
        "status": "success",
        "thesis": request.thesis.dict(),
        "message": "Use client-side PDF generation"
    }

@app.post("/api/export/notion")
def export_notion(request: ExportNotionRequest):
    """
    Export thesis to Notion page.
    Requires NOTION_API_KEY and NOTION_DATABASE_ID environment variables.
    """
    try:
        import os
        notion_api_key = os.getenv("NOTION_API_KEY")
        notion_database_id = os.getenv("NOTION_DATABASE_ID")
        
        if not notion_api_key:
            raise HTTPException(
                status_code=500, 
                detail="Notion API key not configured. Set NOTION_API_KEY environment variable."
            )
        
        # For MVP, return instructions
        # In production, use notion-sdk-py to create page
        return {
            "status": "not_implemented",
            "message": "Notion export requires notion-sdk-py. Install with: pip install notion-sdk",
            "thesis": request.thesis.dict()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error exporting to Notion: {str(e)}")

# PODCAST ENDPOINTS

@app.post("/api/podcast/generate", response_model=PodcastResponse)
async def generate_podcast(request: Request):
    """
    Generate FinPod AI podcast script and TTS audio.
    Accepts either single-stock or portfolio request format.
    Saves podcast to database if user_id is provided in request body.
    """
    try:
        # Parse request body
        body = await request.json()
        user_id = body.get("user_id")
        request_type = body.get("type")
        
        print(f"DEBUG: Received request - type: {request_type}, user_id: {user_id}")
        print(f"DEBUG: Full request body keys: {list(body.keys())}")
        
        if request_type == "single-stock":
            ticker = body.get("ticker")
            company_name = body.get("companyName")
            news = body.get("news", [])
            
            if not ticker or not company_name:
                raise HTTPException(status_code=400, detail="Missing ticker or companyName for single-stock podcast")
            
            # Generate script
            script_result = generate_podcast_script(
                request_type="single-stock",
                ticker=ticker,
                company_name=company_name,
                news=news
            )
            
            # Generate TTS audio
            audio_bytes = None
            audio_base64 = None
            try:
                audio_bytes = generate_tts_audio(script_result.get("script", ""))
                audio_base64 = base64.b64encode(audio_bytes).decode('utf-8')
            except Exception as tts_error:
                print(f"TTS generation failed, returning script only: {tts_error}")
                # Continue without audio - script is still valuable
            
            podcast_title = script_result.get("podcastTitle", f"Quick Take: {ticker}")
            duration = script_result.get("duration", "30-45 seconds")
            script = script_result.get("script", "")
            key_points = script_result.get("keyPoints", [])
            
            # Save to database if user_id provided
            podcast_id = None
            print(f"DEBUG: About to save - user_id: {user_id}, type: {type(user_id)}")
            if user_id:
                try:
                    podcast_data = {
                        "user_id": str(user_id),  # Ensure it's a string/UUID format
                        "podcast_type": "single-stock",
                        "ticker": ticker,
                        "company_name": company_name,
                        "podcast_title": podcast_title,
                        "duration": duration,
                        "script": script,
                        "audio_base64": audio_base64,
                        "key_points": key_points if key_points else []
                    }
                    print(f"DEBUG: Podcast data to insert: {list(podcast_data.keys())}")
                    print(f"DEBUG: user_id value: {podcast_data['user_id']}")
                    print(f"Saving single-stock podcast for user {user_id}, ticker {ticker}")
                    
                    result = supabase.table("podcasts").insert(podcast_data).execute()
                    print(f"DEBUG: Insert result type: {type(result)}")
                    print(f"DEBUG: Insert result: {result}")
                    print(f"DEBUG: Has data attr: {hasattr(result, 'data')}")
                    print(f"DEBUG: Has error attr: {hasattr(result, 'error')}")
                    
                    # Check for errors first
                    if hasattr(result, 'error') and result.error:
                        print(f"✗ Supabase error: {result.error}")
                        raise Exception(f"Supabase insert error: {result.error}")
                    
                    # Check for data
                    if hasattr(result, 'data'):
                        if result.data and len(result.data) > 0:
                            podcast_id = result.data[0].get("id")
                            print(f"✓ Successfully saved podcast with ID: {podcast_id}")
                        else:
                            print(f"⚠ Warning: Insert returned no data. Result: {result}")
                            # Try to get more info
                            if hasattr(result, 'count'):
                                print(f"Result count: {result.count}")
                    else:
                        # Try to access result directly if it's a dict
                        if isinstance(result, dict):
                            if 'data' in result and result['data']:
                                podcast_id = result['data'][0].get("id")
                                print(f"✓ Successfully saved podcast with ID: {podcast_id}")
                            elif 'error' in result:
                                print(f"✗ Error in result dict: {result['error']}")
                                raise Exception(f"Supabase insert error: {result['error']}")
                        else:
                            print(f"⚠ Warning: Unexpected result structure. Result type: {type(result)}, Result: {result}")
                except Exception as save_error:
                    import traceback
                    print(f"✗ Exception saving podcast to database: {save_error}")
                    traceback.print_exc()
                    # Continue even if save fails - don't break the request
            else:
                print("⚠ No user_id provided in request, skipping database save")
            
            return PodcastResponse(
                podcastTitle=podcast_title,
                duration=duration,
                script=script,
                keyPoints=key_points,
                audioBase64=audio_base64
            )
            
        elif request_type == "portfolio":
            week_start = body.get("weekStart")
            week_end = body.get("weekEnd")
            portfolio_news = body.get("portfolioNews", {})
            
            if not week_start or not week_end:
                raise HTTPException(status_code=400, detail="Missing weekStart or weekEnd for portfolio podcast")
            
            # Generate script
            script_result = generate_podcast_script(
                request_type="portfolio",
                week_start=week_start,
                week_end=week_end,
                portfolio_news=portfolio_news
            )
            
            # Generate TTS audio
            audio_bytes = None
            audio_base64 = None
            try:
                audio_bytes = generate_tts_audio(script_result.get("script", ""))
                audio_base64 = base64.b64encode(audio_bytes).decode('utf-8')
            except Exception as tts_error:
                print(f"TTS generation failed, returning script only: {tts_error}")
                # Continue without audio - script is still valuable
            
            # Convert highlights to PodcastHighlight objects
            highlights = []
            if script_result.get("highlights"):
                for h in script_result.get("highlights", []):
                    highlights.append({
                        "ticker": h.get("ticker", ""),
                        "summary": h.get("summary", "")
                    })
            
            podcast_title = script_result.get("podcastTitle", "Your Weekly Portfolio Roundup")
            duration = script_result.get("duration", "60-90 seconds")
            script = script_result.get("script", "")
            
            # Save to database if user_id provided
            podcast_id = None
            print(f"DEBUG: user_id received: {user_id}, type: {type(user_id)}")
            if user_id:
                try:
                    podcast_data = {
                        "user_id": str(user_id),  # Ensure it's a string
                        "podcast_type": "portfolio",
                        "podcast_title": podcast_title,
                        "duration": duration,
                        "script": script,
                        "audio_base64": audio_base64,
                        "highlights": highlights if highlights else [],
                        "week_start": week_start,
                        "week_end": week_end
                    }
                    print(f"Saving portfolio podcast for user {user_id}, week {week_start} to {week_end}")
                    print(f"Podcast data keys: {list(podcast_data.keys())}")
                    result = supabase.table("podcasts").insert(podcast_data).execute()
                    print(f"DEBUG: Portfolio insert result type: {type(result)}")
                    print(f"DEBUG: Portfolio insert result: {result}")
                    print(f"DEBUG: Has data attr: {hasattr(result, 'data')}")
                    print(f"DEBUG: Has error attr: {hasattr(result, 'error')}")
                    
                    # Check for errors first
                    if hasattr(result, 'error') and result.error:
                        print(f"✗ Supabase error: {result.error}")
                        raise Exception(f"Supabase insert error: {result.error}")
                    
                    # Check for data
                    if hasattr(result, 'data'):
                        if result.data and len(result.data) > 0:
                            podcast_id = result.data[0].get("id")
                            print(f"✓ Successfully saved portfolio podcast with ID: {podcast_id}")
                        else:
                            print(f"⚠ Warning: Insert returned no data. Result: {result}")
                            if hasattr(result, 'count'):
                                print(f"Result count: {result.count}")
                    else:
                        # Try to access result directly if it's a dict
                        if isinstance(result, dict):
                            if 'data' in result and result['data']:
                                podcast_id = result['data'][0].get("id")
                                print(f"✓ Successfully saved portfolio podcast with ID: {podcast_id}")
                            elif 'error' in result:
                                print(f"✗ Error in result dict: {result['error']}")
                                raise Exception(f"Supabase insert error: {result['error']}")
                        else:
                            print(f"⚠ Warning: Unexpected result structure. Result type: {type(result)}, Result: {result}")
                except Exception as save_error:
                    import traceback
                    print(f"✗ Failed to save podcast to database: {save_error}")
                    traceback.print_exc()
                    # Continue even if save fails - don't break the request
            else:
                print("⚠ No user_id provided, skipping save")
            
            return PodcastResponse(
                podcastTitle=podcast_title,
                duration=duration,
                script=script,
                highlights=highlights if highlights else None,
                audioBase64=audio_base64
            )
            
        else:
            raise HTTPException(status_code=400, detail=f"Invalid request type: {request_type}. Must be 'single-stock' or 'portfolio'")
            
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error generating podcast: {str(e)}")

@app.get("/api/podcasts")
def get_podcasts(user_id: str, podcast_type: str = None, ticker: str = None):
    """
    Retrieve saved podcasts for a user.
    Can filter by podcast_type and/or ticker.
    """
    try:
        query = supabase.table("podcasts").select("*").eq("user_id", user_id)
        
        if podcast_type:
            query = query.eq("podcast_type", podcast_type)
        
        if ticker:
            query = query.eq("ticker", ticker)
        
        query = query.order("created_at", desc=True)
        result = query.execute()
        
        return {"podcasts": result.data if result.data else []}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error retrieving podcasts: {str(e)}")

@app.get("/api/podcasts/{podcast_id}")
def get_podcast(podcast_id: str, user_id: str):
    """
    Retrieve a specific podcast by ID.
    """
    try:
        result = supabase.table("podcasts").select("*").eq("id", podcast_id).eq("user_id", user_id).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Podcast not found")
        
        podcast = result.data[0]
        
        return PodcastResponse(
            podcastTitle=podcast.get("podcast_title", ""),
            duration=podcast.get("duration", ""),
            script=podcast.get("script", ""),
            keyPoints=podcast.get("key_points", []),
            highlights=podcast.get("highlights", []),
            audioBase64=podcast.get("audio_base64")
        )
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error retrieving podcast: {str(e)}")

@app.delete("/api/podcasts/{podcast_id}")
def delete_podcast(podcast_id: str, user_id: str):
    """
    Delete a podcast by ID.
    """
    try:
        result = supabase.table("podcasts").delete().eq("id", podcast_id).eq("user_id", user_id).execute()
        
        return {"status": "deleted", "id": podcast_id}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error deleting podcast: {str(e)}")

@app.post("/api/podcasts/save")
async def save_podcast(request: Request):
    """
    Manually save a podcast to the database.
    Accepts podcast data and saves it for the user.
    """
    try:
        body = await request.json()
        user_id = body.get("user_id")
        podcast_type = body.get("podcast_type")  # "single-stock" or "portfolio"
        podcast_title = body.get("podcast_title")
        script = body.get("script")
        audio_base64 = body.get("audio_base64")
        duration = body.get("duration", "")
        
        if not user_id:
            raise HTTPException(status_code=400, detail="user_id is required")
        if not podcast_type:
            raise HTTPException(status_code=400, detail="podcast_type is required")
        if not podcast_title or not script:
            raise HTTPException(status_code=400, detail="podcast_title and script are required")
        
        podcast_data = {
            "user_id": str(user_id),
            "podcast_type": podcast_type,
            "podcast_title": podcast_title,
            "duration": duration,
            "script": script,
            "audio_base64": audio_base64,
        }
        
        # Add type-specific fields
        if podcast_type == "single-stock":
            ticker = body.get("ticker")
            company_name = body.get("company_name")
            key_points = body.get("key_points", [])
            if ticker:
                podcast_data["ticker"] = ticker
            if company_name:
                podcast_data["company_name"] = company_name
            if key_points:
                podcast_data["key_points"] = key_points
        elif podcast_type == "portfolio":
            highlights = body.get("highlights", [])
            week_start = body.get("week_start")
            week_end = body.get("week_end")
            if highlights:
                podcast_data["highlights"] = highlights
            if week_start:
                podcast_data["week_start"] = week_start
            if week_end:
                podcast_data["week_end"] = week_end
        
        print(f"Saving podcast manually - user_id: {user_id}, type: {podcast_type}")
        result = supabase.table("podcasts").insert(podcast_data).execute()
        
        if hasattr(result, 'error') and result.error:
            print(f"✗ Supabase error: {result.error}")
            raise HTTPException(status_code=500, detail=f"Failed to save podcast: {result.error}")
        
        if hasattr(result, 'data') and result.data and len(result.data) > 0:
            podcast_id = result.data[0].get("id")
            print(f"✓ Successfully saved podcast with ID: {podcast_id}")
            return {"status": "saved", "id": podcast_id, "podcast": result.data[0]}
        else:
            raise HTTPException(status_code=500, detail="Failed to save podcast: No data returned")
            
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error saving podcast: {str(e)}")

# PERFORMANCE ENDPOINTS

@app.get("/api/analyst/{user_id}/performance", response_model=PerformanceMetricsResponse)
def get_analyst_performance(user_id: str, background_tasks: BackgroundTasks):
    """
    Get comprehensive performance metrics for an analyst.
    Returns cached data immediately, triggers background recalculation if cache is stale.
    """
    try:
        from .performance import get_cached_performance_data
        
        # Try to get cached data first
        cached_data = get_cached_performance_data(user_id)
        
        if cached_data:
            # Return cached data immediately
            # Trigger background recalculation if cache is older than 1 hour
            try:
                from .performance import get_cached_performance_summary
                summary = get_cached_performance_summary(user_id)
                if summary and summary.get('last_updated'):
                    from datetime import datetime, timedelta
                    last_updated = datetime.fromisoformat(summary['last_updated'].replace('Z', '+00:00'))
                    if datetime.now().replace(tzinfo=last_updated.tzinfo) - last_updated > timedelta(hours=1):
                        # Cache is stale, trigger recalculation in background
                        background_tasks.add_task(calculate_comprehensive_performance, user_id)
                else:
                    # No timestamp, trigger recalculation
                    background_tasks.add_task(calculate_comprehensive_performance, user_id)
            except:
                # If check fails, still return cached data but trigger update
                background_tasks.add_task(calculate_comprehensive_performance, user_id)
            
            return PerformanceMetricsResponse(**cached_data)
        else:
            # No cache, calculate synchronously but with timeout protection
            try:
                performance_data = calculate_comprehensive_performance(user_id)
                return PerformanceMetricsResponse(**performance_data)
            except Exception as calc_error:
                # If calculation fails, return empty data structure
                return PerformanceMetricsResponse(
                    summary_metrics={},
                    monthly_returns=[],
                    yearly_returns=[],
                    portfolio_breakdown=[],
                    best_trades=[],
                    worst_trades=[]
                )
    except Exception as e:
        import traceback
        traceback.print_exc()
        # Return empty structure instead of error
        return PerformanceMetricsResponse(
            summary_metrics={},
            monthly_returns=[],
            yearly_returns=[],
            portfolio_breakdown=[],
            best_trades=[],
            worst_trades=[]
        )

@app.get("/api/leaderboard/performance")
def get_leaderboard_performance():
    """
    Get leaderboard with performance metrics for all analysts.
    Returns sorted list by alpha or sharpe ratio.
    """
    try:
        # Use the basic performance table (no cache needed)
        res = supabase.table("performance").select("*, profiles(username)").execute()
        
        if not res.data:
            return []
        
        # Sort by alpha_pct descending
        sorted_data = sorted(res.data, key=lambda x: x.get('alpha_pct', 0) or 0, reverse=True)
        return sorted_data
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Error fetching leaderboard performance: {str(e)}")
        # Return empty list instead of raising exception to prevent UI errors
        return []

@app.post("/api/performance/recompute")
def recompute_performance(user_id: str, background_tasks: BackgroundTasks):
    """
    Admin endpoint to manually trigger performance recalculation.
    Accepts user_id as query parameter.
    Runs in background to avoid timeouts.
    """
    try:
        # Run in background
        background_tasks.add_task(calculate_comprehensive_performance, user_id)
        return {"status": "queued", "user_id": user_id, "message": "Performance recalculation queued"}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error queuing performance recalculation: {str(e)}")

@app.get("/api/performance/monthly-matrix/{user_id}")
def get_monthly_matrix(user_id: str, background_tasks: BackgroundTasks):
    """
    Get monthly returns matrix for a user (2020-2025).
    Returns cached data, triggers background recalculation if needed.
    """
    try:
        from .performance import get_cached_monthly_returns
        
        # Try to get cached data first
        cached_returns = get_cached_monthly_returns(user_id)
        
        if cached_returns and len(cached_returns) > 0:
            # Trigger background recalculation if cache is stale
            try:
                from .performance import get_cached_performance_summary
                summary = get_cached_performance_summary(user_id)
                if summary and summary.get('last_updated'):
                    from datetime import datetime, timedelta
                    last_updated = datetime.fromisoformat(summary['last_updated'].replace('Z', '+00:00'))
                    if datetime.now().replace(tzinfo=last_updated.tzinfo) - last_updated > timedelta(hours=1):
                        background_tasks.add_task(calculate_comprehensive_performance, user_id)
            except:
                pass
            
            return {"monthly_returns": cached_returns}
        else:
            # No cache, try to compute but trigger in background to avoid timeout
            background_tasks.add_task(calculate_comprehensive_performance, user_id)
            return {"monthly_returns": []}
    except Exception as e:
        import traceback
        traceback.print_exc()
        # Return empty array instead of error
        return {"monthly_returns": []}

@app.get("/api/performance/portfolio-allocation/{user_id}")
def get_portfolio_allocation(user_id: str):
    """
    Get current portfolio allocation (weights by ticker) for pie chart.
    """
    try:
        allocation = compute_portfolio_allocation(user_id)
        return {"allocation": allocation}
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Error fetching portfolio allocation: {e}")
        # Return empty allocation instead of raising error
        return {"allocation": []}


@app.get("/api/portfolio/balance/{user_id}")
def get_portfolio_balance_endpoint(user_id: str):
    """Get portfolio balance for a user"""
    try:
        from .portfolio import get_portfolio_balance, update_portfolio_balance
        balance = get_portfolio_balance(user_id)
        # Update balance to ensure it's current
        updated_balance = update_portfolio_balance(user_id)
        return updated_balance if updated_balance else balance
    except Exception as e:
        print(f"Error fetching portfolio balance: {e}")
        return {
            "user_id": user_id,
            "initial_balance": 1000000,
            "current_balance": 1000000,
            "available_cash": 1000000,
            "total_invested": 0
        }


@app.get("/api/portfolio/weights/{user_id}")
def get_portfolio_weights_endpoint(user_id: str):
    """Get current weights from database for all open positions (debug endpoint)"""
    try:
        res = supabase.table("recommendations").select("id, ticker, weight_pct, invested_amount, position_size").eq("user_id", user_id).eq("status", "OPEN").execute()
        open_positions = res.data if res.data else []
        
        weights = {}
        for pos in open_positions:
            weights[str(pos['id'])] = {
                'ticker': pos['ticker'],
                'weight_pct': float(pos.get('weight_pct', 0) or 0),
                'invested_amount': float(pos.get('invested_amount', 0) or 0),
                'position_size': float(pos.get('position_size', 0) or 0)
            }
        
        return {"weights": weights, "count": len(weights)}
    except Exception as e:
        print(f"Error fetching portfolio weights: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@app.put("/api/portfolio/weights/{user_id}")
def update_portfolio_weights_endpoint(user_id: str, weight_updates: Dict[str, float], background_tasks: BackgroundTasks):
    """
    Update portfolio weights for multiple positions.
    weight_updates: {recommendation_id: new_weight_pct}
    """
    try:
        from .portfolio import rebalance_portfolio_with_weights, update_portfolio_balance
        from .performance import calculate_comprehensive_performance
        
        print(f"[API] Bulk weight update for user {user_id}: {weight_updates}")
        
        # Rebalance portfolio with new weights
        balance = rebalance_portfolio_with_weights(user_id, weight_updates)
        
        # Verify weights were saved - read back from database
        verify_res = supabase.table("recommendations").select("id, ticker, weight_pct").eq("user_id", user_id).eq("status", "OPEN").execute()
        saved_weights = {str(pos['id']): float(pos.get('weight_pct', 0) or 0) for pos in (verify_res.data or [])}
        print(f"[API] Verified saved weights after bulk update: {saved_weights}")
        
        # Trigger performance recalculation
        background_tasks.add_task(calculate_comprehensive_performance, user_id)
        
        return {"success": True, "balance": balance, "saved_weights": saved_weights}
    except Exception as e:
        print(f"[API] Error updating portfolio weights: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error updating weights: {str(e)}")


@app.post("/api/portfolio/rebalance/{user_id}")
def rebalance_portfolio_endpoint(user_id: str, background_tasks: BackgroundTasks):
    """Trigger portfolio rebalancing (equal weight)"""
    try:
        from .performance import rebalance_portfolio_weights
        from .portfolio import update_portfolio_balance
        from .performance import calculate_comprehensive_performance
        
        # Rebalance to equal weights
        rebalance_portfolio_weights(user_id)
        
        # Update balance
        balance = update_portfolio_balance(user_id)
        
        # Trigger performance recalculation
        background_tasks.add_task(calculate_comprehensive_performance, user_id)
        
        return {"success": True, "balance": balance}
    except Exception as e:
        print(f"Error rebalancing portfolio: {e}")
        raise HTTPException(status_code=500, detail=f"Error rebalancing: {str(e)}")


@app.post("/api/portfolio/rebalance-weights")
def rebalance_weights_endpoint(weight_update: Dict, background_tasks: BackgroundTasks):
    """
    Rebalance weights with auto-adjustment.
    Body: {"user_id": str, "target_recommendation_id": str, "new_weight": float}
    Note: Works with individual recommendations, not aggregated by ticker
    """
    try:
        from .portfolio import get_portfolio_balance, compute_rebalanced_weights, rebalance_portfolio_with_weights
        from .performance import calculate_comprehensive_performance
        
        user_id = weight_update.get('user_id')
        target_rec_id = weight_update.get('target_recommendation_id') or weight_update.get('target_ticker')  # Support both for backward compat
        new_weight = float(weight_update.get('new_weight', 0))
        
        print(f"[API] Rebalance request: user={user_id}, target={target_rec_id}, new_weight={new_weight}")
        
        if not user_id or not target_rec_id:
            raise HTTPException(status_code=400, detail="user_id and target_recommendation_id required")
        
        # Get all OPEN positions (keep individual recommendations separate)
        res = supabase.table("recommendations").select("id, ticker, weight_pct").eq("user_id", user_id).eq("status", "OPEN").execute()
        open_positions = res.data if res.data else []
        
        if not open_positions:
            return {"success": True, "weights": {}, "balance": get_portfolio_balance(user_id)}
        
        # Build weights dict by recommendation ID (not ticker)
        old_weights: Dict[str, float] = {}
        target_id = None
        
        for pos in open_positions:
            rec_id = str(pos['id'])
            weight = float(pos.get('weight_pct', 0) or 0)
            old_weights[rec_id] = weight
            
            # Find target recommendation ID
            if target_rec_id == rec_id or target_rec_id == pos.get('ticker'):
                target_id = rec_id
        
        if not target_id:
            # If not found by ID, try to find by ticker (use first match)
            for pos in open_positions:
                if pos.get('ticker') == target_rec_id:
                    target_id = str(pos['id'])
                    break
        
        if not target_id:
            raise HTTPException(status_code=400, detail=f"Target recommendation not found: {target_rec_id}")
        
        # Compute rebalanced weights
        rebalanced_weights = compute_rebalanced_weights(old_weights, target_id, new_weight)
        print(f"[API] Computed rebalanced weights: {rebalanced_weights}")
        
        # Update portfolio with rebalanced weights
        balance = rebalance_portfolio_with_weights(user_id, rebalanced_weights)
        
        # Verify weights were saved - read back from database
        verify_res = supabase.table("recommendations").select("id, ticker, weight_pct").eq("user_id", user_id).eq("status", "OPEN").execute()
        saved_weights = {str(pos['id']): float(pos.get('weight_pct', 0) or 0) for pos in (verify_res.data or [])}
        print(f"[API] Verified saved weights: {saved_weights}")
        
        # Trigger performance recalculation
        background_tasks.add_task(calculate_comprehensive_performance, user_id)
        
        return {"success": True, "weights": saved_weights, "balance": balance}
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"[API] Error rebalancing weights: {e}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@app.get("/api/portfolio/preview/{user_id}")
def get_portfolio_preview(user_id: str):
    """Get real-time performance preview with expected metrics using simple historical price calculation"""
    try:
        import yfinance as yf
        import pandas as pd
        import numpy as np
        from datetime import datetime, timedelta, date as dt_date
        
        from .portfolio import get_portfolio_balance, INITIAL_BALANCE
        
        # Get portfolio balance
        balance = get_portfolio_balance(user_id)
        
        # Get all OPEN positions (keep individual recommendations separate, but aggregate weights by ticker for calculation)
        # Use order_by to ensure consistent ordering (this helps avoid cache issues)
        res = supabase.table("recommendations").select("*").eq("user_id", user_id).eq("status", "OPEN").order('entry_date', desc=True).execute()
        open_positions = res.data if res.data else []
        
        print(f"[PREVIEW] Fetched {len(open_positions)} positions for user {user_id}")
        
        if not open_positions:
            return {
                "expected_return": 0.0,
                "expected_volatility": 0.0,
                "expected_sharpe": 0.0,
                "max_drawdown": 0.0,
                "returns_1m": 0.0,
                "returns_3m": 0.0,
                "returns_6m": 0.0,
                "returns_12m": 0.0,
                "contribution": []
            }
        
        # Extract unique tickers and aggregate weights (for calculation only)
        tickers = []
        weights_list = []
        entry_prices = {}
        current_prices = {}
        
        total_weight = sum(float(pos.get('weight_pct', 0) or 0) for pos in open_positions)
        
        # If no weights set, distribute equally
        if total_weight == 0:
            equal_weight = 100.0 / len(open_positions)
            for pos in open_positions:
                ticker = pos['ticker']
                if ticker not in tickers:
                    tickers.append(ticker)
                    weights_list.append(equal_weight)
                    entry_prices[ticker] = float(pos.get('entry_price', 0) or 0)
                    current_prices[ticker] = float(pos.get('current_price', 0) or entry_prices.get(ticker, 0))
                else:
                    # Sum weights for same ticker
                    idx = tickers.index(ticker)
                    weights_list[idx] += equal_weight
        else:
            # Use actual weights - aggregate by ticker
            for pos in open_positions:
                ticker = pos['ticker']
                weight = float(pos.get('weight_pct', 0) or 0)
                if ticker not in tickers:
                    tickers.append(ticker)
                    weights_list.append(weight)
                    entry_prices[ticker] = float(pos.get('entry_price', 0) or 0)
                    current_prices[ticker] = float(pos.get('current_price', 0) or entry_prices.get(ticker, 0))
                else:
                    # Sum weights for same ticker
                    idx = tickers.index(ticker)
                    weights_list[idx] += weight
        
        if not tickers:
            return {
                "expected_return": 0.0,
                "expected_volatility": 0.0,
                "expected_sharpe": 0.0,
                "max_drawdown": 0.0,
                "returns_1m": 0.0,
                "returns_3m": 0.0,
                "returns_6m": 0.0,
                "returns_12m": 0.0,
                "contribution": []
            }
        
        # Normalize weights to sum to 100
        total_weight = sum(weights_list)
        if total_weight > 0:
            weights_list = [w * 100.0 / total_weight for w in weights_list]
        
        # Periods for historical returns
        periods = {
            "1M": 30,
            "3M": 90,
            "6M": 180,
            "12M": 365
        }
        
        # Fetch historical price data for all tickers
        max_days = max(periods.values()) + 10  # Add buffer for weekends
        end_date = dt_date.today()
        start_date = end_date - timedelta(days=max_days)
        
        try:
            # Download historical data
            price_data = yf.download(tickers, start=start_date.strftime("%Y-%m-%d"), end=end_date.strftime("%Y-%m-%d"), progress=False)
            
            if price_data.empty:
                raise Exception("No price data returned")
            
            # Get Adjusted Close prices
            if isinstance(price_data.columns, pd.MultiIndex):
                adj_close = price_data['Adj Close'] if 'Adj Close' in price_data.columns else price_data['Close']
            else:
                # Single ticker case
                adj_close = pd.DataFrame({tickers[0]: price_data['Adj Close'] if 'Adj Close' in price_data.columns else price_data['Close']})
            
            # Forward fill missing values
            adj_close = adj_close.ffill()
            
        except Exception as e:
            print(f"Error fetching historical prices: {e}")
            import traceback
            traceback.print_exc()
            # Fallback: use current prices
            adj_close = pd.DataFrame({ticker: [current_prices.get(ticker, entry_prices.get(ticker, 1.0))] for ticker in tickers})
        
        # Compute period returns
        def compute_period_return(prices, days):
            if len(prices) < days:
                return None
            start_price = prices.iloc[-days] if len(prices) >= days else prices.iloc[0]
            end_price = prices.iloc[-1]
            if pd.isna(start_price) or pd.isna(end_price) or start_price == 0:
                return None
            return (end_price / start_price) - 1
        
        results = {}
        historical_returns = {}
        
        for label, days in periods.items():
            ticker_returns = {}
            
            for i, ticker in enumerate(tickers):
                if ticker in adj_close.columns:
                    ticker_prices = adj_close[ticker].dropna()
                    r = compute_period_return(ticker_prices, days)
                    ticker_returns[ticker] = r if r is not None else 0.0
                else:
                    ticker_returns[ticker] = 0.0
            
            # Portfolio return = sum(weight * return)
            portfolio_return = sum(
                (weights_list[i] / 100.0) * ticker_returns.get(ticker, 0.0)
                for i, ticker in enumerate(tickers)
            )
            
            results[label] = {
                "ticker_returns": ticker_returns,
                "portfolio_return": portfolio_return
            }
            
            historical_returns[f'returns_{label.lower()}'] = portfolio_return * 100
        
        # Compute contribution by asset (using 12M returns)
        contribution = []
        if "12M" in results:
            ticker_returns_12m = results["12M"]["ticker_returns"]
            for i, ticker in enumerate(tickers):
                weight = weights_list[i] / 100.0
                ticker_return = ticker_returns_12m.get(ticker, 0.0)
                contribution_pct = weight * ticker_return * 100
                
                contribution.append({
                    'ticker': ticker,
                    'weight': weights_list[i],
                    'return': ticker_return * 100,
                    'contribution': contribution_pct
                })
        
        # Sort by absolute contribution
        contribution.sort(key=lambda x: abs(x['contribution']), reverse=True)
        
        # Compute simple expected metrics (using 12M return as proxy)
        portfolio_return_12m = results.get("12M", {}).get("portfolio_return", 0.0)
        expected_return = portfolio_return_12m * 100  # Convert to percentage
        
        # Simple volatility estimate (using 1M and 12M returns)
        returns_1m = results.get("1M", {}).get("portfolio_return", 0.0)
        returns_12m = results.get("12M", {}).get("portfolio_return", 0.0)
        
        # Annualized volatility estimate
        if returns_12m != 0:
            # Rough estimate: assume volatility scales with return
            expected_volatility = abs(returns_12m) * 0.3 * 100  # Rough estimate
        else:
            expected_volatility = 0.0
        
        # Simple Sharpe ratio estimate
        risk_free_rate = 0.05  # 5% annual
        if expected_volatility > 0:
            expected_sharpe = (expected_return - risk_free_rate) / expected_volatility * 100
        else:
            expected_sharpe = 0.0
        
        # Calculate max drawdown from portfolio performance series
        max_drawdown = 0.0
        try:
            if len(portfolio_performance) > 1:
                # Convert to cumulative returns
                cumulative_returns = pd.Series([p['value'] for p in portfolio_performance])
                
                # Calculate running max
                running_max = cumulative_returns.cummax()
                
                # Calculate drawdown
                drawdown = (cumulative_returns - running_max) / running_max
                
                # Get maximum drawdown
                max_drawdown = abs(drawdown.min()) * 100 if len(drawdown) > 0 else 0.0
        except Exception as e:
            print(f"Error calculating max drawdown: {e}")
            # Fallback: use worst period return
            period_returns = [results[p].get("portfolio_return", 0.0) for p in periods.keys()]
            max_drawdown = abs(min(period_returns)) * 100 if period_returns else 0.0
        
        # Calculate volatility, sharpe, and drawdown for each period
        period_metrics = {}
        
        # Compute drawdown from portfolio performance time series
        def compute_max_drawdown_from_series(cumulative_returns_series):
            """Calculate max drawdown from a series of cumulative returns (already in percentage)"""
            if len(cumulative_returns_series) < 2:
                return 0.0
            
            try:
                # Convert percentage returns to portfolio values (starting from 100)
                portfolio_values = pd.Series([100.0] * len(cumulative_returns_series))
                for i in range(len(cumulative_returns_series)):
                    # cumulative_returns_series[i] is already a percentage return from start
                    portfolio_values.iloc[i] = 100.0 * (1 + cumulative_returns_series.iloc[i] / 100.0)
                
                # Calculate running max
                running_max = portfolio_values.cummax()
                
                # Calculate drawdown at each point: (current - peak) / peak
                drawdown = (portfolio_values - running_max) / running_max
                
                # Return maximum drawdown as positive percentage
                max_dd = abs(drawdown.min()) * 100 if len(drawdown) > 0 else 0.0
                return max_dd
            except Exception as e:
                print(f"Error in compute_max_drawdown_from_series: {e}")
                import traceback
                traceback.print_exc()
                return 0.0
        
        for label in periods.keys():
            period_return = results[label].get("portfolio_return", 0.0)
            days = periods[label]
            
            # Calculate volatility from daily returns in the period
            period_volatility = 0.0
            period_sharpe = 0.0
            period_drawdown = 0.0
            
            try:
                # Get daily returns for this period from portfolio performance
                if len(portfolio_performance) >= days:
                    period_data = portfolio_performance[-days:]
                    if len(period_data) > 1:
                        # Calculate daily returns
                        daily_returns = []
                        for i in range(1, len(period_data)):
                            prev_value = period_data[i-1]['value']
                            curr_value = period_data[i]['value']
                            if prev_value != 0:
                                daily_return = (curr_value - prev_value) / abs(prev_value) * 100
                                daily_returns.append(daily_return)
                        
                        if len(daily_returns) > 0:
                            returns_series = pd.Series(daily_returns)
                            # Annualized volatility
                            period_volatility = returns_series.std() * np.sqrt(252) if len(returns_series) > 1 else 0.0
                            
                            # Sharpe ratio
                            if period_volatility > 0:
                                mean_return = returns_series.mean() * 252  # Annualized
                                period_sharpe = (mean_return - risk_free_rate) / period_volatility
                            
                            # Max drawdown from cumulative returns
                            cumulative_returns_series = pd.Series([p['value'] for p in period_data])
                            period_drawdown = compute_max_drawdown_from_series(cumulative_returns_series)
            except Exception as e:
                print(f"Error calculating period metrics for {label}: {e}")
                # Fallback to simple estimates
                period_volatility = abs(period_return) * 0.3 * 100 if period_return != 0 else 0.0
                period_sharpe = (period_return * 100 - risk_free_rate) / period_volatility if period_volatility > 0 else 0.0
                period_drawdown = abs(min(period_return, 0)) * 100
            
            period_metrics[f'volatility_{label.lower()}'] = period_volatility
            period_metrics[f'sharpe_{label.lower()}'] = period_sharpe
            period_metrics[f'drawdown_{label.lower()}'] = period_drawdown
        
        # Generate portfolio performance time series (cumulative returns over time)
        portfolio_performance = []
        try:
            # Use 12M data for performance chart
            if "12M" in results and len(adj_close) > 0:
                # Calculate cumulative portfolio returns from start
                start_idx = max(0, len(adj_close) - 252)
                
                for i in range(start_idx, len(adj_close)):
                    date = adj_close.index[i]
                    daily_portfolio_return = 0.0
                    
                    for j, ticker in enumerate(tickers):
                        if ticker in adj_close.columns:
                            ticker_prices = adj_close[ticker].dropna()
                            if len(ticker_prices) > i - start_idx:
                                # Calculate return from start of period
                                start_price = ticker_prices.iloc[0]
                                current_price = ticker_prices.iloc[i - start_idx]
                                if start_price > 0 and not pd.isna(start_price) and not pd.isna(current_price):
                                    ticker_return = (current_price / start_price - 1) * 100
                                    daily_portfolio_return += (weights_list[j] / 100.0) * ticker_return
                    
                    # Format date
                    if hasattr(date, 'strftime'):
                        date_str = date.strftime('%Y-%m-%d')
                    elif hasattr(date, 'date'):
                        date_str = date.date().strftime('%Y-%m-%d')
                    else:
                        date_str = str(date)
                    
                    portfolio_performance.append({
                        'date': date_str,
                        'value': daily_portfolio_return
                    })
        except Exception as e:
            print(f"Error generating portfolio performance: {e}")
            import traceback
            traceback.print_exc()
        
        # Update contribution with invested and current weights
        for item in contribution:
            invested_weight = item['weight']
            current_weight = invested_weight * (1 + item['return'] / 100)
            item['invested_weight'] = invested_weight
            item['current_weight'] = current_weight
        
        return {
            "expected_return": expected_return,
            "expected_volatility": expected_volatility,
            "expected_sharpe": expected_sharpe,
            "max_drawdown": max_drawdown,
            **historical_returns,
            **period_metrics,
            "portfolio_performance": portfolio_performance[-252:] if portfolio_performance else [],  # Last 252 days
            "contribution": contribution
        }
    except Exception as e:
        print(f"Error getting portfolio preview: {e}")
        import traceback
        traceback.print_exc()
        return {
            "expected_return": 0.0,
            "expected_volatility": 0.0,
            "expected_sharpe": 0.0,
            "max_drawdown": 0.0,
            "returns_1m": 0.0,
            "returns_3m": 0.0,
            "returns_6m": 0.0,
            "returns_12m": 0.0,
            "contribution": []
        }


@app.get("/api/portfolio/contribution/{user_id}")
def get_portfolio_contribution(user_id: str):
    """Get contribution by asset"""
    try:
        from .portfolio import get_portfolio_balance, compute_paper_positions, compute_contribution_by_asset
        from .market import get_current_price
        
        balance = get_portfolio_balance(user_id)
        capital = float(balance.get('initial_balance', INITIAL_BALANCE))
        
        res = supabase.table("recommendations").select("*").eq("user_id", user_id).eq("status", "OPEN").execute()
        open_positions = res.data if res.data else []
        
        weights = {}
        entry_prices = {}
        current_prices = {}
        
        for pos in open_positions:
            ticker = pos['ticker']
            weights[ticker] = float(pos.get('weight_pct', 0) or 0)
            entry_prices[ticker] = float(pos.get('entry_price', 0) or 0)
            current_prices[ticker] = float(pos.get('current_price', 0) or entry_prices[ticker])
        
        positions = compute_paper_positions(weights, capital, entry_prices)
        
        returns_by_ticker = {}
        for ticker in weights.keys():
            entry = entry_prices.get(ticker, 0)
            current = current_prices.get(ticker, entry)
            if entry > 0:
                returns_by_ticker[ticker] = ((current / entry) - 1) * 100
        
        contribution = compute_contribution_by_asset(positions, returns_by_ticker)
        
        return {"contribution": contribution}
    except Exception as e:
        print(f"Error getting contribution: {e}")
        return {"contribution": []}
