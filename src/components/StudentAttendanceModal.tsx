import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { api } from '../lib/api';
import { AttendanceMethod, MyAttendanceList } from '../types/api';
import { Modal } from './ui/Modal';
import { Alert } from './ui/Alert';
import { Button } from './ui/Button';
import { TableSkeleton } from './ui/EmptyState';

// Asistencia mínima requerida: por debajo se marca en rojo
const MIN_ATTENDANCE = 80;

const METHOD_LABELS: Record<AttendanceMethod, string> = {
  code: 'Con código',
  manual: 'Por el docente',
  transcript: 'Desde el chat',
};

const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const dateText = (iso: string) => {
  const d = new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
  return `${WEEKDAYS[d.getDay()]} ${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
};
const shortDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const hhmm = (time: string) => time.slice(0, 5);
const formatPct = (pct: number) => `${pct.toLocaleString('es-AR', { maximumFractionDigits: 1 })} %`;

/** Alumno cuyo detalle se muestra. */
export interface AttendanceStudentInfo {
  id_student: number;
  first_name: string;
  last_name: string;
  legajo: number;
}

export interface StudentAttendanceModalProps {
  student: AttendanceStudentInfo | null;
  // Curso lectivo que se está consultando: el alumno puede tener cursadas en otros
  id_section_year: number;
  course_label: string; // por ejemplo "3K1 2026"
  // Mismo rango que el listado, para que los números coincidan
  range: { from?: string; to?: string };
  onClose: () => void;
}

/**
 * Detalle de la asistencia de un alumno para el docente: el resumen y las clases en las que figura
 * presente, igual que lo ve el alumno en "Mi asistencia".
 */
export const StudentAttendanceModal: React.FC<StudentAttendanceModalProps> = ({
  student,
  id_section_year,
  course_label,
  range,
  onClose,
}) => {
  const [data, setData] = useState<MyAttendanceList | null>(null);
  const [loadError, setLoadError] = useState(false);

  const id_student = student?.id_student ?? null;
  const { from, to } = range;
  const load = useCallback(() => {
    if (id_student === null) return () => {};
    let active = true;
    setData(null);
    setLoadError(false);
    api
      .getStudentAttendance(id_student, { from, to })
      .then((res) => active && setData(res))
      .catch(() => active && setLoadError(true));
    return () => {
      active = false;
    };
  }, [id_student, from, to]);

  useEffect(() => load(), [load]);

  if (!student) return null;

  const course = data?.section_years.find((s) => s.id_section_year === id_section_year) ?? null;
  const stats = course?.attendance;
  const pct = stats?.attendance_percentage ?? null;
  const low = pct !== null && pct < MIN_ATTENDANCE;
  const history = (data?.items ?? []).filter((a) => a.id_section_year === id_section_year);

  // Agrupado por mes; el backend ya las devuelve de la más nueva a la más vieja
  const historyByMonth: { month: string; items: typeof history }[] = [];
  for (const a of history) {
    const month = a.date.slice(0, 7);
    const last = historyByMonth[historyByMonth.length - 1];
    if (last?.month === month) last.items.push(a);
    else historyByMonth.push({ month, items: [a] });
  }

  return (
    <Modal isOpen onClose={onClose} title={`${student.last_name}, ${student.first_name}`} maxWidth="lg">
      <p className="-mt-1 mb-4 text-sm text-ink-muted tabular-nums">
        Legajo {student.legajo} · {course_label}
        {from && to ? ` · del ${shortDate(from)} al ${shortDate(to)}` : ''}
      </p>

      {loadError ? (
        <Alert
          action={
            <Button variant="outline" size="sm" onClick={load}>
              <RefreshCw className="w-4 h-4" aria-hidden />
              Reintentar
            </Button>
          }
        >
          No se pudo cargar la asistencia del alumno.
        </Alert>
      ) : data === null ? (
        <TableSkeleton rows={3} cols={3} />
      ) : (
        <div className="space-y-5">
          {/* Resumen del curso lectivo */}
          <section className="rounded-xl border border-line bg-white px-5 py-4" aria-label="Resumen de asistencia">
            {pct === null || !stats ? (
              <p className="text-sm text-ink-muted">Todavía no se tomó asistencia en ninguna clase.</p>
            ) : (
              <>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
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
                {/* Barra con una marca en el mínimo */}
                <div className="relative mt-3 pb-5">
                  <div
                    className="h-2.5 rounded-full bg-line-neutral overflow-hidden"
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Porcentaje de asistencia (mínimo ${MIN_ATTENDANCE} %)`}
                  >
                    <div className={`h-full ${low ? 'bg-danger-vivid' : 'bg-success-vivid'}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div
                    className="absolute -top-1 h-[18px] w-0.5 -translate-x-1/2 rounded-full bg-ink"
                    style={{ left: `${MIN_ATTENDANCE}%` }}
                    aria-hidden
                  />
                  <span
                    className="absolute bottom-0 -translate-x-1/2 text-[11px] font-medium text-ink-muted tabular-nums whitespace-nowrap"
                    style={{ left: `${MIN_ATTENDANCE}%` }}
                    aria-hidden
                  >
                    Mínimo {MIN_ATTENDANCE} %
                  </span>
                </div>
                {low && (
                  <p className="mt-2 text-sm text-danger">Está por debajo del mínimo del {MIN_ATTENDANCE} %.</p>
                )}
                <p className="mt-1 text-xs text-ink-faint">Se cuentan las clases en las que se tomó asistencia.</p>
              </>
            )}
          </section>

          {/* Clases en las que figura presente */}
          <section aria-label="Clases con asistencia">
            <h3 className="mb-2 text-[15px] font-semibold text-ink">Clases en las que figura presente</h3>
            {history.length === 0 ? (
              <p className="text-sm text-ink-muted">Todavía no figura presente en ninguna clase de este curso lectivo.</p>
            ) : (
              <div className="space-y-4">
                {historyByMonth.map((g) => (
                  <div key={g.month}>
                    <h4 className="text-xs font-semibold text-navy">
                      {MONTHS[Number(g.month.slice(5, 7)) - 1]}{' '}
                      <span className="font-normal text-ink-muted">
                        · {g.items.length === 1 ? '1 clase' : `${g.items.length} clases`}
                      </span>
                    </h4>
                    <ul className="mt-2 divide-y divide-line rounded-xl border border-line bg-white">
                      {g.items.map((a) => (
                        <li
                          key={a.id_attendance}
                          className="flex flex-col gap-0.5 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-ink [overflow-wrap:anywhere]">{a.title || 'Clase'}</p>
                            <p className="text-xs text-ink-muted tabular-nums">
                              {dateText(a.date)} · {hhmm(a.start_time)} a {hhmm(a.end_time)}
                            </p>
                          </div>
                          <span className="shrink-0 text-xs text-ink-muted">{METHOD_LABELS[a.method] ?? a.method}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </Modal>
  );
};
