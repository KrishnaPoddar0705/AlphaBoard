// Edge Function: check-price-alerts
// Purpose: Check price alerts daily at 9am GMT and send email notifications
// Checks both price_alert_triggers table and legacy buy_price/sell_price columns

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { generateEmailHTML, generateEmailText } from './email-template.ts'
import { sendEmailViaSMTP } from './smtp-client.ts'
import type { PriceAlertTrigger, LegacyAlert, TriggeredAlert, UserEmail, PriceData } from './types.ts'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Get backend API URL from environment or use default
const BACKEND_API_URL = Deno.env.get('BACKEND_API_URL') || 'https://alphaboard-backend.onrender.com'

interface EmailResult {
    success: boolean;
    error?: string;
}

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders })
    }

    try {
        console.log('[check-price-alerts] Starting price alert check...')
        
        // Initialize Supabase Admin client
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        
        if (!supabaseUrl || !supabaseServiceKey) {
            throw new Error('Missing Supabase configuration')
        }

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        })

        // Step 1: Fetch all active triggers from price_alert_triggers table
        console.log('[check-price-alerts] Fetching active triggers...')
        const { data: triggers, error: triggersError } = await supabaseAdmin
            .from('price_alert_triggers')
            .select('*')
            .eq('is_active', true)

        if (triggersError) {
            throw new Error(`Failed to fetch triggers: ${triggersError.message}`)
        }

        console.log(`[check-price-alerts] Found ${triggers?.length || 0} active triggers`)

        // Step 2: Fetch legacy alerts from recommendations table (watchlist items with buy_price/sell_price)
        console.log('[check-price-alerts] Fetching legacy alerts...')
        const { data: legacyAlerts, error: legacyError } = await supabaseAdmin
            .from('recommendations')
            .select('id, user_id, ticker, buy_price, sell_price, current_price')
            .eq('status', 'WATCHLIST')
            .or('buy_price.not.is.null,sell_price.not.is.null')

        if (legacyError) {
            throw new Error(`Failed to fetch legacy alerts: ${legacyError.message}`)
        }

        console.log(`[check-price-alerts] Found ${legacyAlerts?.length || 0} legacy alerts`)

        // Step 3: Get unique list of tickers to check
        const tickerSet = new Set<string>()
        
        triggers?.forEach((t: PriceAlertTrigger) => tickerSet.add(t.ticker))
        legacyAlerts?.forEach((l: LegacyAlert) => tickerSet.add(l.ticker))
        
        const uniqueTickers = Array.from(tickerSet)
        console.log(`[check-price-alerts] Checking ${uniqueTickers.length} unique tickers`)

        if (uniqueTickers.length === 0) {
            return new Response(
                JSON.stringify({ message: 'No alerts to check', triggered: 0 }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Step 4: Fetch current prices for all tickers
        console.log('[check-price-alerts] Fetching current prices...')
        const priceMap = new Map<string, PriceData>()
        
        // Batch fetch prices (with rate limiting)
        for (const ticker of uniqueTickers) {
            try {
                const priceResponse = await fetch(`${BACKEND_API_URL}/market/price/${encodeURIComponent(ticker)}`)
                if (priceResponse.ok) {
                    const priceData = await priceResponse.json()
                    if (priceData?.price) {
                        priceMap.set(ticker, {
                            ticker,
                            price: priceData.price,
                            companyName: priceData.companyName
                        })
                    }
                }
                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 100))
            } catch (error) {
                console.error(`[check-price-alerts] Failed to fetch price for ${ticker}:`, error)
            }
        }

        console.log(`[check-price-alerts] Fetched prices for ${priceMap.size} tickers`)

        // Step 5: Check trigger conditions and collect triggered alerts
        const triggeredAlerts: TriggeredAlert[] = []
        const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD

        // Check new triggers
        for (const trigger of triggers || []) {
            const priceData = priceMap.get(trigger.ticker)
            if (!priceData) continue

            const currentPrice = priceData.price
            let isTriggered = false

            if (trigger.alert_type === 'BUY' && currentPrice <= trigger.trigger_price) {
                isTriggered = true
            } else if (trigger.alert_type === 'SELL' && currentPrice >= trigger.trigger_price) {
                isTriggered = true
            }

            if (isTriggered) {
                // Check if alert already exists for today
                const { data: existingAlert } = await supabaseAdmin
                    .from('price_alerts')
                    .select('id')
                    .eq('recommendation_id', trigger.recommendation_id)
                    .eq('alert_type', trigger.alert_type)
                    .eq('trigger_price', trigger.trigger_price)
                    .gte('created_at', `${today}T00:00:00Z`)
                    .lt('created_at', `${today}T23:59:59Z`)
                    .maybeSingle()

                if (!existingAlert) {
                    const priceChange = currentPrice - trigger.trigger_price
                    const priceChangePercent = (priceChange / trigger.trigger_price) * 100

                    triggeredAlerts.push({
                        user_id: trigger.user_id,
                        recommendation_id: trigger.recommendation_id,
                        ticker: trigger.ticker,
                        alert_type: trigger.alert_type,
                        trigger_price: trigger.trigger_price,
                        current_price: currentPrice,
                        message: `${trigger.ticker} ${trigger.alert_type === 'BUY' ? 'dropped to' : 'rose to'} ₹${currentPrice.toFixed(2)}, ${trigger.alert_type === 'BUY' ? 'below' : 'above'} your ${trigger.alert_type} price of ₹${trigger.trigger_price.toFixed(2)}`
                    })
                }
            }
        }

        // Check legacy alerts
        for (const legacy of legacyAlerts || []) {
            const priceData = priceMap.get(legacy.ticker)
            if (!priceData) continue

            const currentPrice = priceData.price

            // Check BUY alert
            if (legacy.buy_price && currentPrice <= legacy.buy_price) {
                const { data: existingAlert } = await supabaseAdmin
                    .from('price_alerts')
                    .select('id')
                    .eq('recommendation_id', legacy.id)
                    .eq('alert_type', 'BUY')
                    .gte('created_at', `${today}T00:00:00Z`)
                    .lt('created_at', `${today}T23:59:59Z`)
                    .maybeSingle()

                if (!existingAlert) {
                    const priceChange = currentPrice - legacy.buy_price
                    const priceChangePercent = (priceChange / legacy.buy_price) * 100

                    triggeredAlerts.push({
                        user_id: legacy.user_id,
                        recommendation_id: legacy.id,
                        ticker: legacy.ticker,
                        alert_type: 'BUY',
                        trigger_price: legacy.buy_price,
                        current_price: currentPrice,
                        message: `${legacy.ticker} dropped to ₹${currentPrice.toFixed(2)}, below your BUY price of ₹${legacy.buy_price.toFixed(2)}`
                    })
                }
            }

            // Check SELL alert
            if (legacy.sell_price && currentPrice >= legacy.sell_price) {
                const { data: existingAlert } = await supabaseAdmin
                    .from('price_alerts')
                    .select('id')
                    .eq('recommendation_id', legacy.id)
                    .eq('alert_type', 'SELL')
                    .gte('created_at', `${today}T00:00:00Z`)
                    .lt('created_at', `${today}T23:59:59Z`)
                    .maybeSingle()

                if (!existingAlert) {
                    const priceChange = currentPrice - legacy.sell_price
                    const priceChangePercent = (priceChange / legacy.sell_price) * 100

                    triggeredAlerts.push({
                        user_id: legacy.user_id,
                        recommendation_id: legacy.id,
                        ticker: legacy.ticker,
                        alert_type: 'SELL',
                        trigger_price: legacy.sell_price,
                        current_price: currentPrice,
                        message: `${legacy.ticker} rose to ₹${currentPrice.toFixed(2)}, above your SELL price of ₹${legacy.sell_price.toFixed(2)}`
                    })
                }
            }
        }

        console.log(`[check-price-alerts] Found ${triggeredAlerts.length} triggered alerts`)

        if (triggeredAlerts.length === 0) {
            return new Response(
                JSON.stringify({ message: 'No alerts triggered', triggered: 0 }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Step 6: Get user emails from clerk_user_mapping
        const userIds = [...new Set(triggeredAlerts.map(a => a.user_id))]
        const { data: userMappings, error: mappingError } = await supabaseAdmin
            .from('clerk_user_mapping')
            .select('supabase_user_id, email')
            .in('supabase_user_id', userIds)

        if (mappingError) {
            console.error('[check-price-alerts] Failed to fetch user emails:', mappingError)
        }

        const emailMap = new Map<string, string>()
        userMappings?.forEach((m: { supabase_user_id: string; email: string }) => {
            emailMap.set(m.supabase_user_id, m.email)
        })

        // Step 7: Create price_alerts entries and send emails
        const emailResults: EmailResult[] = []
        let alertsCreated = 0
        let emailsSent = 0

        for (const alert of triggeredAlerts) {
            try {
                // Create price_alerts entry (email_sent will be updated after sending)
                const { error: insertError } = await supabaseAdmin
                    .from('price_alerts')
                    .insert([{
                        user_id: alert.user_id,
                        recommendation_id: alert.recommendation_id,
                        ticker: alert.ticker,
                        alert_type: alert.alert_type,
                        trigger_price: alert.trigger_price,
                        current_price: alert.current_price,
                        message: alert.message,
                        is_read: false,
                        email_sent: false,
                        email_sent_at: null
                    }])

                if (insertError) {
                    console.error(`[check-price-alerts] Failed to create alert for ${alert.ticker}:`, insertError)
                    emailResults.push({ success: false, error: insertError.message })
                    continue
                }

                alertsCreated++

                // Get user email
                const userEmail = emailMap.get(alert.user_id)
                if (!userEmail) {
                    console.warn(`[check-price-alerts] No email found for user ${alert.user_id}`)
                    emailResults.push({ success: false, error: 'No email found' })
                    continue
                }

                // Get company name if available
                const priceData = priceMap.get(alert.ticker)
                const companyName = priceData?.companyName

                // Calculate price change
                const priceChange = alert.current_price - alert.trigger_price
                const priceChangePercent = (priceChange / alert.trigger_price) * 100

                // Generate email content
                const emailHTML = generateEmailHTML({
                    ticker: alert.ticker,
                    companyName,
                    alertType: alert.alert_type,
                    triggerPrice: alert.trigger_price,
                    currentPrice: alert.current_price,
                    priceChange,
                    priceChangePercent
                })

                const emailText = generateEmailText({
                    ticker: alert.ticker,
                    companyName,
                    alertType: alert.alert_type,
                    triggerPrice: alert.trigger_price,
                    currentPrice: alert.current_price,
                    priceChange,
                    priceChangePercent
                })

                // Send email via SMTP
                const emailResult = await sendEmailViaSMTP({
                    from: Deno.env.get('SMTP_FROM') || 'noreply@alphaboard.onrender.com',
                    to: userEmail,
                    subject: `🔔 ${alert.ticker} Alert: ${alert.alert_type} Price Triggered`,
                    html: emailHTML,
                    text: emailText
                })

                // Update alert to mark email status
                const { error: updateError } = await supabaseAdmin
                    .from('price_alerts')
                    .update({
                        email_sent: emailResult.success,
                        email_sent_at: emailResult.success ? new Date().toISOString() : null
                    })
                    .eq('recommendation_id', alert.recommendation_id)
                    .eq('alert_type', alert.alert_type)
                    .eq('trigger_price', alert.trigger_price)
                    .gte('created_at', `${today}T00:00:00Z`)
                    .lt('created_at', `${today}T23:59:59Z`)

                if (updateError) {
                    console.error(`[check-price-alerts] Failed to update email_sent for ${alert.ticker}:`, updateError)
                }

                if (emailResult.success) {
                    emailsSent++
                    emailResults.push({ success: true })
                } else {
                    console.error(`[check-price-alerts] Failed to send email to ${userEmail}:`, emailResult.error)
                    emailResults.push({ success: false, error: emailResult.error })
                }

            } catch (error) {
                console.error(`[check-price-alerts] Error processing alert for ${alert.ticker}:`, error)
                emailResults.push({ success: false, error: error instanceof Error ? error.message : 'Unknown error' })
            }
        }

        const summary = {
            message: 'Price alert check completed',
            triggersChecked: triggers?.length || 0,
            legacyAlertsChecked: legacyAlerts?.length || 0,
            alertsTriggered: triggeredAlerts.length,
            alertsCreated,
            emailsSent,
            emailResults: emailResults.filter(r => !r.success).length
        }

        console.log('[check-price-alerts] Summary:', summary)

        return new Response(
            JSON.stringify(summary),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('[check-price-alerts] Error:', error)
        return new Response(
            JSON.stringify({ 
                error: 'Failed to check price alerts',
                details: error instanceof Error ? error.message : 'Unknown error'
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})

