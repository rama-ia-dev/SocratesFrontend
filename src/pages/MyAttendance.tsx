import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, KeyRound, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';
import { AttendanceMethod, MyAttendanceList } from '../types/api';
import { PageHeader } from '../components/ui/PageHeader';
import { Select } from '../components/ui/Select';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { EmptyState, TableSkeleton } from '../components/ui/EmptyState';
import { Table, TableHeader, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { CheckInClass, CheckInModal } from '../components/CheckInModal';

// Asistencia mínima requerida: por debajo se marca en rojo
const MIN_ATTENDANCE = 80;

const METHOD_LABELS: Record<AttendanceMethod, string> = {
  code: 'Con código',
  manual: 'Por el docente',
  transcript: 'Desde el chat',
};

const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const pad2 = (n: number) => String(n).padStart(2, '0');
const localIso = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const dateText = (iso: string) => {
  const d = new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
  return `${WEEKDAYS[d.getDay()]} ${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
};
const hhmm = (time: string) => time.slice(0, 5);
const formatPct = (pct: number) => `${pct.toLocaleString('es-AR', { maximumFractionDigits: 1 })} %`;

/** Cuántas clases seguidas tiene que asistir para llegar al mínimo, o a cuántas puede faltar sin bajar. */
const marginText = (attended: number, total: number): string => {
  const pct = (attended / total) * 100;
  if (pct < MIN_ATTENDANCE) {
    // (a + n) / (t + n) >= 0,8  →  n >= 4t − 5a
    const needed = Math.ceil(4 * total - 5 * attended);
    return needed === 1
      ? `Para llegar al ${MIN_ATTENDANCE} % necesita asistir a la próxima clase.`
      : `Para llegar al ${MIN_ATTENDANCE} % necesita asistir a las próximas ${needed} clases.`;
  }
  // a / (t + k) >= 0,8  →  k <= 1,25a − t
  const allowed = Math.floor(1.25 * attended - total + 1e-9);
  if (allowed <= 0) return `Está justo en el mínimo: si falta a la próxima clase, queda por debajo del ${MIN_ATTENDANCE} %.`;
  return allowed === 1
    ? `Si falta a la próxima clase, sigue en el ${MIN_ATTENDANCE} % o más.`
    : `Si falta a las próximas ${allowed} clases, sigue en el ${MIN_ATTENDANCE} % o más.`;
};

export const MyAttendancePage: React.FC = () => {
  const [data, setData] = useState<MyAttendanceList | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [courseId, setCourseId] = useState<number | null>(null);
  // Clases de hoy de su curso lectivo, para registrar la asistencia con el código
  const [todayClasses, setTodayClasses] = useState<CheckInClass[]>([]);
  const [checkInClass, setCheckInClass] = useState<CheckInClass | null>(null);

  const load = useCallback(() => {
    setLoadError(false);
    return api
      .getMyAttendance()
      .then((res) => {
        setData(res);
        // Por defecto, el curso lectivo más reciente
        setCourseId((prev) =>
          prev !== null && res.section_years.some((s) => s.id_section_year === prev)
            ? prev
            : [...res.section_years].sort((a, b) => b.year - a.year)[0]?.id_section_year ?? null
        );
      })
      .catch(() => setLoadError(true));
  }, []);

  useEffect(() => {
    load();
    const today = localIso(new Date());
    api
      .getMySectionYears()
      .then((res) =>
        Promise.all(
          res.section_years.map(async (c) => {
            const cal = await api.getSectionYearCalendar(c.id_section_year, { from: today, to: today });
            return cal.classes.map((cl) => ({
              id: cl.id_calendar_class,
              title: cl.title || 'Clase',
              section_name: c.section_name,
              start: hhmm(cl.start_time),
              end: hhmm(cl.end_time),
            }));
          })
        )
      )
      .then((lists) => setTodayClasses(lists.flat()))
      // Sin cursada (solo inscripto) el backend no muestra el calendario: no hay clases para registrar
      .catch(() => setTodayClasses([]));
  }, [load]);

  const present = useMemo(() => new Set((data?.items ?? []).map((a) => a.id_calendar_class)), [data]);
  const pendingToday = todayClasses.filter((c) => !present.has(c.id));

  const courses = useMemo(
    () => [...(data?.section_years ?? [])].sort((a, b) => b.year - a.year || a.section_name.localeCompare(b.section_name, 'es')),
    [data]
  );
  const course = courses.find((c) => c.id_section_year === courseId) ?? null;
  const history = (data?.items ?? []).filter((a) => a.id_section_year === courseId);

  const header = <PageHeader title="Mi asistencia" subtitle="Su porcentaje de asistencia y las clases en las que figura presente" />;

  if (loadError) {
    return (
      <div>
        {header}
        <Alert
          action={
            <Button variant="outline" size="sm" onClick={load}>
              <RefreshCw className="w-4 h-4" aria-hidden />
              Reintentar
            </Button>
          }
        >
          No se pudo cargar su asistencia.
        </Alert>
      </div>
    );
  }

  const stats = course?.attendance;
  const pct = stats?.attendance_percentage ?? null;
  const low = pct !== null && pct < MIN_ATTENDANCE;

  return (
    <div>
      {header}

      <div className="space-y-4">
        {/* Clases de hoy en las que todavía no registró su asistencia */}
        {pendingToday.map((c) => (
          <Alert
            key={c.id}
            tone="info"
            action={
              <Button size="sm" onClick={() => setCheckInClass(c)}>
                <KeyRound className="w-3.5 h-3.5" aria-hidden />
                Registrar mi asistencia
              </Button>
            }
          >
            Hoy tiene clase de {c.section_name}
            {c.start ? ` de ${c.start}${c.end ? ` a ${c.end}` : ''}` : ''}. Cuando el docente habilite la asistencia,
            ingrese el código que le dé.
          </Alert>
        ))}

        {data === null ? (
          <TableSkeleton rows={4} cols={4} />
        ) : courses.length === 0 ? (
          <EmptyState
            icon={<ClipboardCheck className="w-6 h-6" />}
            message="Todavía no tiene asistencia para consultar"
            description="Cuando curse en un curso lectivo y se tome asistencia en sus clases, acá va a ver su porcentaje."
          />
        ) : (
          <>
            {courses.length > 1 && (
              <div className="sm:w-64">
                <Select
                  label="Curso lectivo"
                  value={courseId ?? ''}
                  onChange={(e) => setCourseId(Number(e.target.value))}
                >
                  {courses.map((c) => (
                    <option key={c.id_section_year} value={c.id_section_year}>
                      {c.section_name} · {c.year}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            {/* Resumen del curso lectivo */}
            {stats && (
              <section className="rounded-xl border border-line bg-white px-5 py-4" aria-label="Resumen de asistencia">
                <p className="text-[13px] text-ink-muted">
                  Asistencia en {course.section_name} {course.year}
                </p>
                {pct === null ? (
                  <p className="mt-1 text-sm text-ink-muted">Todavía no se tomó asistencia en ninguna clase.</p>
                ) : (
                  <>
                    <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className={`text-3xl font-semibold tabular-nums ${low ? 'text-danger' : 'text-success'}`}>
                        {formatPct(pct)}
                      </span>
                      <span className="text-sm text-ink-muted tabular-nums">
                        {stats.attended_classes} de {stats.total_classes} clases ·{' '}
                        {stats.total_classes - stats.attended_classes === 1
                          ? '1 falta'
                          : `${stats.total_classes - stats.attended_classes} faltas`}
                      </span>
                    </div>
                    <div
                      className="mt-3 h-2.5 rounded-full bg-line-neutral overflow-hidden"
                      role="progressbar"
                      aria-valuenow={pct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label="Porcentaje de asistencia"
                    >
                      <div className={`h-full ${low ? 'bg-danger-vivid' : 'bg-success-vivid'}`} style={{ width: `${pct}%` }} />
                    </div>
                    <p className={`mt-3 text-sm ${low ? 'text-danger' : 'text-ink-muted'}`}>
                      {low ? `Está por debajo del mínimo del ${MIN_ATTENDANCE} %. ` : ''}
                      {marginText(stats.attended_classes, stats.total_classes)}
                    </p>
                    <p className="mt-1 text-xs text-ink-faint">
                      Se cuentan las clases en las que el docente tomó asistencia.
                    </p>
                  </>
                )}
              </section>
            )}

            {/* Clases en las que figura presente */}
            <section aria-label="Clases con asistencia">
              <h2 className="mb-2 text-[15px] font-semibold text-ink">Clases en las que figura presente</h2>
              {history.length === 0 ? (
                <p className="text-sm text-ink-muted">Todavía no figura presente en ninguna clase de este curso lectivo.</p>
              ) : (
                <>
                  {/* Escritorio: tabla */}
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Clase</TableHead>
                          <TableHead>Horario</TableHead>
                          <TableHead>Registrada</TableHead>
                        </TableRow>
                      </TableHeader>
                      <tbody>
                        {history.map((a) => (
                          <TableRow key={a.id_attendance}>
                            <TableCell className="tabular-nums whitespace-nowrap">{dateText(a.date)}</TableCell>
                            <TableCell className="font-medium text-ink [overflow-wrap:anywhere]">{a.title || 'Clase'}</TableCell>
                            <TableCell className="text-ink-muted tabular-nums whitespace-nowrap">
                              {hhmm(a.start_time)} a {hhmm(a.end_time)}
                            </TableCell>
                            <TableCell className="text-ink-muted">{METHOD_LABELS[a.method] ?? a.method}</TableCell>
                          </TableRow>
                        ))}
                      </tbody>
                    </Table>
                  </div>

                  {/* Celular: una fila por clase */}
                  <ul className="md:hidden divide-y divide-line rounded-xl border border-line bg-white">
                    {history.map((a) => (
                      <li key={a.id_attendance} className="px-4 py-3">
                        <p className="text-sm font-medium text-ink [overflow-wrap:anywhere]">{a.title || 'Clase'}</p>
                        <p className="text-xs text-ink-muted tabular-nums">
                          {dateText(a.date)} · {hhmm(a.start_time)} a {hhmm(a.end_time)} · {METHOD_LABELS[a.method] ?? a.method}
                        </p>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          </>
        )}
      </div>

      <CheckInModal classInfo={checkInClass} onClose={() => setCheckInClass(null)} onDone={() => load()} />
    </div>
  );
};
