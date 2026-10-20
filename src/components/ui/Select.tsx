import React from 'react';
import { ChevronDown } from 'lucide-react';

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
          <label
            htmlFor={selectId}
            className="block text-sm font-medium text-[#0F1F3D] mb-1.5"
          >
            {label}
            {optional && <span className="font-normal text-[#51607A]"> (opcional)</span>}
          </label>
        )}
        <div className="relative">
          <select
            id={selectId}
            ref={ref}
            className={`w-full appearance-none rounded-lg border bg-white px-3 py-2 pr-10 text-sm text-[#0F1F3D] transition-colors focus:outline-none focus:ring-2 focus:ring-[#BAE6FD] focus:border-[#1D4ED8] disabled:bg-[#F1F5F9] disabled:text-[#51607A] disabled:cursor-not-allowed ${
              error ? 'border-[#B91C1C]' : 'border-[#D6E4F7]'
            } ${className}`}
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
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-[#51607A]">
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>
        {error ? (
          <p className="mt-1 text-xs text-[#B91C1C] font-medium">{error}</p>
        ) : helperText ? (
          <p className="mt-1 text-xs text-[#51607A]">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Select.displayName = 'Select';
