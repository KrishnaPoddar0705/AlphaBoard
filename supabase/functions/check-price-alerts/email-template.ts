// HTML Email Template for Price Alerts

export interface AlertEmailData {
    ticker: string;
    companyName?: string;
    alertType: 'BUY' | 'SELL';
    triggerPrice: number;
    currentPrice: number;
    priceChange: number;
    priceChangePercent: number;
    appUrl?: string;
}

export function generateEmailHTML(data: AlertEmailData): string {
    const { ticker, companyName, alertType, triggerPrice, currentPrice, priceChange, priceChangePercent, appUrl } = data;
    
    const isBuy = alertType === 'BUY';
    const alertColor = isBuy ? '#10b981' : '#ef4444'; // emerald-500 : rose-500
    const alertBgColor = isBuy ? '#d1fae5' : '#fee2e2'; // emerald-100 : rose-100
    const priceColor = priceChange >= 0 ? '#10b981' : '#ef4444';
    const arrow = priceChange >= 0 ? '↑' : '↓';
    
    const appLink = appUrl || 'https://alphaboard.onrender.com';
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Price Alert: ${ticker}</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background-color: #0f172a;
            color: #e2e8f0;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #1e293b;
            border-radius: 8px;
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
            padding: 32px 24px;
            text-align: center;
            border-bottom: 2px solid ${alertColor};
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 700;
            color: #ffffff;
        }
        .content {
            padding: 32px 24px;
        }
        .alert-badge {
            display: inline-block;
            padding: 8px 16px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            background-color: ${alertBgColor};
            color: ${alertColor};
            margin-bottom: 24px;
        }
        .stock-info {
            background-color: #0f172a;
            border-radius: 8px;
            padding: 24px;
            margin-bottom: 24px;
            border: 1px solid #334155;
        }
        .ticker {
            font-size: 32px;
            font-weight: 700;
            color: #ffffff;
            margin: 0 0 8px 0;
            font-family: 'Courier New', monospace;
        }
        .company-name {
            font-size: 16px;
            color: #94a3b8;
            margin: 0 0 24px 0;
        }
        .price-comparison {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 0;
            border-top: 1px solid #334155;
            border-bottom: 1px solid #334155;
            margin: 16px 0;
        }
        .price-item {
            flex: 1;
        }
        .price-label {
            font-size: 12px;
            color: #94a3b8;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 8px;
        }
        .price-value {
            font-size: 24px;
            font-weight: 700;
            color: #ffffff;
            font-family: 'Courier New', monospace;
        }
        .current-price {
            text-align: right;
        }
        .current-price .price-value {
            color: ${priceColor};
        }
        .change-info {
            text-align: center;
            padding: 16px;
            background-color: #0f172a;
            border-radius: 6px;
            margin: 16px 0;
        }
        .change-value {
            font-size: 20px;
            font-weight: 700;
            color: ${priceColor};
            font-family: 'Courier New', monospace;
        }
        .change-label {
            font-size: 12px;
            color: #94a3b8;
            margin-top: 4px;
        }
        .cta-button {
            display: block;
            width: 100%;
            padding: 16px;
            background-color: #6366f1;
            color: #ffffff;
            text-align: center;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            font-size: 16px;
            margin-top: 24px;
            transition: background-color 0.2s;
        }
        .cta-button:hover {
            background-color: #4f46e5;
        }
        .footer {
            padding: 24px;
            text-align: center;
            border-top: 1px solid #334155;
            color: #64748b;
            font-size: 12px;
        }
        .footer a {
            color: #94a3b8;
            text-decoration: none;
        }
        @media only screen and (max-width: 600px) {
            .container {
                margin: 0;
                border-radius: 0;
            }
            .content {
                padding: 24px 16px;
            }
            .price-comparison {
                flex-direction: column;
                gap: 16px;
            }
            .current-price {
                text-align: left;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔔 Price Alert Triggered</h1>
        </div>
        <div class="content">
            <div class="alert-badge">${alertType} Alert</div>
            
            <div class="stock-info">
                <h2 class="ticker">${ticker}</h2>
                ${companyName ? `<p class="company-name">${companyName}</p>` : ''}
                
                <div class="price-comparison">
                    <div class="price-item">
                        <div class="price-label">Trigger Price</div>
                        <div class="price-value">₹${triggerPrice.toFixed(2)}</div>
                    </div>
                    <div class="price-item current-price">
                        <div class="price-label">Current Price</div>
                        <div class="price-value">₹${currentPrice.toFixed(2)}</div>
                    </div>
                </div>
                
                <div class="change-info">
                    <div class="change-value">${arrow} ₹${Math.abs(priceChange).toFixed(2)} (${priceChangePercent >= 0 ? '+' : ''}${priceChangePercent.toFixed(2)}%)</div>
                    <div class="change-label">Price ${isBuy ? 'dropped to' : 'rose to'} trigger level</div>
                </div>
            </div>
            
            <a href="${appLink}" class="cta-button">View Stock Details</a>
        </div>
        <div class="footer">
            <p>You're receiving this email because you set a ${alertType} price alert for ${ticker}.</p>
            <p><a href="${appLink}">Manage your alerts</a> | <a href="${appLink}">Unsubscribe</a></p>
        </div>
    </div>
</body>
</html>
    `.trim();
}

export function generateEmailText(data: AlertEmailData): string {
    const { ticker, companyName, alertType, triggerPrice, currentPrice, priceChange, priceChangePercent } = data;
    const isBuy = alertType === 'BUY';
    
    return `
🔔 Price Alert Triggered

${alertType} Alert for ${ticker}${companyName ? ` (${companyName})` : ''}

Trigger Price: ₹${triggerPrice.toFixed(2)}
Current Price: ₹${currentPrice.toFixed(2)}
Change: ₹${Math.abs(priceChange).toFixed(2)} (${priceChangePercent >= 0 ? '+' : ''}${priceChangePercent.toFixed(2)}%)

The price has ${isBuy ? 'dropped to' : 'risen to'} your ${alertType} alert level.

View stock details: https://alphaboard.onrender.com
    `.trim();
}




