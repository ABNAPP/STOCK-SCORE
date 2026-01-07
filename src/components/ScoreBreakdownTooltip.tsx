import { useState, useRef, useEffect } from 'react';
import { ScoreBreakdown } from '../utils/calculateScoreDetailed';

interface ScoreBreakdownTooltipProps {
  breakdown: ScoreBreakdown;
  children: React.ReactNode;
}

export default function ScoreBreakdownTooltip({ breakdown, children }: ScoreBreakdownTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isVisible && triggerRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Initial positioning (will be adjusted after tooltip renders)
      let top = triggerRect.bottom + 8;
      let left = triggerRect.left + triggerRect.width / 2;

      // Adjust if tooltip would go off screen horizontally
      const estimatedWidth = 400; // Estimated width for the breakdown tooltip
      if (left - estimatedWidth / 2 < 8) {
        left = 8 + estimatedWidth / 2;
      } else if (left + estimatedWidth / 2 > viewportWidth - 8) {
        left = viewportWidth - 8 - estimatedWidth / 2;
      }

      // If tooltip would go below viewport, show above instead
      const estimatedHeight = 500; // rough estimate for breakdown tooltip
      if (top + estimatedHeight > viewportHeight - 8) {
        top = triggerRect.top - estimatedHeight - 8;
        if (top < 8) {
          top = 8; // Fallback to top of viewport
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

  const getColorIndicator = (color: string) => {
    switch (color) {
      case 'GREEN':
        return <span className="text-green-500">●</span>;
      case 'BLUE':
        return <span className="text-blue-500">●</span>;
      case 'RED':
        return <span className="text-red-500">●</span>;
      case 'BLANK':
        return <span className="text-gray-400">○</span>;
      default:
        return <span className="text-gray-400">○</span>;
    }
  };

  const getMultiplierText = (factor: number) => {
    if (factor === 1.00) return '100%';
    if (factor === 0.70) return '70%';
    return '0%';
  };

  const fundamentalItems = breakdown.items.filter(item => item.category === 'Fundamental');
  const technicalItems = breakdown.items.filter(item => item.category === 'Technical');

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="relative cursor-help"
      >
        {children}
      </div>
      {isVisible && (
        <div
          ref={tooltipRef}
          className="fixed z-50 bg-gray-900 dark:bg-gray-800 text-white dark:text-gray-100 rounded-lg shadow-xl p-4 max-w-md border border-gray-700"
          style={{
            top: `${position.top}px`,
            left: `${position.left}px`,
            transform: 'translateX(-50%)',
            pointerEvents: 'none',
          }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div className="space-y-4 text-sm">
            {/* Total Score Header */}
            <div className="border-b border-gray-700 pb-2">
              <div className="text-xs text-gray-400 mb-1">Total Score</div>
              <div className="text-2xl font-bold text-white">{breakdown.totalScore.toFixed(1)}</div>
            </div>

            {/* Fundamental Section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-blue-400">Fundamental</span>
                <span className="text-gray-300 text-xs">({breakdown.fundamentalTotal.toFixed(1)} / 50p)</span>
              </div>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {fundamentalItems.map((item, index) => (
                  <div key={index} className="flex items-center justify-between text-xs py-1 border-b border-gray-800 last:border-0">
                    <div className="flex items-center space-x-2 flex-1 min-w-0">
                      <span className="flex-shrink-0">{getColorIndicator(item.color)}</span>
                      <span className="text-gray-300 truncate">{item.metric}</span>
                    </div>
                    <div className="flex items-center space-x-3 flex-shrink-0 ml-2">
                      <span className="text-gray-400 w-8 text-right">v:{item.weight}</span>
                      <span className="text-gray-400 w-10 text-right">{getMultiplierText(item.factor)}</span>
                      <span className="text-gray-200 font-medium w-12 text-right">{item.points.toFixed(1)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Technical Section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-green-400">Technical</span>
                <span className="text-gray-300 text-xs">({breakdown.technicalTotal.toFixed(1)} / 50p)</span>
              </div>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {technicalItems.map((item, index) => (
                  <div key={index} className="flex items-center justify-between text-xs py-1 border-b border-gray-800 last:border-0">
                    <div className="flex items-center space-x-2 flex-1 min-w-0">
                      <span className="flex-shrink-0">{getColorIndicator(item.color)}</span>
                      <span className="text-gray-300 truncate">{item.metric}</span>
                    </div>
                    <div className="flex items-center space-x-3 flex-shrink-0 ml-2">
                      <span className="text-gray-400 w-8 text-right">v:{item.weight}</span>
                      <span className="text-gray-400 w-10 text-right">{getMultiplierText(item.factor)}</span>
                      <span className="text-gray-200 font-medium w-12 text-right">{item.points.toFixed(1)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Legend */}
            <div className="border-t border-gray-700 pt-2 text-xs text-gray-400">
              <div className="flex items-center space-x-4">
                <span>v = vikt</span>
                <span>● = färg</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

