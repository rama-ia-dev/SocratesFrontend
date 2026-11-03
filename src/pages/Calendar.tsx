import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { api } from '../lib/api';
import { fetchAll } from '../lib/pagination';
import { useAuth } from '../context/AuthContext';
import { CalendarWithClasses, ClassModality, ProfessorSectionYearPublic, SectionYearPublic } from '../types/api';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Modal } from '../components/ui/Modal';
import { Alert } from '../components/ui/Alert';
import { EmptyState, TableSkeleton } from '../components/ui/EmptyState';
import { Table, TableHeader, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { RegisterEventModal } from '../components/RegisterEventModal';
import { RegisterHolidaysModal } from '../components/RegisterHolidaysModal';
import { SOURCE_TEXT, useHolidays } from '../lib/holidays';
import { CalendarDays, CalendarX, ChevronLeft, ChevronRight, ExternalLink, MapPin, Plus, SearchX } from 'lucide-react';

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const WEEKDAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

// Tipos de evento: las clases del calendario y las actividades (entregas) que guarda el backend, y los
// feriados nacionales, que no se guardan sino que se consultan (ver lib/holidays). Colores validados
// para daltonismo; el tipo siempre va también escrito.
type EventKind = 'class' | 'delivery' | 'holiday';
const EVENT_KINDS: { value: EventKind; label: string; dot: string; chip: string }[] = [
  { value: 'class', label: 'Clase', dot: 'bg-[#2a78d6]', chip: 'border-l-[#2a78d6]' },
  { value: 'delivery', label: 'Entrega', dot: 'bg-[#1baf7a]', chip: 'border-l-[#1baf7a]' },
  { value: 'holiday', label: 'Feriado', dot: 'bg-[#eb6834]', chip: 'border-l-[#eb6834]' },
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

const dateToIso = (date: Date) => toIso(date.getFullYear(), date.getMonth(), date.getDate());

const today = new Date();
const todayIso = dateToIso(today);

// Rango por defecto del listado: la semana actual y la siguiente (de lunes a domingo)
const currentMonday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7));
const DEFAULT_LIST_FROM = dateToIso(currentMonday);
const DEFAULT_LIST_TO = dateToIso(
  new Date(currentMonday.getFullYear(), currentMonday.getMonth(), currentMonday.getDate() + 13)
);

const isoToText = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

const isoToDate = (iso: string) =>
  new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));

const weekdayOf = (iso: string) => isoToDate(iso).getDay();

const addDays = (iso: string, days: number) => {
  const date = isoToDate(iso);
  date.setDate(date.getDate() + days);
  return dateToIso(date);
};

// Lunes de la semana de una fecha
const mondayOf = (iso: string) => addDays(iso, -((weekdayOf(iso) + 6) % 7));

// Encabezado de una semana del listado, relativo a la semana actual
const weekLabel = (monday: string) => {
  const weeks = Math.round((isoToDate(monday).getTime() - currentMonday.getTime()) / (7 * 24 * 60 * 60 * 1000));
  const names: Record<string, string> = { '-1': 'Semana pasada', '0': 'Esta semana', '1': 'Próxima semana' };
  return names[weeks] ?? 'Semana';
};

const weekRangeText = (monday: string) =>
  `del ${isoToText(monday).slice(0, 5)} al ${isoToText(addDays(monday, 6)).slice(0, 5)}`;

// El backend manda las horas como HH:MM:SS
const hhmm = (time: string | null | undefined) => (time ? time.slice(0, 5) : null);

const timeText = (ev: CalendarEvent) =>
  ev.start && ev.end ? `${ev.start} a ${ev.end}` : ev.start ? `Hasta las ${ev.start}` : 'Todo el día';

// Orden: fecha, el feriado primero, hora (las entregas sin hora al final del día) y comisión
const compareEvents = (a: CalendarEvent, b: CalendarEvent) =>
  a.date.localeCompare(b.date) ||
  Number(b.kind === 'holiday') - Number(a.kind === 'holiday') ||
  (a.start ?? '99').localeCompare(b.start ?? '99') ||
  a.section_name.localeCompare(b.section_name, 'es') ||
  a.key.localeCompare(b.key);

