import React from 'react';
import { ChevronDown } from 'lucide-react';
import { describedBy, FieldLabel, FieldMessages, fieldClasses } from './Input';

export interface SelectOption {
  value: string | number;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  /** Marca el campo como opcional; los demás se entienden obligatorios. */
  optional?: boolean;
  options?: SelectOption[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      error,
      helperText,
      optional,
      options,
      children,
      className = '',
      id,
      ...props
    },
    ref
  ) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full">
        {label && (
          <FieldLabel htmlFor={selectId} optional={optional}>
            {label}
          </FieldLabel>
        )}
        <div className="relative">
          <select
            id={selectId}
            ref={ref}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy(selectId, error ? undefined : helperText, error)}
            className={`${fieldClasses(error)} appearance-none pr-10 cursor-pointer ${className}`}
            {...props}
          >
            {options
              ? options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))
              : children}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-ink-muted">
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>
        {/* En un desplegable el error reemplaza a la ayuda, como hasta ahora */}
        <FieldMessages id={selectId} helperText={error ? undefined : helperText} error={error} />
      </div>
    );
  }
);

Select.displayName = 'Select';
