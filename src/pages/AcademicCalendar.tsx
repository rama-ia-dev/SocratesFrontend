import React, { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '../lib/api';
import { fetchAll } from '../lib/pagination';
import { holidaysOf, toIso } from '../lib/holidays';
import { SectionYearPublic } from '../types/api';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { Input } from '../components/ui/Input';
import { DateField } from '../components/ui/DateField';
import { Modal } from '../components/ui/Modal';
import { Alert } from '../components/ui/Alert';
import { EmptyState } from '../components/ui/EmptyState';
import { Table, TableHeader, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { useToast } from '../components/ui/Toast';
import {
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Download,
  FileUp,
  SearchX,
  Trash2,
} from 'lucide-react';

// Boceto de SCRUM-12: todavía no hay backend de calendario. Los eventos se guardan solo en este
// navegador para poder mostrar la pantalla.
const STORAGE_KEY = 'socrates:calendar-draft';

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const WEEKDAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

type EventType = 'partial_exam' | 'final_exam' | 'delivery' | 'oral' | 'other';

// Colores validados para daltonismo; "Otro" queda neutro. El tipo siempre va también escrito.
const EVENT_TYPES: { value: EventType; label: string; dot: string; chip: string }[] = [
  { value: 'partial_exam', label: 'Examen parcial', dot: 'bg-[#2a78d6]', chip: 'border-l-[#2a78d6]' },
  { value: 'final_exam', label: 'Examen final', dot: 'bg-[#eb6834]', chip: 'border-l-[#eb6834]' },
  { value: 'delivery', label: 'Entrega de documentación', dot: 'bg-[#1baf7a]', chip: 'border-l-[#1baf7a]' },
  { value: 'oral', label: 'Presentación oral', dot: 'bg-[#6250d6]', chip: 'border-l-[#6250d6]' },
  { value: 'other', label: 'Otro', dot: 'bg-[#64748B]', chip: 'border-l-[#64748B]' },
];
const typeOf = (value: EventType) => EVENT_TYPES.find((t) => t.value === value)!;

type CalendarEvent = {
  id: string;
  date: string; // ISO
  type: EventType;
  title: string;
  // null: el evento es para todas las comisiones
  id_section_year: number | null;
  section_label: string | null;
};

type EventDraft = { date: string; type: EventType; title: string; id_section_year: string };

const today = new Date();
const todayIso = toIso(today.getFullYear(), today.getMonth(), today.getDate());

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const isoToText = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

const weekdayOf = (iso: string) =>
  new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))).getDay();

// Por qué un día no admite eventos (null: se puede elegir). El sábado se puede: se cursa y se rinde.
const blockedReason = (iso: string): string | null => {
  const holiday = holidaysOf(Number(iso.slice(0, 4)))[iso];
  if (holiday) return `Feriado: ${holiday}`;
  if (weekdayOf(iso) === 0) return 'Domingo: no hay actividad en la facultad';
  return null;
};

const loadDraft = (): CalendarEvent[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CalendarEvent[]) : [];
  } catch {
    return [];
  }
};

// Archivo de eventos: Fecha; Tipo; Título; Comisión (vacía = todas). Acepta ; , o tabulación.
const normalize = (text: string) =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

const TYPE_ALIASES: Record<string, EventType> = {
  'examen parcial': 'partial_exam',
  parcial: 'partial_exam',
  'examen final': 'final_exam',
  final: 'final_exam',
  'entrega de documentacion': 'delivery',
  entrega: 'delivery',
  'presentacion oral': 'oral',
  presentacion: 'oral',
  otro: 'other',
};

const parseDate = (text: string): string | null => {
  const t = text.trim();
  let y: number, m: number, d: number;
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (dmy) [d, m, y] = [Number(dmy[1]), Number(dmy[2]), Number(dmy[3])];
  else if (ymd) [y, m, d] = [Number(ymd[1]), Number(ymd[2]), Number(ymd[3])];
  else return null;
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return toIso(y, m - 1, d);
};