// Los feriados valen para todas las comisiones
const sectionText = (ev: CalendarEvent) => (ev.kind === 'holiday' ? 'Todas' : ev.section_name);

// Feriados entre dos fechas como eventos
const holidayEvents = (holidays: Record<string, string>, from: string, to: string): CalendarEvent[] =>
  Object.entries(holidays)
    .filter(([date]) => date >= from && date <= to)
    .map(([date, name]) => ({
      key: `holiday-${date}`,
      kind: 'holiday' as const,
      date,
      start: null,
      end: null,
      title: name,
      id_section_year: 0,
      section_name: '',
    }));

type Course = Pick<SectionYearPublic, 'id_section_year' | 'year' | 'section_name'>;

// Clases y actividades de un curso lectivo como eventos
const toEvents = (course: Course, cal: CalendarWithClasses): CalendarEvent[] => [
  ...cal.classes.map((c) => ({
    key: `class-${c.id_calendar_class}`,
    kind: 'class' as const,
    date: c.date,
    start: hhmm(c.start_time),
    end: hhmm(c.end_time),
    title: c.title || 'Clase',
    id_section_year: course.id_section_year,
    section_name: course.section_name,
    modality: c.modality,
    location: c.location,
    meeting_url: c.meeting_url,
  })),
  ...cal.activities.map((a) => ({
    key: `activity-${a.id_activity}`,
    kind: 'delivery' as const,
    date: a.due_date,
    start: hhmm(a.due_time),
    end: null,
    title: a.title,
    id_section_year: course.id_section_year,
    section_name: course.section_name,
    description: a.description,
  })),
];

