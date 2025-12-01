# AI-Assisted Investment Thesis - Setup Guide

## Overview
This feature adds AI-powered investment analysis to the leaderboard application using OpenAI GPT-4. It generates comprehensive investment theses including bull/bear/base cases, risks, and catalysts based on fundamental data.

## Features Implemented

### Backend
1. **OpenAI Integration** (`backend/app/market.py`)
   - Added OpenAI client initialization
   - Created `generate_investment_thesis()` function
   - Implements 30-minute caching for thesis results
   - Fetches comprehensive fundamental data (financials, quarterly, cash flow, balance sheet)
   - Calculates 1-year price performance
   - Constructs detailed GPT-4 prompt
   - Returns structured JSON with all analysis components

2. **API Endpoint** (`backend/app/main.py`)
   - New endpoint: `GET /market/thesis/{ticker}`
   - Returns: bull_case, bear_case, base_case, risks[], catalysts[]
   - Includes proper error handling

3. **Dependencies** (`backend/requirements.txt`)
   - Added `openai==1.57.4`
   - All other dependencies listed

### Frontend
1. **AIInvestmentThesis Component** (`frontend/src/components/AIInvestmentThesis.tsx`)
   - Beautiful card-based UI with color-coded sections
   - Data summary cards (price, P/E, market cap, 1Y return)
   - Bull Case (green accent with TrendingUp icon)
   - Bear Case (red accent with TrendingDown icon)
   - Base Case (blue accent with Scale icon)
   - Key Risks (numbered list with warning icons)
   - Potential Catalysts (numbered list with lightning icons)
   - Loading states and error handling
   - PDF export functionality

2. **StockDetail Integration** (`frontend/src/components/StockDetail.tsx`)
   - Added "AI Analysis" tab with Sparkles icon
   - Integrated AIInvestmentThesis component
   - Passes ticker and company name as props

3. **API Client** (`frontend/src/lib/api.ts`)
   - Added `generateThesis(ticker: string)` function

4. **Dependencies** (`frontend/package.json`)
   - Added `jspdf@2.5.2` for PDF export

## Setup Instructions

### 1. Backend Setup

#### Install Dependencies
```bash
cd backend
pip install -r requirements.txt
```

#### Configure Environment Variables
Create a `.env` file in the `backend` directory:
```env
# OpenAI API Key (REQUIRED for AI thesis feature)
OPENAI_API_KEY=your_openai_api_key_here

# Finnhub API Key (optional - for stock search)
FINNHUB_API_KEY=your_finnhub_api_key_here

# Supabase Configuration (if using)
SUPABASE_URL=your_supabase_url_here
SUPABASE_KEY=your_supabase_anon_key_here
```

#### Get OpenAI API Key
1. Go to https://platform.openai.com/
2. Sign up or log in
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key to your `.env` file

#### Start Backend Server
```bash
cd backend
uvicorn app.main:app --reload
```

The backend will run on http://127.0.0.1:8000

### 2. Frontend Setup

#### Install Dependencies
```bash
cd frontend
npm install
```

#### Start Frontend Development Server
```bash
npm run dev
```

The frontend will run on http://localhost:5173 (or similar)

## Usage

### Generating an Investment Thesis

1. **Navigate to Stock Details**
   - Open any stock from your recommendations list
   - The stock detail panel will open

2. **Access AI Analysis**
   - Click on the "AI Analysis" tab (with sparkle icon)
   - You'll see a welcome screen

3. **Generate Thesis**
   - Click the "Generate Thesis" button
   - Wait 10-15 seconds for AI analysis
   - The system will:
     - Fetch all fundamental data
     - Analyze 1-year price trends
     - Send data to GPT-4
     - Parse and display results

4. **View Results**
   - **Bull Case**: Optimistic analysis with positive drivers
   - **Bear Case**: Pessimistic analysis with concerns
   - **Base Case**: Balanced, most likely scenario
   - **Key Risks**: 4-5 major investment risks
   - **Potential Catalysts**: 4-5 positive triggers

5. **Regenerate**
   - Click "Regenerate Thesis" to get fresh analysis
   - Cache expires after 30 minutes automatically

6. **Export to PDF**
   - Click "Export PDF" button
   - Downloads formatted PDF report
   - Filename: `{TICKER}_Investment_Thesis_{DATE}.pdf`