type ImportRow = { line: number; event?: CalendarEvent; raw: string; error?: string };

const parseFile = (text: string, sectionYears: SectionYearPublic[]): ImportRow[] => {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const rows: ImportRow[] = [];
  lines.forEach((line, index) => {
    if (!line) return;
    const sep = line.includes('\t') ? '\t' : line.includes(';') ? ';' : ',';
    const cells = line.split(sep).map((c) => c.trim().replace(/^"|"$/g, ''));
    if (index === 0 && normalize(cells[0]) === 'fecha') return; // encabezado
    const [dateText = '', typeText = '', title = '', section = ''] = cells;
    const row: ImportRow = { line: index + 1, raw: line };
    const date = parseDate(dateText);
    const type = TYPE_ALIASES[normalize(typeText)];
    if (!date) row.error = `Fecha inválida: "${dateText}" (use dd/mm/aaaa)`;
    else if (blockedReason(date)) row.error = blockedReason(date)!;
    else if (!type) row.error = `Tipo desconocido: "${typeText}"`;
    else if (!title) row.error = 'Falta el título';
    else {
      let sy: SectionYearPublic | undefined;
      if (section) {
        sy = sectionYears.find(
          (s) => s.year === Number(date.slice(0, 4)) && normalize(s.section_name) === normalize(section)
        );
        if (!sy) row.error = `No existe la comisión ${section.toUpperCase()} en ${date.slice(0, 4)}`;
      }
      if (!row.error) {
        row.event = {
          id: newId(),
          date,
          type,
          title,
          id_section_year: sy?.id_section_year ?? null,
          section_label: sy?.section_name ?? null,
        };
      }
    }
    rows.push(row);
  });
  return rows;
};

const TEMPLATE =
  'Fecha;Tipo;Título;Comisión\n' +
  '15/04/2026;Examen parcial;Primer parcial;3K1\n' +
  '20/05/2026;Entrega de documentación;Entrega de la propuesta;\n' +
  '06/06/2026;Presentación oral;Presentación de avances;3K2\n';

