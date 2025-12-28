/**
 * MobileNavDrawer Component
 * 
 * Bottom sheet navigation drawer for mobile devices featuring:
 * - Slide-up animation
 * - Backdrop blur
 * - Navigation links with icons
 * - Smooth transitions
 * 
 * @component
 */

import { Link, useLocation } from 'react-router-dom';
import { X, LayoutDashboard, Trophy, BarChart2, User, Settings, FileText, Building2, Users } from 'lucide-react';

interface MobileNavDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    user?: any;
    organization?: { id: string; name: string; role: string } | null;
}

export function MobileNavDrawer({ isOpen, onClose, user, organization }: MobileNavDrawerProps) {
    const location = useLocation();

    const isActive = (path: string) => {
        if (path === '/') {
            return location.pathname === '/';
        }
        return location.pathname.startsWith(path);
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Drawer */}
            <div
                className={`
                    fixed bottom-0 left-0 right-0 z-50 bg-[var(--card-bg)] rounded-t-2xl
                    border-t border-[var(--border-color)] shadow-2xl
                    transform transition-transform duration-300 ease-out
                    ${isOpen ? 'translate-y-0' : 'translate-y-full'}
                    max-h-[80vh] overflow-y-auto
                `}
                style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
                {/* Handle */}
                <div className="flex justify-center pt-3 pb-2">
                    <div className="w-12 h-1 bg-[var(--border-color)] rounded-full" />
                </div>

                {/* Header */}
                <div className="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between">
                    <h2 className="text-lg font-bold text-[var(--text-primary)]">Navigation</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-[var(--list-item-hover)] rounded-lg transition-colors text-[var(--text-secondary)]"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Navigation Links */}
                <nav className="px-4 py-4 space-y-1">
                    <NavLink
                        to="/"
                        icon={<LayoutDashboard className="w-5 h-5" />}
                        label="Dashboard"
                        active={isActive('/')}
                        onClick={onClose}
                    />
                    <NavLink
                        to="/leaderboard"
                        icon={<Trophy className="w-5 h-5" />}
                        label="Performance Tracker"
                        active={isActive('/leaderboard')}
                        onClick={onClose}
                    />
                    {user?.id && (
                        <NavLink
                            to={`/analyst/${user.id}/performance`}
                            icon={<BarChart2 className="w-5 h-5" />}
                            label="Performance"
                            active={isActive('/analyst')}
                            onClick={onClose}
                        />
                    )}
                    {user?.id && organization && (
                        <NavLink
                            to="/research"
                            icon={<FileText className="w-5 h-5" />}
                            label="Institutional Memory"
                            active={isActive('/research')}
                            onClick={onClose}
                        />
                    )}
                    {organization && organization.role === 'admin' && (
                        <NavLink
                            to="/organization/admin"
                            icon={<Building2 className="w-5 h-5" />}
                            label="Admin Dashboard"
                            active={isActive('/organization/admin')}
                            onClick={onClose}
                        />
                    )}
                    {!organization && user?.id && (
                        <>
                            <NavLink
                                to="/organization/join"
                                icon={<Users className="w-5 h-5" />}
                                label="Join Org"
                                active={isActive('/organization/join')}
                                onClick={onClose}
                            />
                            <NavLink
                                to="/organization/create"
                                icon={<Building2 className="w-5 h-5" />}
                                label="Create Org"
                                active={isActive('/organization/create')}
                                onClick={onClose}
                            />
                        </>
                    )}
                    {user?.id && (
                        <>
                            <NavLink
                                to="/profile"
                                icon={<User className="w-5 h-5" />}
                                label="Profile"
                                active={isActive('/profile')}
                                onClick={onClose}
                            />
                            <NavLink
                                to="/settings/privacy"
                                icon={<Settings className="w-5 h-5" />}
                                label="Settings"
                                active={isActive('/settings')}
                                onClick={onClose}
                            />
                        </>
                    )}
                </nav>
            </div>
        </>
    );
}

interface NavLinkProps {
    to: string;
    icon: React.ReactNode;
    label: string;
    active: boolean;
    onClick: () => void;
}

function NavLink({ to, icon, label, active, onClick }: NavLinkProps) {
    return (
        <Link
            to={to}
            onClick={onClick}
            className={`
                flex items-center gap-3 px-4 py-3 rounded-xl transition-colors min-h-[44px]
                ${active
                    ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--list-item-hover)] hover:text-[var(--text-primary)]'
                }
            `}
        >
            {icon}
            <span className="font-medium">{label}</span>
        </Link>
    );
}

export default MobileNavDrawer;

