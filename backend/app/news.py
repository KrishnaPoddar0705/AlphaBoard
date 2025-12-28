"""
News aggregation and summarization service for stock tickers.
Fetches news from multiple sources and uses GPT for analysis.
"""

import os
import json
import feedparser
import requests
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any
from bs4 import BeautifulSoup
from openai import OpenAI
from dotenv import load_dotenv
from urllib.parse import quote_plus
import ssl
import yfinance as yf
from .db import supabase

# Disable SSL verification for feedparser (Yahoo Finance RSS feeds sometimes have SSL issues)
if hasattr(ssl, '_create_unverified_context'):
    ssl._create_default_https_context = ssl._create_unverified_context

# Load environment variables
load_dotenv()

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# API Keys
NEWSAPI_KEY = os.getenv("NEWSAPI_KEY", "")


def get_company_name_from_ticker(ticker: str) -> str:
    """
    Get company name from ticker symbol using yfinance.
    Falls back to cleaned ticker if name cannot be fetched.
    
    Args:
        ticker: Stock ticker symbol (e.g., "LENSKART.NS")
    
    Returns:
        Company name or cleaned ticker
    """
    try:
        stock = yf.Ticker(ticker)
        info = stock.info
        company_name = info.get('longName') or info.get('shortName') or info.get('name')
        
        if company_name:
            print(f"Found company name for {ticker}: {company_name}")
            return company_name
        
        # Fallback: clean ticker
        clean_ticker = ticker.replace('.NS', '').replace('.BO', '').replace('.', '')
        print(f"Using cleaned ticker for {ticker}: {clean_ticker}")
        return clean_ticker
        
    except Exception as e:
        print(f"Error getting company name for {ticker}: {e}")
        # Fallback: clean ticker
        clean_ticker = ticker.replace('.NS', '').replace('.BO', '').replace('.', '')
        return clean_ticker


def fetch_newsapi(ticker: str, company_name: str = None, limit: int = 10) -> List[Dict[str, Any]]:
    """
    Fetch news from NewsAPI.org
    Searches by company name for better results, especially for Indian stocks.
    """
    if not NEWSAPI_KEY:
        print("NewsAPI key not configured, skipping NewsAPI")
        return []
    
    try:
        # Use company name if available, otherwise use cleaned ticker
        search_query = company_name if company_name else ticker.replace('.NS', '').replace('.BO', '')
        
        # For Indian stocks, add "India" to search query
        if '.NS' in ticker or '.BO' in ticker:
            search_query = f"{search_query} India stock"
        
        print(f"NewsAPI searching for: {search_query}")
        
        url = f"https://newsapi.org/v2/everything"
        params = {
            'q': search_query,
            'sortBy': 'publishedAt',
            'language': 'en',
            'pageSize': limit,
            'apiKey': NEWSAPI_KEY
        }
        
        print(f"NewsAPI URL: {url} with params: {params}")
        
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        articles = []
        for article in data.get('articles', []):
            articles.append({
                'headline': article.get('title', ''),
                'source': article.get('source', {}).get('name', 'NewsAPI'),
                'source_url': article.get('url', ''),
                'published_at': article.get('publishedAt', ''),
                'full_content': article.get('description', '') or article.get('content', '')
            })
        
        print(f"NewsAPI returned {len(articles)} articles")
        return articles
    except Exception as e:
        print(f"Error fetching from NewsAPI: {e}")
        import traceback
        traceback.print_exc()
        return []


