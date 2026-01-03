"""
Fast AI explanation for financial statements using lightweight models
"""
import os
from typing import Dict, Any, List
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def explain_financials(ticker: str, income_data: List[Dict[str, Any]]) -> Dict[str, str]:
    """
    Generate a concise AI explanation of income statement trends.
    Uses GPT-3.5-turbo for fast, cost-effective explanations.
    """
    if not income_data or len(income_data) == 0:
        return {"explanation": "No financial data available to analyze."}
    
    try:
        # Prepare summary of key metrics
        latest = income_data[0] if income_data else {}
        previous = income_data[1] if len(income_data) > 1 else {}
        
        revenue = latest.get("revenue", 0) or 0
        net_income = latest.get("netIncome", 0) or 0
        profit_margin = latest.get("netProfitMargin", 0) or 0
        ebitda = latest.get("ebitda", 0) or 0
        
        prev_revenue = previous.get("revenue", 0) or 0
        prev_net_income = previous.get("netIncome", 0) or 0
        
        revenue_growth = ((revenue - prev_revenue) / prev_revenue * 100) if prev_revenue > 0 else 0
        income_growth = ((net_income - prev_net_income) / prev_net_income * 100) if prev_net_income > 0 else 0
        
        prompt = f"""Analyze this income statement data for {ticker} and provide a concise 2-3 sentence explanation focusing on key trends:

Latest Period:
- Revenue: ${revenue/1e6:.2f}M
- Net Income: ${net_income/1e6:.2f}M  
- Profit Margin: {profit_margin:.2f}%
- EBITDA: ${ebitda/1e6:.2f}M

Previous Period:
- Revenue: ${prev_revenue/1e6:.2f}M
- Net Income: ${prev_net_income/1e6:.2f}M

Revenue Growth: {revenue_growth:.1f}%
Net Income Growth: {income_growth:.1f}%

Provide a brief, professional explanation highlighting:
1. Revenue trend (growing/declining)
2. Profitability (margin trends)
3. Overall financial health

Keep it under 100 words, professional tone."""

        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a financial analyst providing concise explanations of income statements."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=150,
            temperature=0.7
        )
        
        explanation = response.choices[0].message.content.strip()
        return {"explanation": explanation}
        
    except Exception as e:
        print(f"Error generating financial explanation: {e}")
        return {"explanation": "Unable to generate explanation at this time."}

