import React, { InputHTMLAttributes, forwardRef } from 'react';

export interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: string;
  helperText?: string;
}

const Radio = forwardRef<HTMLInputElement, RadioProps>(
  ({ label, error, helperText, className = '', id, ...props }, ref) => {
    const radioId = id || `radio-${Math.random().toString(36).substr(2, 9)}`;

    return (
      <div className={className}>
        <div className="flex items-start">
          <div className="flex items-center h-5">
            <input
              ref={ref}
              id={radioId}
              type="radio"
              className="w-4 h-4 text-primary-600 border-secondary-300 focus:ring-primary-500 focus:ring-2 transition-all duration-base disabled:opacity-50 disabled:cursor-not-allowed dark:border-secondary-600 dark:bg-gray-800"
              aria-invalid={error ? 'true' : 'false'}
              aria-describedby={
                error
                  ? `${radioId}-error`
                  : helperText
                  ? `${radioId}-helper`
                  : undefined
              }
              {...props}
            />
          </div>
          {label && (
            <div className="ml-3 text-sm">
              <label
                htmlFor={radioId}
                className="font-medium text-gray-700 dark:text-gray-300 cursor-pointer"
              >
                {label}
                {props.required && (
                  <span className="text-error-500 ml-1" aria-label="required">
                    *
                  </span>
                )}
              </label>
            </div>
          )}
        </div>
        {error && (
          <p
            id={`${radioId}-error`}
            className="mt-1.5 text-sm text-error-600 dark:text-error-400"
            role="alert"
          >
            {error}
          </p>
        )}
        {helperText && !error && (
          <p
            id={`${radioId}-helper`}
            className="mt-1.5 text-sm text-secondary-500 dark:text-secondary-400"
          >
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Radio.displayName = 'Radio';

export interface RadioGroupProps {
  label?: string;
  error?: string;
  helperText?: string;
  children: React.ReactNode;
  className?: string;
}

export const RadioGroup: React.FC<RadioGroupProps> = ({
  label,
  error,
  helperText,
  children,
  className = '',
}) => {
  const groupId = `radio-group-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className={className} role="radiogroup" aria-labelledby={label ? `${groupId}-label` : undefined}>
      {label && (
        <label
          id={`${groupId}-label`}
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          {label}
        </label>
      )}
      <div className="space-y-2">{children}</div>
      {error && (
        <p className="mt-1.5 text-sm text-error-600 dark:text-error-400" role="alert">
          {error}
        </p>
      )}
      {helperText && !error && (
        <p className="mt-1.5 text-sm text-secondary-500 dark:text-secondary-400">
          {helperText}
        </p>
      )}
    </div>
  );
};

export default Radio;
