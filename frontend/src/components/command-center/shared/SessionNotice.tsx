import { useState } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { useCommandCenterSession } from '@/hooks/commandCenter/useCommandCenterSession'

/**
 * Explains the one failure that otherwise looks like a broken database.
 *
 * Command Center reads and writes Supabase directly, so it needs a real Supabase access
 * token -- Clerk alone is not enough. When the Clerk -> Supabase exchange has not
 * completed, `useAuth` still hands out a session-shaped object with an empty token, the
 * UI looks signed in, and every request goes out as `anon`. Since this feature revokes
 * anon, the only symptom is `permission denied for table cc_coverage`, which sends
 * people to re-run a migration that was never the problem.
 *
 * Rendered only once we KNOW the token is missing, so it never flashes during the
 * normal second or two the exchange takes.
 */
export default function SessionNotice() {
  const { resolved, authenticated } = useCommandCenterSession()
  const [retrying, setRetrying] = useState(false)

  if (!resolved || authenticated) return null

  const retry = async () => {
    setRetrying(true)
    try {
      // Nudges supabase-js to re-read and refresh persisted auth, which is enough
      // whenever the token simply had not landed yet.
      await supabase.auth.refreshSession()
    } catch {
      // Nothing actionable beyond the reload the copy already suggests.
    } finally {
      setRetrying(false)
    }
  }

  return (
    <div
      role="status"
      className="mb-4 flex flex-col gap-2 rounded-xl border border-[#D06030] bg-[#FBF7ED] p-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#D06030]" />
        <div>
          <p className="font-mono text-xs text-[#1C1B17]">
            Signed in to AlphaBoard, but not to the database yet.
          </p>
          <p className="mt-0.5 font-mono text-[11px] text-[#6F6A60]">
            Command Center talks to Supabase directly, so it needs a Supabase session as
            well as a Clerk one. Until that arrives, coverage and entries cannot load or
            save. Reloading usually fixes it; signing out and back in always does.
          </p>
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={retry} disabled={retrying} className="shrink-0">
        <RefreshCw className={`h-3.5 w-3.5 ${retrying ? 'animate-spin' : ''}`} />
        Retry
      </Button>
    </div>
  )
}
