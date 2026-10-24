import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  /** Marca el campo como opcional; los demás se entienden obligatorios. */
  optional?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      optional,
      leftIcon,
      rightIcon,
      className = '',
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-ink mb-1.5"
          >
            {label}
            {optional && <span className="font-normal text-ink-muted"> (opcional)</span>}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-ink-muted">
              {leftIcon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            className={`w-full rounded-lg border bg-white px-3 py-2 text-sm text-ink placeholder-ink-faint transition-colors focus:outline-none focus:ring-2 focus:ring-accent-light focus:border-primary disabled:bg-fill-neutral disabled:text-ink-muted disabled:cursor-not-allowed ${
              leftIcon ? 'pl-9' : ''
            } ${rightIcon ? 'pr-10' : ''} ${
              error ? 'border-danger' : 'border-line'
            } ${className}`}
            {...props}
          />
          {rightIcon && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
              {rightIcon}
            </div>
          )}
        </div>
        {/* La ayuda queda siempre a la vista (por ejemplo, el dominio para copiar) y el error va debajo */}
        {helperText && <p className="mt-1 text-xs text-ink-muted">{helperText}</p>}
        {error && <p className="mt-1 text-xs text-danger font-medium">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
