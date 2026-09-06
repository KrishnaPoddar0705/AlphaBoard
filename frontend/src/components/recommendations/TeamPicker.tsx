import type { Team } from '../../lib/edgeFunctions'

/**
 * Which desks a recommendation belongs to.
 *
 * Checkboxes rather than a multi-select widget: it needs no new dependency, and a
 * stacked list is legible on a phone where a tag-input is not. Renders nothing when
 * the author is on no teams -- an empty picker is a question with no answers.
 */
export default function TeamPicker({
  teams,
  selected,
  onChange,
  disabled = false,
  label = 'Teams',
  hint,
}: {
  teams: Team[]
  selected: string[]
  onChange: (teamIds: string[]) => void
  disabled?: boolean
  label?: string
  hint?: string
}) {
  if (teams.length === 0) return null

  const toggle = (teamId: string) => {
    onChange(
      selected.includes(teamId)
        ? selected.filter((id) => id !== teamId)
        : [...selected, teamId]
    )
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-[#1C1B17] font-mono">{label}</label>
      <div className="max-h-48 overflow-y-auto rounded-md border border-[#D7D0C2] bg-[#FBF7ED] divide-y divide-[#E5DFD1]">
        {teams.map((team) => (
          <label
            key={team.id}
            className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-[#F1EEE0] transition-colors ${
              disabled ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <input
              type="checkbox"
              checked={selected.includes(team.id)}
              onChange={() => toggle(team.id)}
              disabled={disabled}
              className="h-4 w-4 rounded border-[#D7D0C2] accent-[#1C1B17]"
            />
            <span className="text-sm text-[#1C1B17] font-mono">{team.name}</span>
          </label>
        ))}
      </div>
      {/* An empty selection is legal, so say what it means rather than blocking it. */}
      <p className="text-xs text-[#6F6A60] font-mono">
        {hint ??
          (selected.length === 0
            ? 'No team selected — this will be visible to all of your teams.'
            : `Visible on ${selected.length} team dashboard${selected.length === 1 ? '' : 's'}.`)}
      </p>
    </div>
  )
}
