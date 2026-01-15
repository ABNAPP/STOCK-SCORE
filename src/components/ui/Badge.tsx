import React, { HTMLAttributes } from 'react';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'primary' | 'success' | 'error' | 'warning' | 'info';
  size?: 'sm' | 'md' | 'lg';
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  size = 'md',
  dot = false,
  className = '',
  children,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center font-medium rounded-full';

  const variantStyles = {
    default:
      'bg-secondary-100 text-secondary-800 dark:bg-secondary-800 dark:text-secondary-200',
    primary:
      'bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200',
    success:
      'bg-success-100 text-success-800 dark:bg-success-900 dark:text-success-200',
    error: 'bg-error-100 text-error-800 dark:bg-error-900 dark:text-error-200',
    warning:
      'bg-warning-100 text-warning-800 dark:bg-warning-900 dark:text-warning-200',
    info: 'bg-info-100 text-info-800 dark:bg-info-900 dark:text-info-200',
  };

  const sizeStyles = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-0.5 text-sm',
    lg: 'px-3 py-1 text-base',
  };

  const dotSizeStyles = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-2.5 h-2.5',
  };

  const combinedClassName = `${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`;

  return (
    <span className={combinedClassName} {...props}>
      {dot && (
        <span
          className={`${dotSizeStyles[size]} rounded-full mr-1.5 ${
            variant === 'default'
              ? 'bg-secondary-400 dark:bg-secondary-500'
              : variant === 'primary'
              ? 'bg-primary-400 dark:bg-primary-500'
              : variant === 'success'
              ? 'bg-success-400 dark:bg-success-500'
              : variant === 'error'
              ? 'bg-error-400 dark:bg-error-500'
              : variant === 'warning'
              ? 'bg-warning-400 dark:bg-warning-500'
              : 'bg-info-400 dark:bg-info-500'
          }`}
        />
      )}
      {children}
    </span>
  );
};

export default Badge;
