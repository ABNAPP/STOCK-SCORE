/** Optional visual connector between sections (e.g. arrow or line). */
interface ConnectionArrowProps {
  direction?: 'right' | 'down';
  className?: string;
}

export default function ConnectionArrow({
  direction = 'right',
  className = '',
}: ConnectionArrowProps) {
  if (direction === 'down') {
    return (
      <div
        className={`flex justify-center py-1 ${className}`}
        aria-hidden
      >
        <span className="text-gray-400 dark:text-gray-500">↓</span>
      </div>
    );
  }
  return (
    <div
      className={`flex items-center justify-center py-1 ${className}`}
      aria-hidden
    >
      <span className="text-gray-400 dark:text-gray-500">→</span>
    </div>
  );
}
