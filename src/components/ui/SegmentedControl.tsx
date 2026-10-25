import React from 'react';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

/** Filtro de pocas opciones a la vista: se ve qué está elegido sin abrir un desplegable. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  className = '',
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Nombre del grupo para lectores de pantalla. */
  label: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-fill-neutral border border-line ${className}`}
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            className={`h-8 px-3 rounded-md text-sm transition-colors duration-150 cursor-pointer whitespace-nowrap ${
              selected
                ? 'bg-white text-ink font-medium shadow-[0_1px_2px_rgba(15,31,61,0.08)]'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
