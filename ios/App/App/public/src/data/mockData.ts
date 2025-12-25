export interface Employee {
  id: string;
  name: string;
  role: string;
  alpha: number; // Absolute Alpha value
  avatar: string;
  trend: 'up' | 'down' | 'same';
}

export const leaderboardData: Employee[] = [
  {
    id: '1',
    name: 'Sarah Chen',
    role: 'Senior Portfolio Manager',
    alpha: 15.4,
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah',
    trend: 'up',
  },
  {
    id: '2',
    name: 'Michael Ross',
    role: 'Quant Analyst',
    alpha: 12.8,
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Michael',
    trend: 'same',
  },
  {
    id: '3',
    name: 'Jessica Wu',
    role: 'Investment Strategist',
    alpha: 11.2,
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Jessica',
    trend: 'up',
  },
  {
    id: '4',
    name: 'David Miller',
    role: 'Risk Manager',
    alpha: 9.5,
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=David',
    trend: 'down',
  },
  {
    id: '5',
    name: 'Emily Davis',
    role: 'Equity Researcher',
    alpha: 8.7,
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Emily',
    trend: 'up',
  },
];

