import { Trash2 } from 'lucide-react';
import type { OrgRole } from '../../../hooks/useOrganization';
import { formatDate, type OrganizationUser } from './types';

const ROLE_LABELS: Record<OrgRole, string> = {
  admin: 'Admin',
  portfolio_manager: 'Portfolio Manager',
  analyst: 'Analyst',
};

const ROLE_BADGE_CLASS: Partial<Record<OrgRole, string>> = {
  admin: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  portfolio_manager: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  // Analyst is the default and gets no badge -- a badge on everyone is no signal.
};

/**
 * The organization roster with role and removal controls.
 *
 * The role control is a select rather than the old Promote/Demote button pair: with
 * three roles "promote" and "demote" stopped describing anything, since analyst to
 * portfolio manager and admin to portfolio manager move in opposite directions.
 */
export default function OrganizationMembersList({
  users,
  currentUserId,
  onChangeRole,
  onRemove,
}: {
  users: OrganizationUser[];
  currentUserId?: string;
  onChangeRole: (userId: string, username: string, newRole: OrgRole) => void;
  onRemove: (userId: string, username: string) => void;
}) {
  return (
    <div className="glass rounded-xl shadow-xl border border-[var(--border-color)]">
      <div className="p-6 border-b border-[var(--border-color)]">
        <h2 className="text-xl font-bold text-[var(--text-primary)]">Organization Members</h2>
      </div>
      <div className="p-6">
        <div className="space-y-4">
          {users.map((user) => {
            const isSelf = user.userId === currentUserId;
            const badgeClass = ROLE_BADGE_CLASS[user.role];

            return (
              <div
                key={user.userId}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border border-[var(--border-color)] rounded-lg hover:bg-[var(--list-item-hover)] transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-medium text-[var(--text-primary)]">
                      {user.username || 'Unknown User'}
                    </div>
                    {badgeClass && (
                      <span className={`px-2 py-1 text-xs font-medium rounded border ${badgeClass}`}>
                        {ROLE_LABELS[user.role]}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-[var(--text-secondary)] mt-1 truncate">
                    {user.email || 'No email'}
                  </div>
                  <div className="text-xs text-[var(--text-secondary)] mt-1">
                    Joined {formatDate(user.joinedAt)}
                  </div>
                </div>

                {/* An admin cannot change or remove themselves. Losing your own admin
                    rights is not something to do by accident from a dropdown. */}
                {!isSelf && (
                  <div className="flex items-center gap-2 shrink-0">
                    <label className="sr-only" htmlFor={`role-${user.userId}`}>
                      Role for {user.username || 'this user'}
                    </label>
                    <select
                      id={`role-${user.userId}`}
                      value={user.role}
                      onChange={(e) =>
                        onChangeRole(user.userId, user.username || 'this user', e.target.value as OrgRole)
                      }
                      className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="analyst">Analyst</option>
                      <option value="portfolio_manager">Portfolio Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button
                      onClick={() => onRemove(user.userId, user.username || 'this user')}
                      className="px-3 py-2 text-red-400 hover:bg-red-500/20 rounded-md text-sm flex items-center gap-1 border border-red-500/30 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Remove
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
