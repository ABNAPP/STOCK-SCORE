import { useEffect, useRef, useState } from 'react';

interface PullToRefreshOptions {
  onRefresh: () => void | Promise<void>;
  threshold?: number; // Distance in pixels to trigger refresh
  disabled?: boolean;
  enabled?: boolean; // Only enable on mobile
}

export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  disabled = false,
  enabled = true,
}: PullToRefreshOptions) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);
  const isDragging = useRef(false);

  useEffect(() => {
    // Only enable on mobile devices
    const isMobile = window.innerWidth < 1024;
    if (!enabled || disabled || !isMobile) {
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e: TouchEvent) => {
      // Only start if at top of scrollable area
      if (container.scrollTop === 0 && !isRefreshing) {
        startY.current = e.touches[0].clientY;
        isDragging.current = true;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging.current || startY.current === null) return;

      const currentY = e.touches[0].clientY;
      const deltaY = currentY - startY.current;

      // Only allow pull down, not up
      if (deltaY > 0 && container.scrollTop === 0) {
        e.preventDefault(); // Prevent default scrolling
        const distance = Math.min(deltaY, threshold * 1.5); // Allow over-pull with resistance
        setPullDistance(distance);
      } else if (deltaY < 0) {
        // Reset if user scrolls back up
        startY.current = null;
        isDragging.current = false;
        setPullDistance(0);
      }
    };

    const handleTouchEnd = async () => {
      if (!isDragging.current || startY.current === null) return;

      if (pullDistance >= threshold && !isRefreshing) {
        setIsRefreshing(true);
        setPullDistance(0);
        try {
          await onRefresh();
        } finally {
          setIsRefreshing(false);
        }
      } else {
        setPullDistance(0);
      }

      startY.current = null;
      isDragging.current = false;
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });
    container.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [onRefresh, threshold, disabled, enabled, pullDistance, isRefreshing]);

  const pullProgress = Math.min(pullDistance / threshold, 1);
  const shouldTrigger = pullDistance >= threshold;

  return {
    containerRef,
    pullDistance,
    pullProgress,
    isRefreshing,
    shouldTrigger,
  };
}
