import { useState } from 'react';

/**
 * The organization's join code, hidden behind a click.
 *
 * Admin-only: this code is how anyone becomes an analyst in the organization, so it
 * does not appear on the Team Dashboard. Revealing it takes a deliberate click
 * because the dashboard is a plausible thing to have open while screen-sharing.
 */
export default function JoinCodePanel({ joinCode }: { joinCode: string }) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="glass rounded-xl p-6 border border-indigo-500/30">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--text-primary)] mb-1">
            Organization Join Code
          </p>
          <p className="text-xs text-[var(--text-secondary)] mb-2">
            Share this code with analysts to join your organization
          </p>
          {revealed ? (
            <code className="text-lg font-mono font-bold text-indigo-400 bg-[var(--card-bg)] px-3 py-2 rounded border border-indigo-500/30">
              {joinCode}
            </code>
          ) : (
            <button
              onClick={() => setRevealed(true)}
              className="text-indigo-400 hover:text-indigo-300 font-medium text-sm underline transition-colors"
            >
              Click to reveal join code
            </button>
          )}
        </div>
        {revealed && (
          <button
            onClick={() => {
              navigator.clipboard.writeText(joinCode);
              alert('Join code copied to clipboard!');
            }}
            className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-md hover:from-indigo-400 hover:to-purple-400 text-sm transition-all duration-200 shadow-lg shadow-indigo-500/25"
          >
            Copy Code
          </button>
        )}
      </div>
    </div>
  );
}
