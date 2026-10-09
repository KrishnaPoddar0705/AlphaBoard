import { useState } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import type { Team } from '../../../lib/edgeFunctions';

/**
 * The organization's teams, each with an editable name.
 *
 * Membership is edited from the members list below -- per person, since "which teams is
 * this analyst on" is the question an admin actually arrives with.
 */
export default function TeamNamesPanel({
  teams,
  onRename,
}: {
  teams: Team[];
  /** Resolves once saved; rejects with a message to show beside the field. */
  onRename: (teamId: string, name: string) => Promise<void>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = (team: Team) => {
    setEditingId(team.id);
    setDraft(team.name);
    setError(null);
  };

  const save = async (team: Team) => {
    const name = draft.trim();
    if (!name || name === team.name) {
      setEditingId(null);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onRename(team.id, name);
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename team');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="glass rounded-xl shadow-xl border border-[var(--border-color)] mb-8">
      <div className="p-6 border-b border-[var(--border-color)]">
        <h2 className="text-xl font-bold text-[var(--text-primary)]">Teams</h2>
      </div>
      <ul className="p-6 space-y-2">
        {teams.map((team) => (
          <li
            key={team.id}
            className="flex flex-col gap-1 p-3 border border-[var(--border-color)] rounded-lg"
          >
            {editingId === team.id ? (
              <form
                className="flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  save(team);
                }}
              >
                <label className="sr-only" htmlFor={`team-name-${team.id}`}>
                  Team name
                </label>
                <input
                  id={`team-name-${team.id}`}
                  autoFocus
                  value={draft}
                  maxLength={80}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  className="min-w-0 flex-1 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md px-3 py-1.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  disabled={saving || !draft.trim()}
                  aria-label="Save team name"
                  className="p-2 rounded-md text-green-500 hover:bg-green-500/10 disabled:opacity-40"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  aria-label="Cancel"
                  className="p-2 rounded-md text-[var(--text-secondary)] hover:bg-[var(--list-item-hover)]"
                >
                  <X className="w-4 h-4" />
                </button>
              </form>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate font-medium text-[var(--text-primary)]">
                  {team.name}
                </span>
                <button
                  type="button"
                  onClick={() => start(team)}
                  aria-label={`Rename ${team.name}`}
                  className="shrink-0 p-2 rounded-md text-[var(--text-secondary)] hover:bg-[var(--list-item-hover)]"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              </div>
            )}
            {editingId === team.id && error && <p className="text-xs text-red-400">{error}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
