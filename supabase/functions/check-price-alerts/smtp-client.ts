// SMTP Client for sending emails via Supabase SMTP
// Uses Deno's built-in capabilities to send emails via SMTP

interface SMTPConfig {
    host: string;
    port: number;
    secure: boolean;
    auth: {
        user: string;
        password: string;
    }
}

interface EmailOptions {
    from: string;
    to: string;
    subject: string;
    html: string;
    text?: string;
}

/**
 * Send email via SMTP/Email Service
 * Supports Resend API (recommended) or direct SMTP
 * Uses Supabase SMTP configuration from environment variables
 */
export async function sendEmailViaSMTP(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
    try {
        const smtpFrom = Deno.env.get('SMTP_FROM') || 'noreply@alphaboard.onrender.com'
        
        // Try Resend API first (recommended for Edge Functions)
        const resendApiKey = Deno.env.get('RESEND_API_KEY')
        if (resendApiKey) {
            console.log('[SMTP] Using Resend API for email sending')
            return await sendViaResend(options, resendApiKey, smtpFrom)
        }

        // Try SendGrid API as fallback
        const sendGridApiKey = Deno.env.get('SENDGRID_API_KEY')
        if (sendGridApiKey) {
            console.log('[SMTP] Using SendGrid API for email sending')
            return await sendViaSendGrid(options, sendGridApiKey, smtpFrom)
        }

        // Try direct SMTP if configured
        const smtpHost = Deno.env.get('SMTP_HOST')
        const smtpUser = Deno.env.get('SMTP_USER') || Deno.env.get('SMTP_USERNAME') || ''
        const smtpPassword = Deno.env.get('SMTP_PASSWORD') || ''
        
        if (smtpHost && smtpUser && smtpPassword) {
            console.log('[SMTP] Using direct SMTP connection')
            return await sendViaDirectSMTP(options, {
                host: smtpHost,
                port: parseInt(Deno.env.get('SMTP_PORT') || '587'),
                secure: Deno.env.get('SMTP_SECURE') === 'true' || Deno.env.get('SMTP_PORT') === '465',
                auth: {
                    user: smtpUser,
                    password: smtpPassword
                }
            }, smtpFrom)
        }

        // No email service configured
        console.warn('[SMTP] No email service configured. Set RESEND_API_KEY, SENDGRID_API_KEY, or SMTP credentials.')
        console.log(`[SMTP] Email would be sent to ${options.to}:`, {
            from: options.from || smtpFrom,
            subject: options.subject
        })
        
        // Return success to not block the process, but log warning
        return { success: false, error: 'No email service configured' }
        
    } catch (error) {
        console.error('[SMTP] Error sending email:', error)
        return { 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error' 
        }
    }
}

/**
 * Send email via Resend API (recommended for Edge Functions)
 */
async function sendViaResend(
    options: EmailOptions, 
    apiKey: string,
    fromEmail: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: options.from || fromEmail,
                to: options.to,
                subject: options.subject,
                html: options.html,
                text: options.text || options.html.replace(/<[^>]*>/g, ''),
            }),
        })

        if (!response.ok) {
            const errorData = await response.text()
            throw new Error(`Resend API error: ${response.status} - ${errorData}`)
        }

        const result = await response.json()
        console.log('[SMTP] Email sent via Resend:', result.id)
        return { success: true }
    } catch (error) {
        console.error('[SMTP] Resend error:', error)
        return { 
            success: false, 
            error: error instanceof Error ? error.message : 'Resend API error' 
        }
    }
}

/**
 * Send email via SendGrid API
 */
async function sendViaSendGrid(
    options: EmailOptions,
    apiKey: string,
    fromEmail: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                personalizations: [{
                    to: [{ email: options.to }],
                    subject: options.subject
                }],
                from: { email: options.from || fromEmail },
                content: [
                    {
                        type: 'text/html',
                        value: options.html
                    },
                    {
                        type: 'text/plain',
                        value: options.text || options.html.replace(/<[^>]*>/g, '')
                    }
                ]
            }),
        })

        if (!response.ok) {
            const errorData = await response.text()
            throw new Error(`SendGrid API error: ${response.status} - ${errorData}`)
        }

        console.log('[SMTP] Email sent via SendGrid')
        return { success: true }
    } catch (error) {
        console.error('[SMTP] SendGrid error:', error)
        return { 
            success: false, 
            error: error instanceof Error ? error.message : 'SendGrid API error' 
        }
    }
}

/**
 * Send email via direct SMTP connection
 * Note: This requires an SMTP library for Deno. For now, this is a placeholder.
 * For production, use Resend or SendGrid APIs instead.
 */
async function sendViaDirectSMTP(
    options: EmailOptions,
    config: SMTPConfig,
    fromEmail: string
): Promise<{ success: boolean; error?: string }> {
    // Direct SMTP implementation would require a Deno-compatible SMTP library
    // For now, we'll log and return an error suggesting to use Resend/SendGrid
    console.warn('[SMTP] Direct SMTP not implemented. Please use Resend or SendGrid API.')
    return { 
        success: false, 
        error: 'Direct SMTP not implemented. Use RESEND_API_KEY or SENDGRID_API_KEY environment variable.' 
    }
}

