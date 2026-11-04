import React from 'react';
import { ChevronDown } from 'lucide-react';
import { describedBy, FieldLabel, FieldMessages, fieldClasses } from './Input';

const pad = (n: number) => String(n).padStart(2, '0');

const HOURS = Array.from({ length: 24 }, (_, i) => pad(i));
// Cada 5 minutos, para cargar más rápido
const MINUTES = Array.from({ length: 12 }, (_, i) => pad(i * 5));

export interface TimeFieldProps {
  label?: string;
  /** Hora "HH:MM" (24 horas) o vacía. */
  value: string;
  /** Mismo contrato que un input: recibe "HH:MM", o vacío si no hay hora. */
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  /** Permite dejarla vacía (opción "Sin hora"). */
  optional?: boolean;
  disabled?: boolean;
  id?: string;
}

/**
 * Hora de 24 horas con dos desplegables, igual en cualquier navegador (el campo nativo usa AM/PM
 * según el idioma del sistema). Los minutos van cada 5; al elegir la hora, los minutos quedan en 00.
 */
export const TimeField: React.FC<TimeFieldProps> = ({ label, value, onChange, error, optional, disabled, id }) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
  const [hour, minute] = value ? value.slice(0, 5).split(':') : ['', ''];

  // Una hora guardada con minutos fuera de los intervalos (por ejemplo, cargada desde Excel) se conserva
  const minutes = minute && !MINUTES.includes(minute) ? [...MINUTES, minute].sort() : MINUTES;

  const emit = (time: string) => onChange?.({ target: { value: time } } as React.ChangeEvent<HTMLInputElement>);

  const selectClass = `${fieldClasses(error)} appearance-none pr-8 tabular-nums cursor-pointer`;
  const chevron = <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" aria-hidden />;

  return (
    <div className="w-full">
      {label && (
        <FieldLabel htmlFor={inputId} optional={optional}>
          {label}
        </FieldLabel>
      )}
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1">
          <select
            id={inputId}
            aria-label={label ? `${label}: hora` : 'Hora'}
            value={hour}
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy(inputId, undefined, error)}
            onChange={(e) => emit(e.target.value ? `${e.target.value}:${minute || '00'}` : '')}
            className={selectClass}
          >
            <option value="" disabled={!optional}>
              {optional ? 'Sin hora' : 'hh'}
            </option>
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
          {chevron}
        </div>
        <span className="text-ink-muted font-medium" aria-hidden>
          :
        </span>
        <div className="relative flex-1">
          <select
            aria-label={label ? `${label}: minutos` : 'Minutos'}
            value={minute}
            disabled={disabled || !hour}
            onChange={(e) => emit(`${hour}:${e.target.value}`)}
            className={selectClass}
          >
            <option value="" disabled>
              mm
            </option>
            {minutes.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          {chevron}
        </div>
      </div>
      <FieldMessages id={inputId} error={error} />
    </div>
  );
};