export const Calendar: React.FC = () => {
  const { user } = useAuth();
  const isSuperAdmin = Boolean(user?.is_super_admin);
  const isStudent = user?.role === 'student';

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  // Cursos lectivos que puede ver: todos para el administrador; los asignados para el docente; el de
  // su cursada actual para el alumno
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loadedYear, setLoadedYear] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  // El alumno inscripto que todavía no es parte de un equipo no puede ver el calendario: el backend
  // lo habilita recién cuando cursa (al sumarse a un equipo) y responde 403
  const [withoutTeam, setWithoutTeam] = useState(false);

  // Filtros del calendario y del listado. La comisión va por nombre: el listado puede abarcar
  // cursos lectivos de más de un año
  const [sectionFilter, setSectionFilter] = useState('');
  const [kindFilter, setKindFilter] = useState<EventKind | ''>('');

  // Detalle abierto: los eventos de un día del calendario o un evento del listado
  const [detail, setDetail] = useState<{ date: string; events: CalendarEvent[] } | null>(null);

  useEffect(() => {
    if (!user) return;
    setLoadError(null);
    const load: Promise<Course[]> = isSuperAdmin
      ? fetchAll<SectionYearPublic>((o) => api.getSectionYears({ limit: 100, offset: o }))
      : isStudent
        ? // El alumno ve su curso lectivo solo si cursa en el año en curso (o uno posterior), no una
          // cursada de un año anterior
          api.getMySectionYears().then((res) => res.section_years.filter((c) => c.year >= today.getFullYear()))
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
  }, [user, isSuperAdmin, isStudent, reloadKey]);

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
        setEvents(calendars.flatMap((cal, i) => toEvents(coursesOfYear[i], cal)).sort(compareEvents));
        setLoadedYear(viewYear);
      })
      .catch((err) => {
        if (id !== requestId.current) return;
        if (isStudent && err?.status === 403) setWithoutTeam(true);
        else setLoadError('No se pudo cargar el calendario');
      });
  }, [courses, coursesOfYear, viewYear, reloadKey, isStudent]);

  const yearOptions = useMemo(() => {
    const years = new Set<number>((courses ?? []).map((c) => c.year));
    years.add(viewYear);
    return [...years].sort((a, b) => b - a);
  }, [courses, viewYear]);

  // Mientras llega el año nuevo se siguen viendo los datos anteriores; la primera carga muestra el esqueleto
  const firstLoad = loadedYear === null && !loadError;
  const loadingYear = loadedYear !== viewYear && !loadError;

  // Feriados del año que se ve; valen para todas las comisiones, así que el filtro de comisión no los oculta
  const { holidays: yearHolidays, source: holidaySource } = useHolidays([viewYear]);

  const filtered = useMemo(
    () =>
      loadedYear === viewYear
        ? [...events, ...holidayEvents(yearHolidays, `${viewYear}-01-01`, `${viewYear}-12-31`)]
            .filter(
              (e) =>
                (!sectionFilter || e.kind === 'holiday' || e.section_name === sectionFilter) &&
                (!kindFilter || e.kind === kindFilter)
            )
            .sort(compareEvents)
        : [],
    [events, yearHolidays, loadedYear, viewYear, sectionFilter, kindFilter]
  );

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const e of filtered) (map[e.date] ??= []).push(e);
    return map;
  }, [filtered]);

  // ===== Listado de eventos: independiente del mes que se ve, con su propio rango de fechas =====
  const [listFrom, setListFrom] = useState(DEFAULT_LIST_FROM);
  const [listTo, setListTo] = useState(DEFAULT_LIST_TO);
  const [listEvents, setListEvents] = useState<CalendarEvent[] | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const rangeError = !listFrom || !listTo
    ? 'Elija las dos fechas'
    : listFrom > listTo
      ? 'Debe ser igual o posterior a "Desde"'
      : null;

  const listCourses = useMemo(() => {
    if (rangeError) return [];
    const fromYear = Number(listFrom.slice(0, 4));
    const toYear = Number(listTo.slice(0, 4));
    return (courses ?? []).filter((c) => c.year >= fromYear && c.year <= toYear);
  }, [courses, listFrom, listTo, rangeError]);

  // Comisiones del año que se ve en el calendario y de las fechas del listado
  const sectionOptions = useMemo(
    () =>
      [...new Set([...coursesOfYear, ...listCourses].map((c) => c.section_name))].sort((a, b) =>
        a.localeCompare(b, 'es')
      ),
    [coursesOfYear, listCourses]
  );

  // Al cambiar de año o de fechas, la comisión elegida puede no tener curso lectivo en ellos
  useEffect(() => {
    if (sectionFilter && !sectionOptions.includes(sectionFilter)) setSectionFilter('');
  }, [sectionOptions, sectionFilter]);

  // Cada curso lectivo se consulta solo dentro de su año (las fechas no salen de él), así ningún
  // pedido supera el máximo de 366 días del backend. Una respuesta vieja se descarta.
  const listRequestId = useRef(0);
  useEffect(() => {
    if (courses === null || rangeError) return;
    const id = ++listRequestId.current;
    setListLoading(true);
    setListError(null);
    Promise.all(
      listCourses.map((c) => {
        const from = listFrom > `${c.year}-01-01` ? listFrom : `${c.year}-01-01`;
        const to = listTo < `${c.year}-12-31` ? listTo : `${c.year}-12-31`;
        return api.getSectionYearCalendar(c.id_section_year, { from, to });
      })
    )
      .then((calendars) => {
        if (id !== listRequestId.current) return;
        setListEvents(calendars.flatMap((cal, i) => toEvents(listCourses[i], cal)).sort(compareEvents));
      })
      .catch(() => {
        if (id === listRequestId.current) setListError('No se pudo cargar el listado de eventos');
      })
      .finally(() => {
        if (id === listRequestId.current) setListLoading(false);
      });
  }, [courses, listCourses, listFrom, listTo, rangeError, reloadKey]);

  // Feriados de los años del rango (a lo sumo unos pocos años, para no consultar de más)
  const listYears = useMemo(() => {
    if (rangeError) return [];
    const from = Number(listFrom.slice(0, 4));
    const to = Math.min(Number(listTo.slice(0, 4)), from + 4);
    return Array.from({ length: to - from + 1 }, (_, i) => from + i);
  }, [listFrom, listTo, rangeError]);
  const { holidays: listHolidays } = useHolidays(listYears);

  const listFiltered = useMemo(
    () =>
      listEvents === null
        ? []
        : [...listEvents, ...holidayEvents(listHolidays, listFrom, listTo)]
            .filter(
              (e) =>
                (!kindFilter || e.kind === kindFilter) &&
                (!sectionFilter || e.kind === 'holiday' || e.section_name === sectionFilter)
            )
            .sort(compareEvents),
    [listEvents, listHolidays, listFrom, listTo, kindFilter, sectionFilter]
  );

  // El listado separado por semana (de lunes a domingo); solo aparecen las semanas con eventos
  const listWeeks = useMemo(() => {
    const groups: { monday: string; events: CalendarEvent[] }[] = [];
    for (const e of listFiltered) {
      const monday = mondayOf(e.date);
      if (groups.at(-1)?.monday !== monday) groups.push({ monday, events: [] });
      groups.at(-1)!.events.push(e);
    }
    return groups;
  }, [listFiltered]);

  const rangeIsDefault = listFrom === DEFAULT_LIST_FROM && listTo === DEFAULT_LIST_TO;
  const resetRange = () => {
    setListFrom(DEFAULT_LIST_FROM);
    setListTo(DEFAULT_LIST_TO);
  };

  const hasFilters = Boolean(sectionFilter || kindFilter);
  const clearFilters = () => {
    setSectionFilter('');
    setKindFilter('');
  };

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

  const retry = useCallback(() => setReloadKey((k) => k + 1), []);

  const openDay = (iso: string) => setDetail({ date: iso, events: eventsByDate[iso] ?? [] });

  // ===== Registrar evento =====
  // Fecha con la que se abre el formulario; null = cerrado
  const [registerDate, setRegisterDate] = useState<string | null>(null);
  // Solo el docente y el administrador registran (y, más adelante, modifican y eliminan) eventos, y
  // solo en cursos lectivos del año en curso o posteriores. El alumno solo consulta.
  const canManage = isSuperAdmin || user?.role === 'professor';
  const registrableCourses = useMemo(
    () => (canManage ? (courses ?? []).filter((c) => c.year >= today.getFullYear()) : []),
    [courses, canManage]
  );
  const canRegister = registrableCourses.length > 0;
  // En un feriado no se registran eventos
  const isHoliday = (iso: string) => Boolean(yearHolidays[iso] ?? listHolidays[iso]);
  const canRegisterOn = (iso: string) =>
    canRegister && Number(iso.slice(0, 4)) >= today.getFullYear() && !isHoliday(iso);

  // Registrar feriados: solo el administrador
  const [holidaysOpen, setHolidaysOpen] = useState(false);

  const openRegister = (iso: string) => {
    setDetail(null);
    setRegisterDate(iso);
  };

  // Se sugiere el curso lectivo de la fecha: el de la comisión filtrada o, si hay uno solo ese año, ese
  const registerCourseId = useMemo(() => {
    if (!registerDate) return null;
    const ofYear = registrableCourses.filter((c) => c.year === Number(registerDate.slice(0, 4)));
    const match = sectionFilter ? ofYear.find((c) => c.section_name === sectionFilter) : undefined;
    return match?.id_section_year ?? (ofYear.length === 1 ? ofYear[0].id_section_year : null);
  }, [registerDate, registrableCourses, sectionFilter]);

  // Un alumno que no cursa en el ciclo lectivo actual no tiene calendario que mostrar
  if (isStudent && courses !== null && courses.length === 0) {
    return (
      <div>
        <PageHeader title="Calendario" subtitle="Clases y entregas de su curso lectivo" />
        <EmptyState
          icon={<CalendarDays className="w-5 h-5" />}
          message={`No está cursando en el ciclo lectivo ${today.getFullYear()}`}
          description="Cuando curse en un curso lectivo, acá va a ver sus clases y entregas."
        />
      </div>
    );
  }

  if (withoutTeam) {
    return (
      <div>
        <PageHeader title="Calendario" subtitle="Clases y entregas de su curso lectivo" />
        <EmptyState
          icon={<CalendarDays className="w-5 h-5" />}
          message="Todavía no es parte de un equipo de trabajo"
          description="Cuando se sume a un equipo, acá va a ver las clases y entregas de su curso lectivo."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Calendario"
        subtitle={
          isSuperAdmin
            ? 'Clases, entregas y feriados de todas las comisiones'
            : isStudent
              ? 'Clases, entregas y feriados de su curso lectivo'
              : 'Clases, entregas y feriados de los cursos lectivos que dicta'
        }
        action={
          canRegister && (
            <div className="flex flex-col sm:flex-row gap-2">
              {isSuperAdmin && (
                <Button variant="outline" className="w-full sm:w-auto" onClick={() => setHolidaysOpen(true)}>
                  <CalendarX className="w-4 h-4" aria-hidden />
                  Registrar feriados
                </Button>
              )}
              <Button
                className="w-full sm:w-auto"
                // Hoy, o el primer día del mes que se ve si es de un año posterior
                onClick={() => openRegister(viewYear > today.getFullYear() ? toIso(viewYear, viewMonth, 1) : todayIso)}
              >
                <Plus className="w-4 h-4" aria-hidden />
                Registrar evento
              </Button>
            </div>
          )
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

      {/* ===================== Filtros (calendario y listado) ===================== */}
      <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Select
          aria-label="Comisión"
          value={sectionFilter}
          onChange={(e) => setSectionFilter(e.target.value)}
          disabled={sectionOptions.length === 0}
        >
          <option value="">{sectionOptions.length === 1 ? sectionOptions[0] : 'Todas las comisiones'}</option>
          {sectionOptions.length > 1 &&
            sectionOptions.map((name) => (
              <option key={name} value={name}>
                {name}
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
          {/* En celular, "Hoy" baja de línea en lugar de pasarse del ancho de la pantalla */}
          <div className="flex flex-wrap items-center gap-2 ml-auto">
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
                  // El feriado se pinta aunque el filtro de tipo lo oculte de la lista del día
                  const holidayName = yearHolidays[iso];
                  // Un día con eventos abre su detalle; uno vacío, el formulario para registrar en esa fecha
                  const canRegisterDay =
                    !hasEvents && canRegisterOn(iso) && registrableCourses.some((c) => c.year === viewYear);
                  const interactive = hasEvents || canRegisterDay;
                  const activate = () => (hasEvents ? openDay(iso) : canRegisterDay && openRegister(iso));
                  return (
                    <div
                      key={di}
                      role={interactive ? 'button' : undefined}
                      tabIndex={interactive ? 0 : undefined}
                      aria-label={
                        hasEvents
                          ? `${day} de ${MONTHS[viewMonth]}: ${dayEvents.length} ${dayEvents.length === 1 ? 'evento' : 'eventos'}`
                          : canRegisterDay
                            ? `${day} de ${MONTHS[viewMonth]}: registrar evento`
                            : undefined
                      }
                      onClick={activate}
                      onKeyDown={(e) => {
                        if (interactive && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault();
                          activate();
                        }
                      }}
                      className={`min-h-28 p-1.5 border-r border-line last:border-r-0 flex flex-col gap-1 ${
                        holidayName ? 'bg-[#fdf0ea]' : isWeekend ? 'bg-tint-soft' : 'bg-white'
                      } ${interactive ? 'cursor-pointer hover:bg-tint focus-visible:outline-2 focus-visible:outline-primary' : ''}`}
                    >
                      <span
                        className={`w-7 h-7 flex items-center justify-center rounded-full text-sm tabular-nums ${
                          isToday
                            ? 'bg-primary text-white font-semibold'
                            : holidayName
                              ? 'text-[#b4471c] font-semibold'
                              : isWeekend
                                ? 'text-primary'
                                : 'text-ink'
                        }`}
                      >
                        {day}
                      </span>
                      {dayEvents.slice(0, 3).map((ev) => (
                        <span
                          key={ev.key}
                          className={`block truncate rounded border-l-[3px] ${kindOf(ev.kind).chip} bg-white px-1.5 py-0.5 text-[11px] text-ink shadow-[0_0_0_1px_var(--color-line)]`}
                          title={`${kindOf(ev.kind).label}: ${ev.title} (${sectionText(ev)})`}
                        >
                          {ev.start && <span className="tabular-nums text-ink-muted">{ev.start} </span>}
                          {coursesOfYear.length > 1 && !sectionFilter && ev.kind !== 'holiday' && (
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
          <span>
            Toque un día con eventos para ver el detalle{canRegister && ', o un día vacío para registrar un evento'}
          </span>
          {holidaySource && <span className="w-full">{SOURCE_TEXT[holidaySource]}</span>}
        </div>
      </section>

      {/* ===================== Listado de eventos ===================== */}
      <section className="mt-8">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-lg font-semibold text-ink">Listado de eventos</h2>
          {!rangeError && (
            <span className="text-sm text-ink-muted">
              Del {isoToText(listFrom)} al {isoToText(listTo)}
              {listEvents !== null && !listLoading && (
                <> · {listFiltered.length} {listFiltered.length === 1 ? 'evento' : 'eventos'}</>
              )}
            </span>
          )}
          {!rangeIsDefault && (
            <Button variant="ghost" size="sm" className="ml-auto" onClick={resetRange}>
              Volver a esta semana y la próxima
            </Button>
          )}
        </div>
        <p className="mt-1 text-xs text-ink-muted">Se aplican también los filtros de comisión y tipo de arriba.</p>

        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Input
            id="listado-desde"
            label="Desde"
            type="date"
            value={listFrom}
            onChange={(e) => setListFrom(e.target.value)}
          />
          <Input
            id="listado-hasta"
            label="Hasta"
            type="date"
            value={listTo}
            min={listFrom || undefined}
            onChange={(e) => setListTo(e.target.value)}
            error={rangeError ?? undefined}
          />
        </div>

        {listError && (
          <Alert
            className="mt-3"
            action={
              <Button variant="outline" size="sm" onClick={retry}>
                Reintentar
              </Button>
            }
          >
            {listError}
          </Alert>
        )}

        <div className={`mt-4 transition-opacity ${listLoading && listEvents !== null ? 'opacity-60' : ''}`}>
          {rangeError ? null : listEvents === null ? (
            listError ? null : <TableSkeleton rows={5} cols={6} />
          ) : listFiltered.length === 0 ? (
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
                message="No hay eventos en estas fechas"
                description={
                  listCourses.length === 0
                    ? isSuperAdmin
                      ? 'No hay cursos lectivos en esas fechas.'
                      : isStudent
                        ? 'No cursa en un curso lectivo en esas fechas.'
                        : 'No tiene cursos lectivos asignados en esas fechas.'
                    : 'Las clases y entregas que carguen los docentes aparecen acá.'
                }
              />
            )
          ) : (
            <>
              {/* Tabla desde tablet; los eventos que ya pasaron se ven más apagados */}
              <div className="hidden sm:block">
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
                  {listWeeks.map((week) => (
                    <tbody key={week.monday}>
                      <tr className="bg-canvas border-y border-line">
                        <th colSpan={6} scope="colgroup" className="px-4 py-2 text-left text-xs font-semibold text-navy">
                          {weekLabel(week.monday)}{' '}
                          <span className="font-normal text-ink-muted">{weekRangeText(week.monday)}</span>
                        </th>
                      </tr>
                      {week.events.map((ev) => (
                        <TableRow
                          key={ev.key}
                          className={ev.date < todayIso ? 'opacity-60' : ''}
                          onClick={() => setDetail({ date: ev.date, events: [ev] })}
                        >
                          <TableCell className="whitespace-nowrap">
                            <span className="tabular-nums text-ink">{isoToText(ev.date)}</span>
                            <span className="block text-xs text-ink-muted">
                              {WEEKDAY_NAMES[weekdayOf(ev.date)]}
                              {ev.date === todayIso && <span className="font-semibold text-primary"> · Hoy</span>}
                            </span>
                          </TableCell>
                          <TableCell className="tabular-nums whitespace-nowrap text-ink-muted">{timeText(ev)}</TableCell>
                          <TableCell>
                            <span className="flex items-center gap-2 whitespace-nowrap">
                              <span className={`w-2.5 h-2.5 rounded-sm ${kindOf(ev.kind).dot}`} aria-hidden />
                              {kindOf(ev.kind).label}
                            </span>
                          </TableCell>
                          <TableCell>
                            {/* El botón da acceso con teclado; el clic en cualquier parte de la fila hace lo mismo */}
                            <button
                              type="button"
                              className="text-left font-medium text-ink hover:text-primary rounded focus-visible:outline-2 focus-visible:outline-primary"
                            >
                              {ev.title}
                            </button>
                          </TableCell>
                          <TableCell className="text-ink-muted">{sectionText(ev)}</TableCell>
                          <TableCell className="text-ink-muted">
                            <EventPlace ev={ev} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </tbody>
                  ))}
                </Table>
              </div>

              {/* Tarjetas en celulares */}
              <div className="sm:hidden space-y-5">
                {listWeeks.map((week) => (
                  <div key={week.monday}>
                    <h3 className="text-xs font-semibold text-navy">
                      {weekLabel(week.monday)}{' '}
                      <span className="font-normal text-ink-muted">{weekRangeText(week.monday)}</span>
                    </h3>
                    <ul className="mt-2 space-y-2">
                      {week.events.map((ev) => (
                        <li key={ev.key} className={ev.date < todayIso ? 'opacity-60' : ''}>
                          <button
                            type="button"
                            onClick={() => setDetail({ date: ev.date, events: [ev] })}
                            className={`w-full text-left rounded-lg border border-line border-l-[3px] ${kindOf(ev.kind).chip} bg-white px-3 py-2.5 hover:bg-canvas focus-visible:outline-2 focus-visible:outline-primary`}
                          >
                            <span className="flex items-center gap-2 text-xs text-ink-muted">
                              <span className="tabular-nums">
                                {WEEKDAY_NAMES[weekdayOf(ev.date)]} {isoToText(ev.date).slice(0, 5)}
                              </span>
                              {ev.date === todayIso && <span className="font-semibold text-primary">Hoy</span>}
                              <span className="ml-auto tabular-nums">{timeText(ev)}</span>
                            </span>
                            <span className="mt-1 block font-medium text-ink">{ev.title}</span>
                            <span className="mt-0.5 block text-xs text-ink-muted">
                              {kindOf(ev.kind).label} · {sectionText(ev)}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* ===================== Detalle del día ===================== */}
      <Modal
        isOpen={detail !== null}
        onClose={() => setDetail(null)}
        title={
          detail
            ? `${WEEKDAY_NAMES[weekdayOf(detail.date)]} ${Number(detail.date.slice(8, 10))} de ${MONTHS[Number(detail.date.slice(5, 7)) - 1].toLowerCase()}`
            : ''
        }
      >
        <ul className="divide-y divide-line pb-1">
          {(detail?.events ?? []).map((ev) => (
            <li key={ev.key} className="py-3 first:pt-0">
              <div className="flex items-center gap-2 text-xs text-ink-muted">
                <span className={`w-2.5 h-2.5 rounded-sm ${kindOf(ev.kind).dot}`} aria-hidden />
                <span className="font-medium text-ink">{kindOf(ev.kind).label}</span>
                <span>·</span>
                <span>{sectionText(ev)}</span>
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
        <div className="flex justify-end gap-3 pt-2">
          {detail && canRegisterOn(detail.date) && (
            <Button variant="outline" onClick={() => openRegister(detail.date)}>
              <Plus className="w-4 h-4" aria-hidden />
              Registrar evento este día
            </Button>
          )}
          <Button variant="outline" onClick={() => setDetail(null)}>
            Cerrar
          </Button>
        </div>
      </Modal>

      <RegisterEventModal
        isOpen={registerDate !== null}
        onClose={() => setRegisterDate(null)}
        courses={registrableCourses}
        defaultCourseId={registerCourseId}
        defaultDate={registerDate ?? ''}
        onCreated={retry}
      />

      {isSuperAdmin && (
        <RegisterHolidaysModal
          isOpen={holidaysOpen}
          onClose={() => setHolidaysOpen(false)}
          courses={registrableCourses}
          onDone={retry}
        />
      )}
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
