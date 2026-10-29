import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { api } from '../lib/api';
import { fetchAll } from '../lib/pagination';
import { useAuth } from '../context/AuthContext';
import { ClassModality, ProfessorSectionYearPublic, SectionYearPublic } from '../types/api';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { Modal } from '../components/ui/Modal';
import { Alert } from '../components/ui/Alert';
import { EmptyState, TableSkeleton } from '../components/ui/EmptyState';
import { Table, TableHeader, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { CalendarDays, ChevronLeft, ChevronRight, ExternalLink, MapPin, SearchX } from 'lucide-react';

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const WEEKDAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

// Tipos de evento que hoy distingue el backend: las clases del calendario y las actividades
// (entregas). Colores validados para daltonismo; el tipo siempre va también escrito.
type EventKind = 'class' | 'delivery';
const EVENT_KINDS: { value: EventKind; label: string; dot: string; chip: string }[] = [
  { value: 'class', label: 'Clase', dot: 'bg-[#2a78d6]', chip: 'border-l-[#2a78d6]' },
  { value: 'delivery', label: 'Entrega', dot: 'bg-[#1baf7a]', chip: 'border-l-[#1baf7a]' },
];
const kindOf = (value: EventKind) => EVENT_KINDS.find((k) => k.value === value)!;

const MODALITY_LABELS: Record<ClassModality, string> = {
  in_person: 'Presencial',
  virtual: 'Virtual',
};

type CalendarEvent = {
  key: string;
  kind: EventKind;
  date: string; // ISO
  start: string | null; // HH:MM
  end: string | null;
  title: string;
  id_section_year: number;
  section_name: string;
  modality?: ClassModality;
  location?: string | null;
  meeting_url?: string | null;
  description?: string | null;
};

const toIso = (year: number, month: number, day: number) =>
  `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

const today = new Date();
const todayIso = toIso(today.getFullYear(), today.getMonth(), today.getDate());

const isoToText = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

const weekdayOf = (iso: string) =>
  new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))).getDay();

// El backend manda las horas como HH:MM:SS
const hhmm = (time: string | null | undefined) => (time ? time.slice(0, 5) : null);

const timeText = (ev: CalendarEvent) =>
  ev.start && ev.end ? `${ev.start} a ${ev.end}` : ev.start ? `Hasta las ${ev.start}` : 'Todo el día';

// Orden: fecha, hora (las entregas sin hora al final del día) y comisión
const compareEvents = (a: CalendarEvent, b: CalendarEvent) =>
  a.date.localeCompare(b.date) ||
  (a.start ?? '99').localeCompare(b.start ?? '99') ||
  a.section_name.localeCompare(b.section_name, 'es') ||
  a.key.localeCompare(b.key);

type Course = Pick<SectionYearPublic, 'id_section_year' | 'year' | 'section_name'>;

export const Calendar: React.FC = () => {
  const { user } = useAuth();
  const isSuperAdmin = Boolean(user?.is_super_admin);

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  // Cursos lectivos que puede ver: todos para el super admin; los asignados para el docente
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loadedYear, setLoadedYear] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [sectionFilter, setSectionFilter] = useState('');
  const [kindFilter, setKindFilter] = useState<EventKind | ''>('');

  // Día abierto en el detalle
  const [openDay, setOpenDay] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setLoadError(null);
    const load: Promise<Course[]> = isSuperAdmin
      ? fetchAll<SectionYearPublic>((o) => api.getSectionYears({ limit: 100, offset: o }))
      : fetchAll<ProfessorSectionYearPublic>((o) =>
          api.getProfessorSectionYears({ id_professor: user.id_user, limit: 100, offset: o })
        );
    load
      .then((items) => {
        setCourses(items);
        // Si el año actual no tiene cursos lectivos, se abre el más reciente que tenga
        const years = items.map((c) => c.year);
        if (years.length > 0 && !years.includes(today.getFullYear())) setViewYear(Math.max(...years));
      })
      .catch(() => setLoadError('No se pudieron cargar los cursos lectivos'));
  }, [user, isSuperAdmin, reloadKey]);

  const coursesOfYear = useMemo(
    () =>
      (courses ?? [])
        .filter((c) => c.year === viewYear)
        .sort((a, b) => a.section_name.localeCompare(b.section_name, 'es')),
    [courses, viewYear]
  );

  // Se trae el año completo de cada curso lectivo: al moverse entre meses del mismo año no se
  // vuelve a consultar. Una respuesta vieja (de otro año) se descarta.
  const requestId = useRef(0);
  useEffect(() => {
    if (courses === null) return;
    const id = ++requestId.current;
    const range = { from: `${viewYear}-01-01`, to: `${viewYear}-12-31` };
    setLoadError(null);
    Promise.all(coursesOfYear.map((c) => api.getSectionYearCalendar(c.id_section_year, range)))
      .then((calendars) => {
        if (id !== requestId.current) return;
        const built: CalendarEvent[] = [];
        calendars.forEach((cal, i) => {
          const course = coursesOfYear[i];
          for (const c of cal.classes) {
            built.push({
              key: `class-${c.id_calendar_class}`,
              kind: 'class',
              date: c.date,
              start: hhmm(c.start_time),
              end: hhmm(c.end_time),
              title: c.title || 'Clase',
              id_section_year: course.id_section_year,
              section_name: course.section_name,
              modality: c.modality,
              location: c.location,
              meeting_url: c.meeting_url,
            });
          }
          for (const a of cal.activities) {
            built.push({
              key: `activity-${a.id_activity}`,
              kind: 'delivery',
              date: a.due_date,
              start: hhmm(a.due_time),
              end: null,
              title: a.title,
              id_section_year: course.id_section_year,
              section_name: course.section_name,
              description: a.description,
            });
          }
        });
        setEvents(built.sort(compareEvents));
        setLoadedYear(viewYear);
      })
      .catch(() => {
        if (id === requestId.current) setLoadError('No se pudo cargar el calendario');
      });
  }, [courses, coursesOfYear, viewYear, reloadKey]);

  // Al cambiar de año, la comisión elegida puede no tener curso lectivo en el año nuevo
  useEffect(() => {
    if (sectionFilter && !coursesOfYear.some((c) => String(c.id_section_year) === sectionFilter)) {
      setSectionFilter('');
    }
  }, [coursesOfYear, sectionFilter]);

  const yearOptions = useMemo(() => {
    const years = new Set<number>((courses ?? []).map((c) => c.year));
    years.add(viewYear);
    return [...years].sort((a, b) => b - a);
  }, [courses, viewYear]);

  // Mientras llega el año nuevo se siguen viendo los datos anteriores; la primera carga muestra el esqueleto
  const firstLoad = loadedYear === null && !loadError;
  const loadingYear = loadedYear !== viewYear && !loadError;

  const filtered = useMemo(
    () =>
      loadedYear === viewYear
        ? events.filter(
            (e) =>
              (!sectionFilter || String(e.id_section_year) === sectionFilter) &&
              (!kindFilter || e.kind === kindFilter)
          )
        : [],
    [events, loadedYear, viewYear, sectionFilter, kindFilter]
  );

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const e of filtered) (map[e.date] ??= []).push(e);
    return map;
  }, [filtered]);

  const monthPrefix = toIso(viewYear, viewMonth, 1).slice(0, 7);
  const monthEvents = filtered.filter((e) => e.date.startsWith(monthPrefix));

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

  const moveMonth = (delta: number) => {
    const date = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(date.getFullYear());
    setViewMonth(date.getMonth());
  };

  const clearFilters = () => {
    setSectionFilter('');
    setKindFilter('');
  };
  const hasFilters = Boolean(sectionFilter || kindFilter);

  const retry = useCallback(() => setReloadKey((k) => k + 1), []);

  const openDayEvents = openDay ? eventsByDate[openDay] ?? [] : [];

  return (
    <div>
      <PageHeader
        title="Calendario"
        subtitle={
          isSuperAdmin
            ? 'Clases y entregas de todas las comisiones'
            : 'Clases y entregas de los cursos lectivos que dicta'
        }
      />

      {loadError && (
        <Alert
          className="mb-4"
          action={
            <Button variant="outline" size="sm" onClick={retry}>
              Reintentar
            </Button>
          }
        >
          {loadError}
        </Alert>
      )}

      {/* ===================== Filtros ===================== */}
      <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Select
          aria-label="Comisión"
          value={sectionFilter}
          onChange={(e) => setSectionFilter(e.target.value)}
          disabled={coursesOfYear.length === 0}
        >
          <option value="">{coursesOfYear.length === 1 ? coursesOfYear[0].section_name : 'Todas las comisiones'}</option>
          {coursesOfYear.length > 1 &&
            coursesOfYear.map((c) => (
              <option key={c.id_section_year} value={c.id_section_year}>
                {c.section_name}
              </option>
            ))}
        </Select>
        <Select
          aria-label="Tipo de evento"
          value={kindFilter}
          onChange={(e) => setKindFilter(e.target.value as EventKind | '')}
        >
          <option value="">Todos los tipos</option>
          {EVENT_KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </Select>
      </div>

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

        <div className={`overflow-x-auto transition-opacity ${loadingYear && !firstLoad ? 'opacity-60' : ''}`}>
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
                  const dayEvents = eventsByDate[iso] ?? [];
                  const hasEvents = dayEvents.length > 0;
                  const isToday = iso === todayIso;
                  const isWeekend = di >= 5;
                  return (
                    <div
                      key={di}
                      role={hasEvents ? 'button' : undefined}
                      tabIndex={hasEvents ? 0 : undefined}
                      aria-label={
                        hasEvents
                          ? `${day} de ${MONTHS[viewMonth]}: ${dayEvents.length} ${dayEvents.length === 1 ? 'evento' : 'eventos'}`
                          : undefined
                      }
                      onClick={() => hasEvents && setOpenDay(iso)}
                      onKeyDown={(e) => {
                        if (hasEvents && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault();
                          setOpenDay(iso);
                        }
                      }}
                      className={`min-h-28 p-1.5 border-r border-line last:border-r-0 flex flex-col gap-1 ${
                        isWeekend ? 'bg-tint-soft' : 'bg-white'
                      } ${hasEvents ? 'cursor-pointer hover:bg-tint focus-visible:outline-2 focus-visible:outline-primary' : ''}`}
                    >
                      <span
                        className={`w-7 h-7 flex items-center justify-center rounded-full text-sm tabular-nums ${
                          isToday ? 'bg-primary text-white font-semibold' : isWeekend ? 'text-primary' : 'text-ink'
                        }`}
                      >
                        {day}
                      </span>
                      {dayEvents.slice(0, 3).map((ev) => (
                        <span
                          key={ev.key}
                          className={`block truncate rounded border-l-[3px] ${kindOf(ev.kind).chip} bg-white px-1.5 py-0.5 text-[11px] text-ink shadow-[0_0_0_1px_var(--color-line)]`}
                          title={`${kindOf(ev.kind).label}: ${ev.title} (${ev.section_name})`}
                        >
                          {ev.start && <span className="tabular-nums text-ink-muted">{ev.start} </span>}
                          {coursesOfYear.length > 1 && !sectionFilter && (
                            <span className="font-semibold">{ev.section_name} </span>
                          )}
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
          {EVENT_KINDS.map((k) => (
            <span key={k.value} className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-sm ${k.dot}`} aria-hidden />
              {k.label}
            </span>
          ))}
          <span className="hidden sm:block w-px h-4 bg-line" aria-hidden />
          <span>Toque un día con eventos para ver el detalle</span>
        </div>
      </section>

      {/* ===================== Eventos del mes ===================== */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-ink">
          Eventos de {MONTHS[viewMonth].toLowerCase()} {viewYear}
        </h2>
        <div className="mt-3">
          {firstLoad || (loadingYear && events.length === 0) ? (
            <TableSkeleton rows={5} cols={6} />
          ) : monthEvents.length === 0 ? (
            hasFilters ? (
              <EmptyState
                icon={<SearchX className="w-5 h-5" />}
                message="Ningún evento coincide con los filtros"
                action={
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    Limpiar filtros
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={<CalendarDays className="w-5 h-5" />}
                message="No hay eventos este mes"
                description={
                  coursesOfYear.length === 0
                    ? isSuperAdmin
                      ? `No hay cursos lectivos en ${viewYear}.`
                      : `No tiene cursos lectivos asignados en ${viewYear}.`
                    : 'Las clases y entregas que carguen los docentes aparecen acá.'
                }
              />
            )
          ) : (
            <Table>
              <TableHeader>
                <tr>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Horario</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Comisión</TableHead>
                  <TableHead>Lugar</TableHead>
                </tr>
              </TableHeader>
              <tbody>
                {monthEvents.map((ev) => (
                  <TableRow key={ev.key}>
                    <TableCell className="whitespace-nowrap">
                      <span className="tabular-nums text-ink">{isoToText(ev.date)}</span>
                      <span className="block text-xs text-ink-muted">{WEEKDAY_NAMES[weekdayOf(ev.date)]}</span>
                    </TableCell>
                    <TableCell className="tabular-nums whitespace-nowrap text-ink-muted">{timeText(ev)}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2 whitespace-nowrap">
                        <span className={`w-2.5 h-2.5 rounded-sm ${kindOf(ev.kind).dot}`} aria-hidden />
                        {kindOf(ev.kind).label}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium text-ink">{ev.title}</TableCell>
                    <TableCell className="text-ink-muted">{ev.section_name}</TableCell>
                    <TableCell className="text-ink-muted">
                      <EventPlace ev={ev} />
                    </TableCell>
                  </TableRow>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </section>

      {/* ===================== Detalle del día ===================== */}
      <Modal
        isOpen={openDay !== null}
        onClose={() => setOpenDay(null)}
        title={
          openDay
            ? `${WEEKDAY_NAMES[weekdayOf(openDay)]} ${Number(openDay.slice(8, 10))} de ${MONTHS[Number(openDay.slice(5, 7)) - 1].toLowerCase()}`
            : ''
        }
      >
        <ul className="divide-y divide-line pb-1">
          {openDayEvents.map((ev) => (
            <li key={ev.key} className="py-3 first:pt-0">
              <div className="flex items-center gap-2 text-xs text-ink-muted">
                <span className={`w-2.5 h-2.5 rounded-sm ${kindOf(ev.kind).dot}`} aria-hidden />
                <span className="font-medium text-ink">{kindOf(ev.kind).label}</span>
                <span>·</span>
                <span>{ev.section_name}</span>
                <span className="ml-auto tabular-nums">{timeText(ev)}</span>
              </div>
              <p className="mt-1 font-medium text-ink">{ev.title}</p>
              {ev.description && <p className="mt-1 text-sm text-ink-muted whitespace-pre-line">{ev.description}</p>}
              {ev.kind === 'class' && (
                <div className="mt-1 text-sm text-ink-muted">
                  <EventPlace ev={ev} />
                </div>
              )}
            </li>
          ))}
        </ul>
        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={() => setOpenDay(null)}>
            Cerrar
          </Button>
        </div>
      </Modal>
    </div>
  );
};

// Modalidad y aula o link de la clase; las entregas no tienen lugar
const EventPlace: React.FC<{ ev: CalendarEvent }> = ({ ev }) => {
  if (ev.kind !== 'class' || !ev.modality) return <span>—</span>;
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
      <span>{MODALITY_LABELS[ev.modality]}</span>
      {ev.location && (
        <span className="flex items-center gap-1">
          <MapPin className="w-3.5 h-3.5" aria-hidden />
          {ev.location}
        </span>
      )}
      {ev.meeting_url && (
        <a
          href={ev.meeting_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-primary hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="w-3.5 h-3.5" aria-hidden />
          Unirse
        </a>
      )}
    </span>
  );
};