## API Endpoint Details

### Generate Thesis
- **Endpoint**: `GET /market/thesis/{ticker}`
- **Example**: `GET http://127.0.0.1:8000/market/thesis/RELIANCE.NS`
- **Response**:
```json
{
  "ticker": "RELIANCE.NS",
  "generated_at": "2025-11-27 10:30:00",
  "bull_case": "Strong growth in retail and digital...",
  "bear_case": "High debt levels and regulatory concerns...",
  "base_case": "Stable performance with moderate growth...",
  "risks": [
    "Regulatory changes in telecom sector",
    "Oil price volatility impact",
    "Competition from new entrants",
    "Debt servicing burden",
    "Economic slowdown risk"
  ],
  "catalysts": [
    "5G rollout expansion",
    "Retail business scaling",
    "Green energy investments",
    "Digital services monetization",
    "Strategic partnerships"
  ],
  "data_summary": {
    "current_price": 2450.50,
    "market_cap": 16500000000000,
    "pe_ratio": 28.5,
    "price_change_1y_pct": 15.2
  }
}
```

## GPT Prompt Strategy

The system sends a comprehensive prompt to GPT-4 including:

### Input Data
- Ticker symbol and current price
- Key metrics: P/E, P/B, ROE, ROCE, Debt/Equity
- 5-year financial trends (revenue, profit, cash flow)
- Recent quarterly performance
- Balance sheet data
- 1-year price performance

### Output Format
Structured JSON with:
- `bull_case`: 2-3 sentence bullish argument
- `bear_case`: 2-3 sentence bearish argument
- `base_case`: 2-3 sentence balanced scenario
- `risks`: Array of 4-5 key investment risks
- `catalysts`: Array of 4-5 potential positive catalysts

### Model Used
- GPT-4o (latest GPT-4 model)
- Temperature: 0.7 (balanced creativity)
- Max tokens: 1500
- Response format: JSON object

## Cost Considerations

- **GPT-4 API calls**: ~$0.01-0.03 per thesis generation
- **Caching**: 30-minute cache reduces API calls
- **Rate limiting**: Consider implementing if many users

## Troubleshooting

### "OpenAI API key not configured" Error
- Check `.env` file exists in backend directory
- Verify `OPENAI_API_KEY` is set correctly
- Restart backend server after adding key

### Thesis Generation Fails
- Check backend logs for errors
- Verify OpenAI API key is valid and has credits
- Ensure stock ticker is valid (use search first)

### PDF Export Not Working
- Verify `jspdf` is installed: `npm list jspdf`
- Check browser console for errors
- Try different browser if issues persist

### Slow Generation
- Normal: 10-15 seconds for GPT-4 response
- Check internet connection
- OpenAI API may have delays during high traffic

## Development Notes

### File Structure
```
backend/
├── app/
│   ├── market.py          # OpenAI integration & thesis generation
│   ├── main.py            # API endpoints
│   └── models.py          # Data models
├── requirements.txt       # Python dependencies
└── .env                   # Environment variables (create this)

frontend/
├── src/
│   ├── components/
│   │   ├── AIInvestmentThesis.tsx   # Main thesis component
│   │   └── StockDetail.tsx          # Integration point
│   └── lib/
│       └── api.ts                    # API client functions
└── package.json                      # Node dependencies
```

### Extending the Feature

#### Add More Analysis Types
Edit `backend/app/market.py` and modify the GPT prompt to include:
- Technical analysis
- Sentiment analysis (if data available)
- Peer comparison
- Valuation models

#### Customize PDF Format
Edit `AIInvestmentThesis.tsx`, function `exportToPDF()`:
- Change colors, fonts, layout
- Add charts or graphs
- Include company logo

#### Add Notion Export
1. Install Notion SDK: `npm install @notionhq/client`
2. Get Notion API key
3. Add export function to `AIInvestmentThesis.tsx`
4. Format thesis as Notion blocks

## Support

For issues or questions:
1. Check backend logs: `uvicorn app.main:app --reload`
2. Check browser console for frontend errors
3. Verify all dependencies are installed
4. Ensure API keys are valid

## License

Part of the Leaderboard application.

