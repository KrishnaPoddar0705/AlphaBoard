// Types for price alert checking

export interface PriceAlertTrigger {
    id: string;
    user_id: string;
    recommendation_id: string;
    ticker: string;
    alert_type: 'BUY' | 'SELL';
    trigger_price: number;
    is_active: boolean;
    created_at: string;
}

export interface LegacyAlert {
    id: string;
    user_id: string;
    ticker: string;
    buy_price: number | null;
    sell_price: number | null;
    current_price: number | null;
}

export interface TriggeredAlert {
    user_id: string;
    recommendation_id: string;
    ticker: string;
    alert_type: 'BUY' | 'SELL';
    trigger_price: number;
    current_price: number;
    message: string;
}

export interface UserEmail {
    user_id: string;
    email: string;
}

export interface PriceData {
    ticker: string;
    price: number;
    companyName?: string;
}




