/**
 * WhatsApp Connection Component
 * Allows users to link their WhatsApp account to AlphaBoard
 */

import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { MessageCircle, Link2, Unlink, CheckCircle, AlertCircle, Loader2, Phone } from 'lucide-react';

interface AccountStatus {
  is_linked: boolean;
  whatsapp_phone?: string;
  username?: string;
  full_name?: string;
}

interface VerifyResponse {
  success: boolean;
  message: string;
  phone?: string;
}

// API base URL for WhatsApp bot
const WHATSAPP_BOT_API = import.meta.env.VITE_WHATSAPP_BOT_API_URL || 'https://alphaboard-whatsapp-bot.onrender.com';

export function WhatsAppConnect() {
  const { userId } = useAuth();
  const [status, setStatus] = useState<AccountStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [linkCode, setLinkCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResponse | null>(null);
  const [unlinking, setUnlinking] = useState(false);

  // Fetch account status on mount
  useEffect(() => {
    if (userId) {
      fetchAccountStatus();
    }
  }, [userId]);

  const fetchAccountStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${WHATSAPP_BOT_API}/api/whatsapp/account-status/${userId}`);
      const data = await response.json();
      setStatus(data);
    } catch (error) {
      setStatus({ is_linked: false });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!linkCode.trim() || linkCode.length !== 6) {
      setVerifyResult({ success: false, message: 'Please enter a valid 6-character code.' });
      return;
    }

    try {
      setVerifying(true);
      setVerifyResult(null);

      const response = await fetch(`${WHATSAPP_BOT_API}/api/whatsapp/verify-link-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: linkCode.toUpperCase(),
          supabase_user_id: userId,
        }),
      });

      const data = await response.json();
      setVerifyResult(data);

      if (data.success) {
        // Refresh status after successful link
        await fetchAccountStatus();
        setLinkCode('');
      }
    } catch (error) {
      setVerifyResult({ success: false, message: 'Connection error. Please try again.' });
    } finally {
      setVerifying(false);
    }
  };

  const handleUnlink = async () => {
    if (!confirm('Are you sure you want to unlink your WhatsApp account?')) {
      return;
    }

    try {
      setUnlinking(true);

      const response = await fetch(`${WHATSAPP_BOT_API}/api/whatsapp/unlink/${userId}`, {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        setStatus({ is_linked: false });
      }
    } catch (error) {
    } finally {
      setUnlinking(false);
    }
  };

  // Format phone number for display
  const formatPhone = (phone?: string) => {
    if (!phone) return '';
    // Add + if not present and format
    const withPlus = phone.startsWith('+') ? phone : `+${phone}`;
    // Simple formatting: +91 XXXXX XXXXX
    if (withPlus.length > 10) {
      const countryCode = withPlus.slice(0, 3);
      const rest = withPlus.slice(3);
      return `${countryCode} ${rest.slice(0, 5)} ${rest.slice(5)}`;
    }
    return withPlus;
  };

  if (loading) {
    return (
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
          <span className="ml-2 text-slate-400">Loading WhatsApp status...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-emerald-500/20 rounded-lg">
          <MessageCircle className="w-6 h-6 text-emerald-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">WhatsApp Integration</h3>
          <p className="text-sm text-slate-400">Connect your WhatsApp to manage stocks on the go</p>
        </div>
      </div>

      {/* Status Display */}
      {status?.is_linked ? (
        <div className="space-y-4">
          {/* Connected Status */}
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              <span className="font-medium text-emerald-400">Connected</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <Phone className="w-4 h-4 text-slate-400" />
              <span>{formatPhone(status.whatsapp_phone)}</span>
            </div>
          </div>

          {/* Features */}
          <div className="space-y-2 text-sm text-slate-400">
            <p className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              Watchlist syncs automatically
            </p>
            <p className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              Recommendations tracked in app
            </p>
            <p className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              Daily market reports via WhatsApp
            </p>
          </div>

          {/* Unlink Button */}
          <button
            onClick={handleUnlink}
            disabled={unlinking}
            className="flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
          >
            {unlinking ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Unlink className="w-4 h-4" />
            )}
            Unlink WhatsApp
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Not Connected Status */}
          <div className="bg-slate-700/30 border border-slate-600 rounded-lg p-4">
            <p className="text-slate-300 mb-3">
              Link your WhatsApp to add stocks, get market updates, and request podcasts right from your phone!
            </p>
            <div className="space-y-2 text-sm text-slate-400">
              <p className="flex items-center gap-2">
                ✓ Add stocks to watchlist via chat
              </p>
              <p className="flex items-center gap-2">
                ✓ Log recommendations on the go
              </p>
              <p className="flex items-center gap-2">
                ✓ Receive daily market summaries
              </p>
              <p className="flex items-center gap-2">
                ✓ Request AI podcasts anytime
              </p>
            </div>
          </div>

          {/* Instructions */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-slate-300 uppercase tracking-wider">How to Connect</h4>
            
            <ol className="space-y-3 text-slate-400">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center text-sm font-medium">1</span>
                <span>Send "connect" to our WhatsApp number: <strong className="text-white">+1 XXX XXX XXXX</strong></span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center text-sm font-medium">2</span>
                <span>You'll receive a 6-digit code</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center text-sm font-medium">3</span>
                <span>Enter the code below to link your accounts</span>
              </li>
            </ol>
          </div>

          {/* Code Input */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-300">
              Enter your 6-digit code
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={linkCode}
                onChange={(e) => setLinkCode(e.target.value.toUpperCase().slice(0, 6))}
                placeholder="ABC123"
                maxLength={6}
                className="flex-1 px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-center text-xl tracking-widest font-mono placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50"
              />
              <button
                onClick={handleVerifyCode}
                disabled={verifying || linkCode.length !== 6}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                {verifying ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Link2 className="w-5 h-5" />
                )}
                Link
              </button>
            </div>
          </div>

          {/* Verify Result */}
          {verifyResult && (
            <div
              className={`flex items-center gap-2 p-3 rounded-lg ${
                verifyResult.success
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                  : 'bg-red-500/10 border border-red-500/30 text-red-400'
              }`}
            >
              {verifyResult.success ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <AlertCircle className="w-5 h-5" />
              )}
              <span>{verifyResult.message}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default WhatsAppConnect;

