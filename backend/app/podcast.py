"""
FinPod AI - Financial Podcast Generator
Generates podcast scripts and TTS audio for stock news summaries.
"""

import os
import json
import base64
from typing import Dict, List, Any, Optional
from openai import OpenAI
from dotenv import load_dotenv
from .news import get_company_name_from_ticker

load_dotenv()

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# FinPod AI System Prompt
FINPOD_SYSTEM_PROMPT = """You are "FinPod AI", a financial-expert podcast generator for a stock-analysis dashboard.

Your job:

1. When the developer calls you with {stockDetails}, generate a short **30–45 second podcast script** summarizing the latest news for that specific stock.

2. When the developer calls you with {portfolioNews}, generate a **60–90 second portfolio-wide weekly news recap**.

--------------------------------------------------------------------

## 🎙 ROLE & TONE

Act as:

- A senior financial analyst

- A skilled storyteller who makes markets understandable

- A podcast host with concise, engaging delivery

Tone:

- Clear, confident, educational

- 0% hype, 0% financial advice

- Short sentences designed for spoken audio

--------------------------------------------------------------------

## 🎯 OUTPUT FORMAT

### For single-stock (30–45 sec):

{
  "podcastTitle": "Quick Take: {ticker}",
  "duration": "30-45 seconds",
  "script": "<podcast script>",
  "keyPoints": ["...", "..."]
}

### For portfolio (60–90 sec):

{
  "podcastTitle": "Your Weekly Portfolio Roundup",
  "duration": "60-90 seconds",
  "script": "<podcast script>",
  "highlights": [
    { "ticker": "...", "summary": "..." }
  ]
}

--------------------------------------------------------------------

## 🎙 HOW TO STRUCTURE THE PODCAST

### **Single Stock Script Template (30–45 sec)**

1. Start with a quick hook: "Here's your {ticker} update."  

2. Summarize *only the most impactful* news in the past week.

3. Explain what each news item *means* in simple terms.

4. End with a clean sign-off — no predictions or advice.

### **Portfolio Script Template (60–90 sec)**

1. Start with: "Here's what moved your portfolio this week."  

2. For each stock with major news:

   - Ticker + 1–2 line summary

   - Sentiment shift or key impact

3. End with a wrap-up that ties the themes together.

--------------------------------------------------------------------

## 🧪 VALIDATION RULES

Always ensure:

- No financial advice

- No numbers invented beyond the provided input

- No predictions or guarantees

- Scripts should sound natural when read aloud

Return ONLY the JSON object described above. No extra explanations."""


def generate_podcast_script(
    request_type: str,
    ticker: Optional[str] = None,
    company_name: Optional[str] = None,
    news: Optional[List[Dict[str, Any]]] = None,
    week_start: Optional[str] = None,
    week_end: Optional[str] = None,
    portfolio_news: Optional[Dict[str, List[Dict[str, Any]]]] = None
) -> Dict[str, Any]:
    """
    Generate podcast script using GPT-4o-mini following FinPod AI specifications.
    
    Args:
        request_type: "single-stock" or "portfolio"
        ticker: Stock ticker (required for single-stock)
        company_name: Company name (required for single-stock)
        news: List of news articles (required for single-stock)
        week_start: Start date for portfolio (required for portfolio)
        week_end: End date for portfolio (required for portfolio)
        portfolio_news: Dict mapping tickers to news lists (required for portfolio)
    
    Returns:
        Dict with podcastTitle, duration, script, keyPoints/highlights
    """
    try:
        if request_type == "single-stock":
            if not ticker or not company_name or not news:
                raise ValueError("Missing required fields for single-stock podcast")
            
            # Format news for prompt
            news_summary = []
            for article in news[:10]:  # Limit to top 10 most recent
                news_item = {
                    "headline": article.get("headline", ""),
                    "summary": article.get("summary_tldr", ""),
                    "date": article.get("published_at", ""),
                    "sentiment": article.get("sentiment", "Neutral")
                }
                news_summary.append(news_item)
            
            user_prompt = f"""Generate a podcast script for a single stock.

{{
  "type": "single-stock",
  "ticker": "{ticker}",
  "companyName": "{company_name}",
  "news": {json.dumps(news_summary, indent=2)}
}}"""

        elif request_type == "portfolio":
            if not week_start or not week_end or not portfolio_news:
                raise ValueError("Missing required fields for portfolio podcast")
            
            # Format portfolio news
            formatted_portfolio_news = {}
            for ticker_key, news_list in portfolio_news.items():
                formatted_portfolio_news[ticker_key] = []
                for article in news_list[:5]:  # Limit to top 5 per stock
                    formatted_portfolio_news[ticker_key].append({
                        "headline": article.get("headline", ""),
                        "summary": article.get("summary_tldr", ""),
                        "date": article.get("published_at", ""),
                        "sentiment": article.get("sentiment", "Neutral")
                    })
            
            user_prompt = f"""Generate a portfolio-wide weekly news recap podcast.

{{
  "type": "portfolio",
  "weekStart": "{week_start}",
  "weekEnd": "{week_end}",
  "portfolioNews": {json.dumps(formatted_portfolio_news, indent=2)}
}}"""

        else:
            raise ValueError(f"Invalid request_type: {request_type}")

        # Call GPT-4o-mini
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": FINPOD_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.7,
            max_tokens=1000,
            response_format={"type": "json_object"}
        )
        
        result_text = response.choices[0].message.content.strip()
        
        # Parse JSON response
        try:
            result = json.loads(result_text)
            return result
        except json.JSONDecodeError:
            # Fallback if JSON parsing fails
            fallback_result = {
                "podcastTitle": f"Quick Take: {ticker}" if request_type == "single-stock" else "Your Weekly Portfolio Roundup",
                "duration": "30-45 seconds" if request_type == "single-stock" else "60-90 seconds",
                "script": result_text,
            }
            if request_type == "single-stock":
                fallback_result["keyPoints"] = []
            else:
                fallback_result["highlights"] = []
            return fallback_result
            
    except Exception as e:
        print(f"Error generating podcast script: {e}")
        raise


def generate_tts_audio(script: str, model: str = "tts-1") -> bytes:
    """
    Generate TTS audio from script using OpenAI TTS API.
    
    Args:
        script: The podcast script text
        model: TTS model to use ("tts-1" or "tts-1-hd")
    
    Returns:
        Audio bytes (MP3 format)
    """
    try:
        response = client.audio.speech.create(
            model=model,
            voice="alloy",  # Options: alloy, echo, fable, onyx, nova, shimmer
            input=script
        )
        
        # Read audio bytes
        audio_bytes = b""
        for chunk in response.iter_bytes():
            audio_bytes += chunk
        
        return audio_bytes
        
    except Exception as e:
        print(f"Error generating TTS audio: {e}")
        raise


def get_company_name(ticker: str) -> str:
    """
    Helper function to get company name from ticker.
    Reuses function from news.py
    """
    return get_company_name_from_ticker(ticker)

