interface ProgressIndicatorProps {
  progress?: number;
  isLoading?: boolean;
  label?: string;
  estimatedTimeRemaining?: number; // milliseconds
  showPercentage?: boolean;
}

export default function ProgressIndicator({
  progress,
  isLoading = false,
  label,
  estimatedTimeRemaining,
  showPercentage = true,
}: ProgressIndicatorProps) {
  if (!isLoading && progress === undefined) {
    return null;
  }

  const formatTime = (ms: number): string => {
    if (ms < 1000) {
      return '< 1s';
    }
    const seconds = Math.ceil(ms / 1000);
    if (seconds < 60) {
      return `~${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `~${minutes}m ${remainingSeconds}s` : `~${minutes}m`;
  };

  const displayProgress = isLoading ? 0 : (progress || 0);
  const displayLabel = label || (showPercentage ? `${Math.round(displayProgress)}%` : '');

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1">
        {displayLabel && (
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
            {displayLabel}
          </span>
        )}
        {estimatedTimeRemaining !== undefined && estimatedTimeRemaining > 0 && (
          <span className="text-xs text-gray-600 dark:text-gray-300">
            {formatTime(estimatedTimeRemaining)} kvar
          </span>
        )}
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ease-out ${
            isLoading
              ? 'bg-blue-600 dark:bg-blue-500 animate-pulse'
              : displayProgress < 50
              ? 'bg-red-500 dark:bg-red-400'
              : displayProgress < 80
              ? 'bg-yellow-500 dark:bg-yellow-400'
              : 'bg-green-500 dark:bg-green-400'
          }`}
          style={{
            width: isLoading ? '100%' : `${Math.min(100, Math.max(0, displayProgress))}%`,
          }}
        />
      </div>
    </div>
  );
}

