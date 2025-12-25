/**
 * Layout Utility Hooks
 * 
 * Custom hooks for managing responsive panel layouts, sticky headers,
 * and smooth transitions in the Stock Analyst Leaderboard.
 * 
 * @author AI Assistant
 * @version 1.0.0
 */

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Hook to manage panel width based on screen size
 * Returns column spans for a 12-column grid system
 */
export function usePanelWidth() {
    const [isMobile, setIsMobile] = useState(false);
    const [isTablet, setIsTablet] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);

    useEffect(() => {
        const checkScreenSize = () => {
            const width = window.innerWidth;
            setIsMobile(width < 768);
            setIsTablet(width >= 768 && width < 1024);
        };

        checkScreenSize();
        window.addEventListener('resize', checkScreenSize);
        return () => window.removeEventListener('resize', checkScreenSize);
    }, []);

    // Grid column configuration (out of 12)
    const listColumns = isMobile ? 12 : isTablet ? 5 : 4;
    const detailColumns = isMobile ? 12 : isTablet ? 7 : 8;

    return {
        isMobile,
        isTablet,
        isCollapsed,
        setIsCollapsed,
        listColumns,
        detailColumns,
        // Tailwind classes for grid columns
        listColClass: `col-span-${listColumns}`,
        detailColClass: `col-span-${detailColumns}`,
    };
}

/**
 * Hook to manage sticky header behavior with scroll detection
 */
export function useStickyHeader(threshold: number = 50) {
    const [isSticky, setIsSticky] = useState(false);
    const [scrollY, setScrollY] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleScroll = useCallback(() => {
        if (containerRef.current) {
            const scrollTop = containerRef.current.scrollTop;
            setScrollY(scrollTop);
            setIsSticky(scrollTop > threshold);
        }
    }, [threshold]);

    useEffect(() => {
        const container = containerRef.current;
        if (container) {
            container.addEventListener('scroll', handleScroll, { passive: true });
            return () => container.removeEventListener('scroll', handleScroll);
        }
    }, [handleScroll]);

    return {
        isSticky,
        scrollY,
        containerRef,
    };
}

/**
 * Hook for smooth panel transitions
 */
export function usePanelTransition(isOpen: boolean) {
    const [shouldRender, setShouldRender] = useState(isOpen);
    const [isAnimating, setIsAnimating] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setShouldRender(true);
            requestAnimationFrame(() => setIsAnimating(true));
        } else {
            setIsAnimating(false);
            const timer = setTimeout(() => setShouldRender(false), 300);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    return { shouldRender, isAnimating };
}

/**
 * Hook for detecting outside clicks (for mobile drawer)
 */
export function useOutsideClick(ref: React.RefObject<HTMLElement>, callback: () => void) {
    useEffect(() => {
        const handleClick = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                callback();
            }
        };

        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [ref, callback]);
}