def fetch_yahoo_finance_news(ticker: str, limit: int = 10) -> List[Dict[str, Any]]:
    """
    Fetch news from Yahoo Finance RSS/API
    For Indian stocks (.NS, .BO), use the full ticker format.
    For US stocks, use the ticker as-is.
    Uses requests to fetch RSS feed to avoid SSL certificate issues.
    """
    try:
        # Determine if it's an Indian or US stock
        is_indian = '.NS' in ticker or '.BO' in ticker
        yahoo_ticker = ticker  # Use ticker as-is for both markets
        
        # Try the appropriate region first, then fallback
        if is_indian:
            urls = [
                f"https://feeds.finance.yahoo.com/rss/2.0/headline?s={yahoo_ticker}&region=IN&lang=en-IN",  # India region (primary)
                f"https://feeds.finance.yahoo.com/rss/2.0/headline?s={yahoo_ticker}&region=US&lang=en-US",  # US region fallback
            ]
        else:
            # US stock - try US region first
            urls = [
                f"https://feeds.finance.yahoo.com/rss/2.0/headline?s={yahoo_ticker}&region=US&lang=en-US",  # US region (primary)
                f"https://feeds.finance.yahoo.com/rss/2.0/headline?s={yahoo_ticker}&region=IN&lang=en-IN",  # India region fallback
            ]
        
        articles = []
        for url in urls:
            print(f"Fetching Yahoo Finance news for {ticker} from: {url}")
            try:
                # Use requests with SSL verification disabled to avoid certificate issues
                response = requests.get(url, timeout=10, verify=False)
                response.raise_for_status()
                
                # Parse the RSS feed content
                feed = feedparser.parse(response.content)
                
                for entry in feed.entries[:limit]:
                    # Avoid duplicates
                    headline = entry.get('title', '')
                    if headline and not any(a['headline'] == headline for a in articles):
                        articles.append({
                            'headline': headline,
                            'source': 'Yahoo Finance',
                            'source_url': entry.get('link', ''),
                            'published_at': entry.get('published', ''),
                            'full_content': entry.get('summary', '')
                        })
                
                if articles:
                    print(f"Successfully fetched {len(articles)} articles from {url}")
                    break  # If we got articles, don't try the fallback URL
            except Exception as url_error:
                print(f"Error with URL {url}: {url_error}")
                import traceback
                traceback.print_exc()
                continue
        
        print(f"Yahoo Finance returned {len(articles)} articles")
        return articles[:limit]
    except Exception as e:
        print(f"Error fetching from Yahoo Finance: {e}")
        import traceback
        traceback.print_exc()
        return []


def fetch_google_news_rss(ticker: str, company_name: str = None, limit: int = 10) -> List[Dict[str, Any]]:
    """
    Fetch news from Google News RSS feeds
    Uses company name for better search results, especially for Indian stocks.
    """
    try:
        # Use company name if available, otherwise use cleaned ticker
        if company_name:
            search_query = f"{company_name} stock India"
        else:
            clean_ticker = ticker.replace('.NS', '').replace('.BO', '').replace('.', '')
            search_query = f"{clean_ticker} stock India"
        
        # URL encode the search query
        encoded_query = quote_plus(search_query)
        
        # Google News RSS feed - search for company name + stock + India
        # Use India region for better results
        url = f"https://news.google.com/rss/search?q={encoded_query}&hl=en-IN&gl=IN&ceid=IN:en"
        
        print(f"Fetching Google News for {ticker} with query: {search_query}")
        feed = feedparser.parse(url)
        
        articles = []
        for entry in feed.entries[:limit]:
            # Extract actual source from title (Google News format: "Title - Source")
            title = entry.get('title', '')
            source = 'Google News'
            if ' - ' in title:
                parts = title.rsplit(' - ', 1)
                title = parts[0]
                source = parts[1] if len(parts) > 1 else source
            
            articles.append({
                'headline': title,
                'source': source,
                'source_url': entry.get('link', ''),
                'published_at': entry.get('published', ''),
                'full_content': entry.get('summary', '')
            })
        
        print(f"Google News returned {len(articles)} articles")
        return articles
    except Exception as e:
        print(f"Error fetching from Google News: {e}")
        import traceback
        traceback.print_exc()
        return []


