# AlphaBoard WhatsApp Bot

WhatsApp bot service for AlphaBoard stock analysis platform. Enables users to manage watchlists, add recommendations, receive market reports, and request AI-generated podcasts via WhatsApp.

## Features

- **Stock Tracking**: Add stocks to watchlist via WhatsApp
- **Recommendations**: Log stock recommendations with price targets and thesis
- **Market Reports**: Get daily market close summaries
- **News**: Fetch latest news for any stock
- **Podcasts**: Request AI-generated audio summaries
- **Interactive Menus**: User-friendly WhatsApp button/list menus

## Commands

| Command | Description |
|---------|-------------|
| `help` / `menu` | Show main menu |
| `add TCS` | Add to watchlist |
| `add INFY - long term` | Add with note |
| `my watchlist` | View watchlist |
| `rec TCS @ 3500 thesis` | Log recommendation |
| `my recs` | View recommendations |
| `market close` | Today's summary |
| `news TCS` | Get stock news |
| `podcast TCS` | Generate audio summary |
| `TCS` | Quick stock info |

## Setup

### 1. Meta WhatsApp Business Setup

1. Create a Meta Business account at [business.facebook.com](https://business.facebook.com)
2. Create an app in [Meta Developer Portal](https://developers.facebook.com/)
3. Add WhatsApp product to your app
4. Get your Phone Number ID and Access Token
5. Set up webhook URL: `https://your-domain.com/webhook`

### 2. Environment Variables

Copy `env.example` to `.env` and fill in:

```bash
# Meta WhatsApp Cloud API
META_WHATSAPP_ACCESS_TOKEN=your_access_token
META_WHATSAPP_API_VERSION=v22.0
META_WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
META_WHATSAPP_VERIFY_TOKEN=your_webhook_verify_token

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# AlphaBoard Backend
ALPHABOARD_API_BASE_URL=https://your-backend.onrender.com

# Admin
ADMIN_API_KEY=your_admin_secret
```

### 3. Database Migration

Run the migration to create WhatsApp tables in Supabase:

```sql
-- See /database/migration_add_whatsapp_tables.sql
```

### 4. Create WhatsApp Template

Create a message template named `daily_market_close` in Meta Business Suite for proactive daily market reports.

### 5. Local Development

```bash
# Install dependencies
pip install -r requirements.txt

# Run server
uvicorn src.main:app --reload --port 8001

# Run tests
pytest tests/ -v
```

### 6. Deploy to Render

The `render.yaml` in the project root includes the WhatsApp bot configuration. Deploy via Render Dashboard or CLI.

## API Endpoints

### Webhook
- `GET /webhook` - WhatsApp verification
- `POST /webhook` - Incoming messages

### Admin (Protected)
- `GET /admin/health` - Service health check
- `GET /admin/recommendations/daily` - View daily recommendations
- `POST /admin/run-daily-close` - Trigger daily report broadcast
- `GET /admin/users` - List WhatsApp users
- `POST /admin/broadcast` - Send custom broadcast

### Health
- `GET /` - Basic health check
- `GET /health` - Load balancer health check

## Project Structure

```
whatsapp-bot/
├── src/
│   ├── main.py              # FastAPI entrypoint
│   ├── config.py            # Settings management
│   ├── webhook.py           # Webhook routes
│   ├── engine.py            # Message routing
│   ├── whatsapp_client.py   # WhatsApp API client
│   ├── alphaboard_client.py # AlphaBoard/Supabase client
│   ├── admin.py             # Admin routes
│   ├── schemas.py           # Pydantic models
│   ├── services/
│   │   ├── market_reports.py
│   │   └── templates.py
│   └── tasks/
│       └── daily_close_job.py
├── tests/
├── requirements.txt
└── README.md
```

## Daily Market Close

The bot can send daily market close summaries to subscribed users. This can be triggered:

1. **Via Admin Endpoint**: `POST /admin/run-daily-close`
2. **Via Cron Job**: Set up a scheduled job (e.g., Render cron) to call the admin endpoint at market close (4:30 PM IST)

Example cron setup:
```bash
# Call at 4:30 PM IST (11:00 UTC) on weekdays
0 11 * * 1-5 curl -X POST https://your-bot.onrender.com/admin/run-daily-close -H "X-Admin-Key: your_key"
```

## License

Private - AlphaBoard

