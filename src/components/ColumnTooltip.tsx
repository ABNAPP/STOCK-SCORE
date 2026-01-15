import { useState, useRef, useEffect, useId } from 'react';
import { ColumnMetadata } from '../types/columnMetadata';

interface ColumnTooltipProps {
  metadata: ColumnMetadata;
  children: React.ReactNode;
}

export default function ColumnTooltip({ metadata, children }: ColumnTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipId = useId();

  useEffect(() => {
    if (isVisible && triggerRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Initial positioning (will be adjusted after tooltip renders)
      let top = triggerRect.bottom + 8;
      let left = triggerRect.left + triggerRect.width / 2;

      // Adjust if tooltip would go off screen horizontally
      const estimatedWidth = 320;
      if (left - estimatedWidth / 2 < 8) {
        left = 8 + estimatedWidth / 2;
      } else if (left + estimatedWidth / 2 > viewportWidth - 8) {
        left = viewportWidth - 8 - estimatedWidth / 2;
      }

      // If tooltip would go below viewport, show above instead
      const estimatedHeight = 200;
      if (top + estimatedHeight > viewportHeight - 8) {
        top = triggerRect.top - estimatedHeight - 8;
        if (top < 8) {
          top = 8;
        }
      }

      setPosition({ top, left });
    }
  }, [isVisible]);

  const handleMouseEnter = () => {
    setIsVisible(true);
  };

  const handleMouseLeave = () => {
    setIsVisible(false);
  };

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="relative"
        aria-describedby={isVisible ? tooltipId : undefined}
      >
        {children}
      </div>
      {isVisible && (
        <div
          ref={tooltipRef}
          id={tooltipId}
          role="tooltip"
          className="fixed z-50 bg-gray-900 dark:bg-gray-800 text-white dark:text-gray-100 rounded-lg shadow-xl p-4 max-w-sm border border-gray-700"
          style={{
            top: `${position.top}px`,
            left: `${position.left}px`,
            transform: 'translateX(-50%)',
            pointerEvents: 'none',
          }}
        >
          <div className="space-y-2 text-sm">
            <div>
              <span className="font-semibold text-blue-400">Datakälla:</span>
              <p className="mt-1 text-gray-300">{metadata.dataSource}</p>
            </div>
            {metadata.formula && (
              <div>
                <span className="font-semibold text-green-400">Formel:</span>
                <p className="mt-1 text-gray-300">{metadata.formula}</p>
              </div>
            )}
            {metadata.conditions && metadata.conditions.length > 0 && (
              <div>
                <span className="font-semibold text-yellow-400">Villkor:</span>
                <ul className="mt-1 list-disc list-inside space-y-1 text-gray-300">
                  {metadata.conditions.map((condition, index) => (
                    <li key={index} className="text-xs">{condition}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