export const AcademicCalendar: React.FC = () => {
  const { success: toastSuccess } = useToast();

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [events, setEvents] = useState<CalendarEvent[]>(loadDraft);
  const [sectionYears, setSectionYears] = useState<SectionYearPublic[]>([]);

  // Diálogo de evento nuevo
  const [isEventOpen, setIsEventOpen] = useState(false);
  const [draft, setDraft] = useState<EventDraft>({ date: '', type: 'partial_exam', title: '', id_section_year: '' });
  const [draftError, setDraftError] = useState<string | null>(null);

  // Diálogo de carga por archivo
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<ImportRow[] | null>(null);
  const [importFileName, setImportFileName] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Filtros del listado
  const [listType, setListType] = useState<EventType | ''>('');
  const [listMonth, setListMonth] = useState('');
  const [listYear, setListYear] = useState(String(today.getFullYear()));

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
    } catch {
      // Sin almacenamiento, el boceto funciona igual hasta recargar
    }
  }, [events]);

  useEffect(() => {
    fetchAll<SectionYearPublic>((o) => api.getSectionYears({ limit: 100, offset: o }))
      .then(setSectionYears)
      .catch(() => setSectionYears([]));
  }, []);

  const yearOptions = useMemo(() => {
    const years = new Set<number>([today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1]);
    sectionYears.forEach((sy) => years.add(sy.year));
    events.forEach((e) => years.add(Number(e.date.slice(0, 4))));
    years.add(viewYear);
    return [...years].sort((a, b) => b - a);
  }, [sectionYears, events, viewYear]);

  const holidays = useMemo(() => holidaysOf(viewYear), [viewYear]);

  // Semanas del mes, de lunes a domingo; los huecos antes del día 1 y después del último quedan vacíos
  const weeks = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const offset = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: (number | null)[] = [
      ...Array(offset).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
    while (cells.length % 7 !== 0) cells.push(null);
    const rows: (number | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [viewYear, viewMonth]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const e of events) (map[e.date] ??= []).push(e);
    return map;
  }, [events]);

  const moveMonth = (delta: number) => {
    const date = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(date.getFullYear());
    setViewMonth(date.getMonth());
  };

  const coursesOfYear = (year: number) =>
    sectionYears
      .filter((sy) => sy.year === year)
      .sort((a, b) => a.section_name.localeCompare(b.section_name, 'es'));

  const openNewEvent = (date = '') => {
    setDraft({ date, type: 'partial_exam', title: '', id_section_year: '' });
    setDraftError(null);
    setIsEventOpen(true);
  };

  const handleSaveEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.date) return setDraftError('Elija la fecha del evento');
    const reason = blockedReason(draft.date);
    if (reason) return setDraftError(`No se pueden cargar eventos ese día. ${reason}.`);
    if (!draft.title.trim()) return setDraftError('Escriba el título del evento');
    const sy = sectionYears.find((s) => String(s.id_section_year) === draft.id_section_year);
    setEvents((prev) => [
      ...prev,
      {
        id: newId(),
        date: draft.date,
        type: draft.type,
        title: draft.title.trim(),
        id_section_year: sy?.id_section_year ?? null,
        section_label: sy?.section_name ?? null,
      },
    ]);
    setIsEventOpen(false);
    toastSuccess(`Se cargó "${draft.title.trim()}" el ${isoToText(draft.date)}`);
  };

  const openImport = () => {
    setImportRows(null);
    setImportFileName('');
    setImportError(null);
    setIsImportOpen(true);
  };

  const handleFile = async (file: File) => {
    setImportFileName(file.name);
    setImportRows(null);
    if (!/\.(csv|txt)$/i.test(file.name)) {
      setImportError(
        'Por ahora se admiten archivos .csv o .txt. Desde Excel: Archivo › Guardar como › CSV.'
      );
      return;
    }
    setImportError(null);
    const rows = parseFile(await file.text(), sectionYears);
    if (rows.length === 0) setImportError('El archivo no tiene eventos');
    else setImportRows(rows);
  };

  const downloadTemplate = () => {
    // Con BOM, para que Excel abra bien los acentos
    const blob = new Blob(['﻿' + TEMPLATE], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'plantilla-calendario.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const importErrors = importRows?.filter((r) => r.error) ?? [];
  const importValid = importRows?.filter((r) => r.event) ?? [];

  // Todo o nada, como las demás cargas masivas del sistema
  const handleImport = () => {
    if (importErrors.length > 0 || importValid.length === 0) return;
    setEvents((prev) => [...prev, ...importValid.map((r) => r.event!)]);
    setIsImportOpen(false);
    toastSuccess(`Se cargaron ${importValid.length} eventos`);
    const first = importValid.map((r) => r.event!.date).sort()[0];
    setViewYear(Number(first.slice(0, 4)));
    setViewMonth(Number(first.slice(5, 7)) - 1);
  };

  const deleteEvent = (event: CalendarEvent) => {
    setEvents((prev) => prev.filter((e) => e.id !== event.id));
    toastSuccess(`Se eliminó "${event.title}"`);
  };

  const listed = events
    .filter(
      (e) =>
        (!listType || e.type === listType) &&
        (!listYear || e.date.startsWith(listYear)) &&
        (!listMonth || Number(e.date.slice(5, 7)) === Number(listMonth))
    )
    .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, 'es'));
  const hasListFilters = Boolean(listType || listMonth || listYear);

  const draftYear = draft.date ? Number(draft.date.slice(0, 4)) : null;

  return (
    <div>
      <PageHeader
        title="Calendario académico"
        subtitle="Exámenes, entregas y presentaciones de cada ciclo lectivo"
        action={
          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={openImport}>
              <FileUp className="w-4 h-4" />
              Cargar eventos desde un archivo
            </Button>
            <Button onClick={() => openNewEvent()}>
              <CalendarPlus className="w-4 h-4" />
              Cargar nuevo evento
            </Button>
          </div>
        }
      />

      <Alert tone="info" className="mb-4">
        Boceto: los eventos se guardan solo en este navegador hasta que exista el calendario en el
        backend. Los feriados son los nacionales; falta sumar los días sin actividad de la facultad.
      </Alert>

      {/* ===================== Calendario del mes ===================== */}
      <section className="rounded-xl border border-line bg-white">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-line">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => moveMonth(-1)} aria-label="Mes anterior">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <h2 className="w-40 text-center font-serif text-lg font-semibold text-navy">
              {MONTHS[viewMonth]} {viewYear}
            </h2>
            <Button variant="ghost" size="sm" onClick={() => moveMonth(1)} aria-label="Mes siguiente">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <div className="w-36">
              <Select
                aria-label="Mes"
                value={viewMonth}
                onChange={(e) => setViewMonth(Number(e.target.value))}
                options={MONTHS.map((m, i) => ({ value: i, label: m }))}
              />
            </div>
            <div className="w-28">
              <Select
                aria-label="Año"
                value={viewYear}
                onChange={(e) => setViewYear(Number(e.target.value))}
                options={yearOptions.map((y) => ({ value: y, label: String(y) }))}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setViewYear(today.getFullYear());
                setViewMonth(today.getMonth());
              }}
            >
              Hoy
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[720px]">
            <div className="grid grid-cols-7 border-b border-line">
              {WEEKDAYS.map((d, i) => (
                <div
                  key={d}
                  className={`px-2 py-2 text-xs font-semibold uppercase tracking-wide text-center ${
                    i >= 5 ? 'text-primary' : 'text-ink-muted'
                  }`}
                >
                  {d}
                </div>
              ))}
            </div>
            {weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 border-b border-line last:border-b-0">
                {week.map((day, di) => {
                  if (day === null) {
                    return <div key={di} className="min-h-28 bg-canvas/60 border-r border-line last:border-r-0" />;
                  }
                  const iso = toIso(viewYear, viewMonth, day);
                  const holiday = holidays[iso];
                  const isSunday = di === 6;
                  const isSaturday = di === 5;
                  const blocked = Boolean(holiday) || isSunday;
                  const dayEvents = eventsByDate[iso] ?? [];
                  const isToday = iso === todayIso;
                  const background = holiday
                    ? 'bg-danger-soft/60 bg-[repeating-linear-gradient(135deg,transparent_0_6px,rgba(185,28,28,0.06)_6px_12px)]'
                    : isSunday
                    ? 'bg-fill-neutral'
                    : isSaturday
                    ? 'bg-tint-soft'
                    : 'bg-white';
                  return (
                    <div
                      key={di}
                      role={blocked ? undefined : 'button'}
                      tabIndex={blocked ? undefined : 0}
                      aria-label={
                        blocked
                          ? `${day} de ${MONTHS[viewMonth]}: ${blockedReason(iso)}`
                          : `Cargar evento el ${day} de ${MONTHS[viewMonth]}`
                      }
                      title={blocked ? blockedReason(iso)! : 'Cargar un evento este día'}
                      onClick={() => !blocked && openNewEvent(iso)}
                      onKeyDown={(e) => {
                        if (!blocked && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault();
                          openNewEvent(iso);
                        }
                      }}
                      className={`group min-h-28 p-1.5 border-r border-line last:border-r-0 flex flex-col gap-1 ${background} ${
                        blocked ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-tint focus-visible:outline-2 focus-visible:outline-primary'
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        <span
                          className={`w-7 h-7 flex items-center justify-center rounded-full text-sm tabular-nums ${
                            isToday
                              ? 'bg-primary text-white font-semibold'
                              : holiday
                              ? 'text-danger font-semibold'
                              : isSunday
                              ? 'text-ink-subtle'
                              : isSaturday
                              ? 'text-primary'
                              : 'text-ink'
                          }`}
                        >
                          {day}
                        </span>
                        {!blocked && (
                          <CalendarPlus className="w-3.5 h-3.5 ml-auto text-ink-faint opacity-0 group-hover:opacity-100" />
                        )}
                      </div>
                      {holiday && (
                        <span className="text-[11px] leading-tight text-danger line-clamp-2">{holiday}</span>
                      )}
                      {dayEvents.slice(0, 3).map((ev) => (
                        <span
                          key={ev.id}
                          className={`block truncate rounded border-l-[3px] ${typeOf(ev.type).chip} bg-white px-1.5 py-0.5 text-[11px] text-ink shadow-[0_0_0_1px_var(--color-line)]`}
                          title={`${typeOf(ev.type).label}: ${ev.title}${ev.section_label ? ` (${ev.section_label})` : ''}`}
                        >
                          {ev.title}
                        </span>
                      ))}
                      {dayEvents.length > 3 && (
                        <span className="text-[11px] text-ink-muted">+{dayEvents.length - 3} más</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Referencias */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 border-t border-line text-xs text-ink-muted">
          {EVENT_TYPES.map((t) => (
            <span key={t.value} className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-sm ${t.dot}`} aria-hidden />
              {t.label}
            </span>
          ))}
          <span className="hidden sm:block w-px h-4 bg-line" aria-hidden />
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-danger-soft border border-danger-line" aria-hidden />
            Feriado (no admite eventos)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-tint-soft border border-line" aria-hidden />
            Sábado
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-fill-neutral border border-line" aria-hidden />
            Domingo (no admite eventos)
          </span>
        </div>
      </section>

      {/* ===================== Listado de eventos ===================== */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-ink">Eventos</h2>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <Select aria-label="Tipo de evento" value={listType} onChange={(e) => setListType(e.target.value as EventType | '')}>
            <option value="">Todos los tipos</option>
            {EVENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
          <Select aria-label="Mes del evento" value={listMonth} onChange={(e) => setListMonth(e.target.value)}>
            <option value="">Todos los meses</option>
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </Select>
          <Select aria-label="Año del evento" value={listYear} onChange={(e) => setListYear(e.target.value)}>
            <option value="">Todos los años</option>
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        </div>

        <div className="mt-3">
          {listed.length === 0 ? (
            events.length > 0 && hasListFilters ? (
              <EmptyState
                icon={<SearchX className="w-5 h-5" />}
                message="Ningún evento coincide con los filtros"
                action={
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setListType('');
                      setListMonth('');
                      setListYear('');
                    }}
                  >
                    Limpiar filtros
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={<CalendarDays className="w-5 h-5" />}
                message="Todavía no hay eventos"
                description="Toque un día del calendario o use Cargar nuevo evento."
              />
            )
          ) : (
            <Table>
              <TableHeader>
                <tr>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Día</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Comisión</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </tr>
              </TableHeader>
              <tbody>
                {listed.map((ev) => (
                  <TableRow key={ev.id}>
                    <TableCell className="tabular-nums text-ink">{isoToText(ev.date)}</TableCell>
                    <TableCell className="text-ink-muted">{WEEKDAY_NAMES[weekdayOf(ev.date)]}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2 whitespace-nowrap">
                        <span className={`w-2.5 h-2.5 rounded-sm ${typeOf(ev.type).dot}`} aria-hidden />
                        {typeOf(ev.type).label}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium text-ink">{ev.title}</TableCell>
                    <TableCell className="text-ink-muted">{ev.section_label ?? 'Todas'}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghostDanger"
                        size="sm"
                        onClick={() => deleteEvent(ev)}
                        aria-label={`Eliminar ${ev.title}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </section>

      {/* ===================== Diálogo: evento nuevo ===================== */}
      <Modal isOpen={isEventOpen} onClose={() => setIsEventOpen(false)} title="Cargar nuevo evento">
        <form onSubmit={handleSaveEvent} className="space-y-4 pb-1">
          {draftError && <Alert>{draftError}</Alert>}
          <DateField
            label="Fecha"
            value={draft.date}
            onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value, id_section_year: '' }))}
            helperText={draft.date && blockedReason(draft.date) ? blockedReason(draft.date)! : undefined}
          />
          <Select
            label="Tipo de evento"
            value={draft.type}
            onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value as EventType }))}
            options={EVENT_TYPES.map((t) => ({ value: t.value, label: t.label }))}
          />
          <Input
            label="Título"
            placeholder="Por ejemplo: Primer parcial"
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            maxLength={120}
          />
          <Select
            label="Comisión"
            value={draft.id_section_year}
            onChange={(e) => setDraft((d) => ({ ...d, id_section_year: e.target.value }))}
            helperText={draftYear ? `Cursos lectivos de ${draftYear}` : 'Elija primero la fecha'}
          >
            <option value="">Todas las comisiones</option>
            {draftYear &&
              coursesOfYear(draftYear).map((sy) => (
                <option key={sy.id_section_year} value={sy.id_section_year}>
                  {sy.section_name}
                </option>
              ))}
          </Select>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setIsEventOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">Guardar evento</Button>
          </div>
        </form>
      </Modal>

      {/* ===================== Diálogo: carga por archivo ===================== */}
      <Modal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        title="Cargar eventos desde un archivo"
        maxWidth="xl"
      >
        <div className="space-y-4 pb-1">
          <p className="text-sm text-ink-muted">
            Una fila por evento con las columnas <strong className="text-ink">Fecha</strong> (dd/mm/aaaa),{' '}
            <strong className="text-ink">Tipo</strong>, <strong className="text-ink">Título</strong> y{' '}
            <strong className="text-ink">Comisión</strong> (vacía para todas). Se aceptan archivos .csv o
            .txt separados por punto y coma, coma o tabulación.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="w-4 h-4" />
              Descargar plantilla
            </Button>
            <Button size="sm" onClick={() => fileInput.current?.click()}>
              <FileUp className="w-4 h-4" />
              Elegir archivo
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept=".csv,.txt,.xlsx"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                e.target.value = '';
              }}
            />
            {importFileName && <span className="self-center text-sm text-ink-muted">{importFileName}</span>}
          </div>

          {importError && <Alert>{importError}</Alert>}

          {importRows && (
            <>
              <p className="text-sm text-ink">
                {plural(importValid.length, 'evento válido', 'eventos válidos')}
                {importErrors.length > 0 && (
                  <span className="text-danger"> · {plural(importErrors.length, 'fila con error', 'filas con error')}</span>
                )}
              </p>
              <div className="max-h-64 overflow-y-auto rounded-lg border border-line">
                <table className="w-full text-sm">
                  <thead className="bg-canvas text-xs text-ink-muted sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Fila</th>
                      <th className="px-3 py-2 text-left font-medium">Fecha</th>
                      <th className="px-3 py-2 text-left font-medium">Evento</th>
                      <th className="px-3 py-2 text-left font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {importRows.map((r) => (
                      <tr key={r.line} className={r.error ? 'bg-danger-soft/40' : ''}>
                        <td className="px-3 py-1.5 tabular-nums text-ink-muted">{r.line}</td>
                        <td className="px-3 py-1.5 tabular-nums">{r.event ? isoToText(r.event.date) : '—'}</td>
                        <td className="px-3 py-1.5">
                          {r.event
                            ? `${typeOf(r.event.type).label}: ${r.event.title}${r.event.section_label ? ` (${r.event.section_label})` : ''}`
                            : <span className="text-ink-muted">{r.raw}</span>}
                        </td>
                        <td className={`px-3 py-1.5 ${r.error ? 'text-danger' : 'text-success'}`}>
                          {r.error ?? 'Válido'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {importErrors.length > 0 && (
                <p className="text-xs text-ink-muted">
                  Corrija las filas con error y vuelva a elegir el archivo: se cargan todos los eventos o ninguno.
                </p>
              )}
            </>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setIsImportOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleImport} disabled={importValid.length === 0 || importErrors.length > 0}>
              {importValid.length > 0 ? `Cargar ${plural(importValid.length, 'evento', 'eventos')}` : 'Cargar eventos'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
