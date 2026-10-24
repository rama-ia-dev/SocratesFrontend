import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { describedBy, FieldLabel, FieldMessages, fieldClasses } from './Input';

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const WEEKDAYS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];

const pad = (n: number) => String(n).padStart(2, '0');
const toIso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const isoToText = (iso: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');

/** "dd/mm/aaaa" completo y existente → ISO; si no, null. */
const textToIso = (text: string): string | null => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (!m) return null;
  const [d, mo, y] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
  const date = new Date(y, mo, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo || date.getDate() !== d) return null;
  return toIso(y, mo, d);
};

/** Pone las barras mientras se escribe: "05031990" → "05/03/1990". */
const maskDigits = (raw: string) => {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

export interface DateFieldProps {
  label?: string;
  /** Fecha en formato ISO (aaaa-mm-dd) o vacía. */
  value: string;
  /** Mismo contrato que un input: recibe la fecha ISO, o vacío mientras está incompleta. */
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: () => void;
  error?: string;
  helperText?: string;
  optional?: boolean;
  min?: string;
  max?: string;
  disabled?: boolean;
  id?: string;
}

/**
 * Fecha: se escribe dd/mm/aaaa (las barras se ponen solas) o se elige en el calendario, que
 * permite saltar de mes y de año sin recorrerlos uno por uno.
 */
export const DateField: React.FC<DateFieldProps> = ({
  label,
  value,
  onChange,
  onBlur,
  error,
  helperText,
  optional,
  min,
  max,
  disabled,
  id,
}) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
  const [text, setText] = useState(isoToText(value));
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Si el valor cambia desde afuera (por ejemplo, al abrir el diálogo con otro alumno)
  useEffect(() => {
    if (value !== (textToIso(text) ?? '')) setText(isoToText(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const emit = (iso: string) =>
    onChange?.({ target: { value: iso } } as React.ChangeEvent<HTMLInputElement>);

  // Una fecha completa que no existe (31/02) se marca acá; el resto lo valida el formulario.
  // Mientras se está escribiendo no se muestra ningún error: todavía no es una fecha.
  const [focused, setFocused] = useState(false);
  const typing = focused && text.length > 0 && text.length < 10;
  const localError = text.length === 10 && !textToIso(text) ? 'Esa fecha no existe' : undefined;
  const shownError = typing ? undefined : (localError ?? error);

  // Mes que muestra el calendario: el de la fecha elegida, o el del máximo permitido
  const anchor = value || max || toIso(new Date().getFullYear(), new Date().getMonth(), 1);
  const [viewYear, setViewYear] = useState(Number(anchor.slice(0, 4)));
  const [viewMonth, setViewMonth] = useState(Number(anchor.slice(5, 7)) - 1);

  const openCalendar = () => {
    const a = value || max || anchor;
    setViewYear(Number(a.slice(0, 4)));
    setViewMonth(Number(a.slice(5, 7)) - 1);
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const minYear = min ? Number(min.slice(0, 4)) : new Date().getFullYear() - 100;
  const maxYear = max ? Number(max.slice(0, 4)) : new Date().getFullYear() + 5;
  const years = useMemo(() => {
    const list: number[] = [];
    for (let y = maxYear; y >= minYear; y--) list.push(y);
    return list;
  }, [minYear, maxYear]);

  const isOutOfRange = (iso: string) => Boolean((min && iso < min) || (max && iso > max));

  const shiftMonth = (delta: number) => {
    const d = new Date(viewYear, viewMonth + delta, 1);
    if (d.getFullYear() < minYear || d.getFullYear() > maxYear) return;
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  // Grilla del mes empezando el lunes
  const firstWeekday = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const pick = (day: number) => {
    const iso = toIso(viewYear, viewMonth, day);
    setText(isoToText(iso));
    emit(iso);
    setOpen(false);
    onBlur?.();
  };

  const today = toIso(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
  const selectClass =
    'h-8 rounded-md border border-line bg-white px-2 text-sm text-ink cursor-pointer focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/15';

  return (
    <div className="w-full" ref={wrapRef}>
      {label && (
        <FieldLabel htmlFor={inputId} optional={optional}>
          {label}
        </FieldLabel>
      )}
      <div className="relative">
        <input
          id={inputId}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="dd/mm/aaaa"
          value={text}
          disabled={disabled}
          aria-invalid={shownError ? true : undefined}
          aria-describedby={describedBy(inputId, helperText, shownError)}
          onChange={(e) => {
            const next = maskDigits(e.target.value);
            setText(next);
            emit(textToIso(next) ?? '');
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            onBlur?.();
          }}
          className={`${fieldClasses(shownError)} pr-10 tabular-nums`}
        />
        <button
          type="button"
          onClick={() => (open ? setOpen(false) : openCalendar())}
          disabled={disabled}
          className="absolute inset-y-0 right-0 px-3 flex items-center text-ink-muted hover:text-ink disabled:opacity-50 cursor-pointer"
          aria-label="Elegir en el calendario"
          aria-expanded={open}
        >
          <CalendarDays className="w-4 h-4" />
        </button>

        {open && (
          <div
            role="dialog"
            aria-label="Calendario"
            className="absolute left-0 top-full mt-1.5 z-50 w-[296px] rounded-xl border border-line bg-white p-3 shadow-[0_12px_32px_-8px_rgba(6,26,61,0.25)] pop-in"
          >
            <div className="flex items-center gap-1.5 mb-2">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                className="p-1.5 rounded-md text-ink-muted hover:text-ink hover:bg-fill-neutral cursor-pointer"
                aria-label="Mes anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <select
                aria-label="Mes"
                value={viewMonth}
                onChange={(e) => setViewMonth(Number(e.target.value))}
                className={`${selectClass} flex-1`}
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={i}>
                    {m}
                  </option>
                ))}
              </select>
              <select
                aria-label="Año"
                value={viewYear}
                onChange={(e) => setViewYear(Number(e.target.value))}
                className={selectClass}
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                className="p-1.5 rounded-md text-ink-muted hover:text-ink hover:bg-fill-neutral cursor-pointer"
                aria-label="Mes siguiente"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-7 text-center text-[11px] font-medium text-ink-muted mb-1">
              {WEEKDAYS.map((d) => (
                <span key={d} className="py-1">
                  {d}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {cells.map((day, i) => {
                if (day === null) return <span key={`v${i}`} />;
                const iso = toIso(viewYear, viewMonth, day);
                const selected = iso === value;
                const disabledDay = isOutOfRange(iso);
                return (
                  <button
                    key={iso}
                    type="button"
                    disabled={disabledDay}
                    onClick={() => pick(day)}
                    aria-pressed={selected}
                    aria-label={`${day} de ${MONTHS[viewMonth].toLowerCase()} de ${viewYear}`}
                    className={`h-9 rounded-lg text-sm tabular-nums transition-colors cursor-pointer disabled:cursor-not-allowed disabled:text-ink-faint/60 ${
                      selected
                        ? 'bg-primary text-white font-semibold'
                        : iso === today
                          ? 'text-primary font-semibold hover:bg-tint'
                          : 'text-ink hover:bg-fill-neutral'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <FieldMessages id={inputId} helperText={helperText} error={shownError} />
    </div>
  );
};
