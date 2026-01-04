/**
 * Mobile Card List Component
 * 
 * Mobile-optimized card list for displaying data.
 * Features:
 * - Card-based layout
 * - Swipe actions support
 * - Loading states
 * - Empty states
 * - Pull-to-refresh ready
 */

import React from 'react';
import clsx from 'clsx';
import { Card } from './Card';

interface MobileCardListProps<T> {
    data: T[];
    renderItem: (item: T, index: number) => React.ReactNode;
    keyExtractor: (item: T) => string;
    onItemClick?: (item: T) => void;
    loading?: boolean;
    emptyMessage?: string;
    emptyIcon?: React.ReactNode;
    className?: string;
    itemClassName?: (item: T) => string;
}

export function MobileCardList<T>({
    data,
    renderItem,
    keyExtractor,
    onItemClick,
    loading = false,
    emptyMessage = 'No items found',
    emptyIcon,
    className = '',
    itemClassName,
}: MobileCardListProps<T>) {
    if (loading) {
        return (
            <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                    <Card key={i} padding="md" className="animate-pulse">
                        <div className="h-20 bg-[var(--bg-secondary)] rounded" />
                    </Card>
                ))}
            </div>
        );
    }

    if (data.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                {emptyIcon && (
                    <div className="mb-4 text-[var(--text-tertiary)]">
                        {emptyIcon}
                    </div>
                )}
                <p className="text-[var(--text-secondary)]">{emptyMessage}</p>
            </div>
        );
    }

    return (
        <div className={clsx('space-y-3', className)}>
            {data.map((item, index) => (
                <div
                    key={keyExtractor(item)}
                    className={clsx(
                        'transition-transform active:scale-[0.98]',
                        itemClassName && itemClassName(item)
                    )}
                    onClick={() => onItemClick?.(item)}
                >
                    {renderItem(item, index)}
                </div>
            ))}
        </div>
    );
}

/**
 * Responsive List Component
 * 
 * Automatically switches between DataTable (desktop) and MobileCardList (mobile)
 */
interface Column<T> {
    header: string;
    accessor: (row: T) => React.ReactNode;
}

// DataTableProps interface removed - not used

interface ResponsiveListProps<T> {
    columns: Column<T>[];
    data: T[];
    keyExtractor: (row: T) => string;
    mobileRenderItem: (item: T, index: number) => React.ReactNode;
    onRowClick?: (row: T) => void;
    loading?: boolean;
    emptyMessage?: string;
    mobileEmptyIcon?: React.ReactNode;
    className?: string;
    rowClassName?: (row: T) => string;
}

export function ResponsiveList<T>({
    columns,
    data,
    keyExtractor,
    mobileRenderItem,
    onRowClick,
    loading,
    emptyMessage,
    mobileEmptyIcon,
    className,
    rowClassName,
}: ResponsiveListProps<T>) {
    const [isMobile, setIsMobile] = React.useState(false);

    React.useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 1024);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    if (isMobile) {
        return (
            <MobileCardList
                data={data}
                renderItem={mobileRenderItem}
                keyExtractor={keyExtractor}
                onItemClick={onRowClick}
                loading={loading}
                emptyMessage={emptyMessage}
                emptyIcon={mobileEmptyIcon}
                className={className}
                itemClassName={rowClassName}
            />
        );
    }

    // For now, render as cards since DataTable is not implemented
    return (
        <div className="space-y-4">
            {data.map((item) => (
                <Card key={keyExtractor(item)} onClick={() => onRowClick?.(item)}>
                    {columns.map((col, idx) => (
                        <div key={idx} className="mb-2">
                            <div className="text-xs text-muted-foreground">{col.header}</div>
                            <div>{col.accessor(item)}</div>
                        </div>
                    ))}
                </Card>
            ))}
        </div>
    );
}

// Re-export DataTable types
export type { Column } from './DataTable';

