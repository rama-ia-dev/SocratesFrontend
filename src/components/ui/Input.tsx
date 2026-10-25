import React from 'react';
import { AlertCircle } from 'lucide-react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  /** Marca el campo como opcional; los demás se entienden obligatorios. */
  optional?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

/** Borde, foco y error de un campo: el mismo en campos de texto, desplegables y fechas. */
export const fieldClasses = (error?: string) =>
  `w-full h-10 rounded-lg border bg-white px-3 text-sm text-ink placeholder-ink-faint transition-[border-color,box-shadow] duration-150 focus:outline-none disabled:bg-fill-neutral disabled:text-ink-muted disabled:cursor-not-allowed ${
    error
      ? 'border-danger focus:ring-[3px] focus:ring-danger/15'
      : 'border-line hover:border-line-neutral-strong focus:border-primary focus:ring-[3px] focus:ring-primary/15'
  }`;

export const FieldLabel: React.FC<{ htmlFor?: string; optional?: boolean; children: React.ReactNode }> = ({
  htmlFor,
  optional,
  children,
}) => (
  <label htmlFor={htmlFor} className="block text-sm font-medium text-ink mb-1.5">
    {children}
    {optional && <span className="font-normal text-ink-muted"> (opcional)</span>}
  </label>
);

/** La ayuda queda siempre a la vista (por ejemplo, el dominio para copiar) y el error va debajo. */
export const FieldMessages: React.FC<{ id?: string; helperText?: string; error?: string }> = ({
  id,
  helperText,
  error,
}) => (
  <>
    {helperText && (
      <p id={id ? `${id}-ayuda` : undefined} className="mt-1.5 text-xs text-ink-muted">
        {helperText}
      </p>
    )}
    {error && (
      <p id={id ? `${id}-error` : undefined} className="mt-1.5 flex items-start gap-1.5 text-xs font-medium text-danger">
        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" aria-hidden="true" />
        <span>{error}</span>
      </p>
    )}
  </>
);

export const describedBy = (id: string | undefined, helperText?: string, error?: string) =>
  id ? [helperText && `${id}-ayuda`, error && `${id}-error`].filter(Boolean).join(' ') || undefined : undefined;

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
          <FieldLabel htmlFor={inputId} optional={optional}>
            {label}
          </FieldLabel>
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
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy(inputId, helperText, error)}
            className={`${fieldClasses(error)} ${leftIcon ? 'pl-9' : ''} ${rightIcon ? 'pr-10' : ''} ${className}`}
            {...props}
          />
          {rightIcon && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
              {rightIcon}
            </div>
          )}
        </div>
        <FieldMessages id={inputId} helperText={helperText} error={error} />
      </div>
    );
  }
);

Input.displayName = 'Input';
