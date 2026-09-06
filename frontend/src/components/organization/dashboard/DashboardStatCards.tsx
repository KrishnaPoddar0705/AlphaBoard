import type { LucideIcon } from 'lucide-react';

export interface StatCard {
  label: string;
  value: string;
  icon: LucideIcon;
  iconClass: string;
}

/**
 * The row of headline tiles above a dashboard.
 *
 * Driven by a list rather than fixed props because the two dashboards count
 * different things: the org counts members and admins, a team counts its own
 * roster. Same presentation, different questions.
 */
export default function DashboardStatCards({ cards }: { cards: StatCard[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      {cards.map((card) => (
        <div
          key={card.label}
          className="glass rounded-xl p-6 border border-[var(--border-color)]"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--text-secondary)]">{card.label}</p>
              <p className="text-2xl font-bold text-[var(--text-primary)]">{card.value}</p>
            </div>
            <card.icon className={`w-8 h-8 ${card.iconClass}`} />
          </div>
        </div>
      ))}
    </div>
  );
}