def deduplicate_articles(articles: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Remove duplicate articles based on headline similarity
    """
    unique_articles = []
    seen_headlines = set()
    
    for article in articles:
        headline = article.get('headline', '').lower().strip()
        # Simple deduplication - can be enhanced with fuzzy matching
        if headline and headline not in seen_headlines:
            seen_headlines.add(headline)
            unique_articles.append(article)
    
    return unique_articles


def aggregate_news(ticker: str, limit: int = 25) -> List[Dict[str, Any]]:
    """
    Aggregate news from all sources and deduplicate
    
    Args:
        ticker: Stock ticker symbol
        limit: Maximum number of articles to return (default 25)
    
    Returns:
        List of unique news articles
    """
    all_articles = []
    
    print(f"Fetching news for {ticker} from multiple sources...")
    
    # Get company name from ticker for better search results
    company_name = get_company_name_from_ticker(ticker)
    print(f"Using company name: {company_name} for ticker: {ticker}")
    
    # Fetch from all sources (increased limits to get more articles)
    newsapi_articles = fetch_newsapi(ticker, company_name=company_name, limit=15)
    yahoo_articles = fetch_yahoo_finance_news(ticker, limit=15)
    google_articles = fetch_google_news_rss(ticker, company_name=company_name, limit=15)
    
    print(f"NewsAPI: {len(newsapi_articles)}, Yahoo: {len(yahoo_articles)}, Google: {len(google_articles)}")
    
    all_articles.extend(newsapi_articles)
    all_articles.extend(yahoo_articles)
    all_articles.extend(google_articles)
    
    print(f"Total articles before deduplication: {len(all_articles)}")
    
    # Deduplicate
    unique_articles = deduplicate_articles(all_articles)
    
    print(f"Total articles after deduplication: {len(unique_articles)}")
    
    # Sort by published date (most recent first)
    def parse_date(article):
        try:
            date_str = article.get('published_at', '')
            if date_str:
                # Try different date formats
                for fmt in ['%a, %d %b %Y %H:%M:%S %Z', '%Y-%m-%dT%H:%M:%SZ', '%Y-%m-%dT%H:%M:%S%z', '%Y-%m-%d %H:%M:%S']:
                    try:
                        return datetime.strptime(date_str, fmt)
                    except ValueError:
                        continue
            return datetime.min
        except:
            return datetime.min
    
    unique_articles.sort(key=parse_date, reverse=True)
    
    return unique_articles[:limit]


def summarize_with_gpt(article_content: str, headline: str, mode: str = 'standard') -> Dict[str, Any]:
    """
    Use GPT to generate summary, sentiment, and impact score
    
    Args:
        article_content: Full article text
        headline: Article headline
        mode: 'standard' or 'eli5'
    
    Returns:
        Dict with summary_tldr, sentiment, impact_score
    """
    try:
        if mode == 'standard':
            prompt = f"""Analyze this financial news article and provide:

1. A 2-line TLDR summary (max 200 characters)
2. Sentiment: positive, neutral, or negative
3. Impact score: 0-10 (how much this could affect stock price)

Headline: {headline}
Content: {article_content[:2000]}

Return ONLY a JSON object with this exact format:
{{
  "summary_tldr": "your 2-line summary here",
  "sentiment": "positive|neutral|negative",
  "impact_score": 5
}}"""
        else:  # eli5 mode
            prompt = f"""Explain this financial news article like I'm 12 years old. Use simple words and short sentences.

Headline: {headline}
Content: {article_content[:2000]}

Provide a simple explanation (3-4 sentences) that a 12-year-old would understand."""

        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a financial news analyst providing concise, accurate summaries."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.5,
            max_tokens=300
        )
        
        result = response.choices[0].message.content.strip()
        
        if mode == 'standard':
            # Parse JSON response
            try:
                parsed = json.loads(result)
                return {
                    'summary_tldr': parsed.get('summary_tldr', ''),
                    'sentiment': parsed.get('sentiment', 'neutral'),
                    'impact_score': int(parsed.get('impact_score', 5))
                }
            except json.JSONDecodeError:
                # Fallback if JSON parsing fails
                return {
                    'summary_tldr': result[:200],
                    'sentiment': 'neutral',
                    'impact_score': 5
                }
        else:  # eli5
            return {'eli5_summary': result}
            
    except Exception as e:
        print(f"Error with GPT summarization: {e}")
        if mode == 'standard':
            return {
                'summary_tldr': headline[:200],
                'sentiment': 'neutral',
                'impact_score': 5
            }
        else:
            return {'eli5_summary': 'Unable to generate simplified summary.'}


def explain_like_im_12(article_content: str, headline: str) -> str:
    """
    Generate ELI5 (Explain Like I'm 5/12) summary using GPT
    """
    result = summarize_with_gpt(article_content, headline, mode='eli5')
    return result.get('eli5_summary', 'Unable to generate simplified summary.')


def cache_news_for_ticker(ticker: str) -> int:
    """
    Fetch news, summarize with GPT, and cache in database
    
    Returns:
        Number of articles cached
    """
    try:
        print(f"Starting to cache news for {ticker}...")
        
        # Fetch aggregated news (25 articles)
        articles = aggregate_news(ticker, limit=25)
        
        if not articles:
            print(f"No articles found for {ticker}")
            return 0
        
        print(f"Processing {len(articles)} articles for {ticker}...")
        
        cached_count = 0
        for idx, article in enumerate(articles, 1):
            # Skip if no headline or URL
            if not article.get('headline') or not article.get('source_url'):
                print(f"Skipping article {idx}: missing headline or URL")
                continue
            
            print(f"Processing article {idx}/{len(articles)}: {article.get('headline', '')[:50]}...")
            
            # Get GPT summary
            try:
                gpt_analysis = summarize_with_gpt(
                    article.get('full_content', '') or article.get('headline', ''),
                    article.get('headline', '')
                )
            except Exception as gpt_error:
                print(f"Error summarizing article {idx}: {gpt_error}")
                gpt_analysis = {
                    'summary_tldr': article.get('headline', '')[:200],
                    'sentiment': 'neutral',
                    'impact_score': 5
                }
            
            # Parse published date
            published_at = datetime.utcnow()
            try:
                date_str = article.get('published_at', '')
                if date_str:
                    for fmt in ['%a, %d %b %Y %H:%M:%S %Z', '%Y-%m-%dT%H:%M:%SZ', '%Y-%m-%dT%H:%M:%S%z', '%Y-%m-%d %H:%M:%S']:
                        try:
                            published_at = datetime.strptime(date_str, fmt)
                            break
                        except ValueError:
                            continue
            except Exception as date_error:
                print(f"Error parsing date for article {idx}: {date_error}")
            
            # Prepare news data
            news_data = {
                'ticker': ticker.upper(),
                'headline': article.get('headline', '')[:500],  # Limit headline length
                'source': article.get('source', 'Unknown')[:100],
                'source_url': article.get('source_url', '')[:1000],
                'published_at': published_at.isoformat(),
                'summary_tldr': gpt_analysis.get('summary_tldr', '')[:500],
                'sentiment': gpt_analysis.get('sentiment', 'neutral'),
                'impact_score': gpt_analysis.get('impact_score', 5),
                'full_content': (article.get('full_content', '') or article.get('headline', ''))[:5000],
                'fetched_at': datetime.utcnow().isoformat()
            }
            
            try:
                # Try to insert, skip if duplicate
                supabase.table("news_articles").insert(news_data).execute()
                cached_count += 1
                print(f"✓ Cached article {idx}/{len(articles)}")
            except Exception as insert_error:
                # Skip duplicates or other errors
                print(f"✗ Skipped article {idx} (duplicate or error): {str(insert_error)[:100]}")
                continue
        
        print(f"Successfully cached {cached_count} articles for {ticker}")
        return cached_count
        
    except Exception as e:
        print(f"Error caching news for {ticker}: {e}")
        import traceback
        traceback.print_exc()
        return 0


def get_cached_news(ticker: str, hours: int = 168) -> List[Dict[str, Any]]:
    """
    Retrieve cached news from database (within specified hours)
    
    Args:
        ticker: Stock ticker symbol
        hours: How many hours back to fetch (default 168 = 7 days)
    
    Returns:
        List of news articles with GPT summaries
    """
    try:
        cutoff_time = datetime.utcnow() - timedelta(hours=hours)
        
        result = supabase.table("news_articles")\
            .select("*")\
            .eq("ticker", ticker.upper())\
            .gte("fetched_at", cutoff_time.isoformat())\
            .order("published_at", desc=True)\
            .limit(25)\
            .execute()
        
        articles = result.data if result.data else []
        print(f"Found {len(articles)} cached articles for {ticker}")
        return articles
        
    except Exception as e:
        print(f"Error fetching cached news for {ticker}: {e}")
        import traceback
        traceback.print_exc()
        return []


def get_news_with_refresh(ticker: str, force_refresh: bool = False) -> List[Dict[str, Any]]:
    """
    Get news for ticker, check cache first, then fetch if cache miss
    
    Args:
        ticker: Stock ticker symbol
        force_refresh: Force refresh even if cache exists
    
    Returns:
        List of news articles with summaries
    """
    print(f"Getting news for {ticker}, force_refresh={force_refresh}")
    
    # Always check cache first
    cached = get_cached_news(ticker, hours=168)  # Check last 7 days
    
    # If cache miss (empty or less than 5 articles) or force refresh, fetch new news
    if force_refresh or len(cached) < 5:
        if force_refresh:
            print(f"Force refresh requested for {ticker}")
        else:
            print(f"Cache miss for {ticker} (found {len(cached)} articles, need at least 5)")
        
        # Fetch and cache new news
        articles_cached = cache_news_for_ticker(ticker)
        print(f"Cached {articles_cached} new articles for {ticker}")
        
        # Get updated cache
        cached = get_cached_news(ticker, hours=168)
        print(f"Retrieved {len(cached)} total articles from cache for {ticker}")
    else:
        print(f"Using cached news for {ticker} ({len(cached)} articles)")
    
    return cached

