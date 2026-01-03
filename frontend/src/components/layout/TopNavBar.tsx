/**
 * Top Navigation Bar Component
 * 
 * Top navigation bar that spans above central and right columns.
 * Features:
 * - Logo/brand name
 * - Search input for tickers
 * - Notifications bell with badge
 * - New Report button
 */

import { Search, Bell, FileText } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { useState } from 'react';

interface TopNavBarProps {
  onSearch?: (query: string) => void;
  onNewReport?: () => void;
}

export function TopNavBar({ onSearch, onNewReport }: TopNavBarProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch && searchQuery.trim()) {
      onSearch(searchQuery.trim());
    }
  };

  return (
    <header className="h-16 border-b flex items-center justify-between px-6 bg-background">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <span className="text-xl font-bold">AlphaBoard</span>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="flex-1 max-w-md mx-8">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search tickers (e.g., AAPL, TSLA)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </form>

      {/* Right Actions */}
      <div className="flex items-center gap-4">
        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          <Badge 
            variant="destructive" 
            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
          >
            3
          </Badge>
        </Button>

        {/* New Report Button */}
        <Button onClick={onNewReport} className="gap-2">
          <FileText className="w-4 h-4" />
          New Report
        </Button>
      </div>
    </header>
  );
}

