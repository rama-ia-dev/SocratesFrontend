import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, Users } from 'lucide-react';
import { api } from '../lib/api';
import { AttendanceMethod, AttendanceStudent } from '../types/api';
import { Modal } from './ui/Modal';
import { Alert } from './ui/Alert';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Badge } from './ui/Badge';
import { EmptyState, TableSkeleton } from './ui/EmptyState';

/** Clase cuya asistencia se registra. */
export interface AttendanceClass {
  id: number; // id_calendar_class
  date: string; // ISO
  start: string | null; // HH:MM
  end: string | null;
  title: string; // para mostrar
  section_name: string;
}

const WEEKDAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const dateText = (iso: string) => {
  const date = new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
  return `${WEEKDAY_NAMES[date.getDay()]} ${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
};

const METHOD_LABELS: Record<AttendanceMethod, string> = {
  code: 'Con código',
  manual: 'Manual',
  transcript: 'Desde el chat',
};

const STATE_LABELS: Record<string, string> = {
  finished_approved: 'Aprobó',
  finished_failed: 'Desaprobó',
};

// Sin tildes ni mayúsculas, para buscar "gomez" y encontrar "Gómez"
const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

const errorMessage = (err: any, marking: boolean): string => {
  if (err?.status === 403) return 'Solo un docente del curso lectivo o el administrador puede registrar asistencia.';
  if (err?.status === 422) return 'El alumno ya no está cursando este curso lectivo: no se puede marcar presente.';
  if (err?.status === 404) {
    // El backend responde 404 si no existe la clase, la cursada del alumno o (al desmarcar) la marca
    if (err?.detail === 'Calendar class not found') return 'La clase ya no existe. Recargue la página.';
    if (err?.detail === 'Student enrollment not found')
      return 'La cursada del alumno ya no existe. Se actualizó la lista.';
    return marking
      ? 'La clase o la cursada del alumno ya no existe. Recargue la página.'
      : 'El alumno ya no figuraba como presente.';
  }
  return marking ? 'No se pudo marcar la asistencia. Intente de nuevo.' : 'No se pudo quitar la asistencia. Intente de nuevo.';
};

export interface AttendanceModalProps {
  classInfo: AttendanceClass | null;
  onClose: () => void;
}

export const AttendanceModal: React.FC<AttendanceModalProps> = ({ classInfo, onClose }) => {
  const [students, setStudents] = useState<AttendanceStudent[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  // Cursadas con un cambio en curso: se deshabilita su casilla hasta que responda el backend
  const [pending, setPending] = useState<Set<number>>(new Set());
  // Cursadas finalizadas que se muestran: las que figuraban presentes al abrir. Se fijan en la carga
  // inicial para que, si el docente quita una, la fila no desaparezca mientras el modal está abierto.
  const [shownFinished, setShownFinished] = useState<Set<number>>(new Set());
  // Cursada finalizada a la que se le está por quitar la asistencia: como no se puede volver a marcar,
  // se pide confirmación en la misma fila
  const [confirming, setConfirming] = useState<number | null>(null);

  const load = useCallback(
    (id: number, quiet = false) => {
      if (!quiet) {
        setStudents(null);
        setLoadError(null);
      }
      return api
        .getClassAttendance(id)
        .then((res) => {
          setStudents(res.items);
          if (!quiet)
            setShownFinished(
              new Set(
                res.items.filter((s) => s.state !== 'attending' && s.present).map((s) => s.id_student_section_year)
              )
            );
        })
        .catch(() => !quiet && setLoadError('No se pudo cargar la asistencia de la clase.'));
    },
    []
  );

  useEffect(() => {
    if (!classInfo) return;
    setQuery('');
    setError(null);
    setPending(new Set());
    setConfirming(null);
    load(classInfo.id);
  }, [classInfo, load]);

  // Se listan los que están cursando y, de los finalizados, solo los que figuraban presentes: a una
  // cursada finalizada no se la puede marcar, pero su asistencia registrada se puede revisar o quitar.
  const listed = useMemo(
    () => (students ?? []).filter((s) => s.state === 'attending' || shownFinished.has(s.id_student_section_year)),
    [students, shownFinished]
  );

  const visible = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return listed;
    return listed.filter(
      (s) => normalize(`${s.last_name} ${s.first_name}`).includes(q) || String(s.legajo).startsWith(q)
    );
  }, [listed, query]);

  if (!classInfo) return null;

  // El total cuenta solo a los que están cursando; los finalizados presentes se informan aparte
  const attending = listed.filter((s) => s.state === 'attending');
  const presentCount = attending.filter((s) => s.present).length;
  const finishedPresent = listed.filter((s) => s.state !== 'attending' && s.present).length;

  const toggle = async (student: AttendanceStudent) => {
    const id = student.id_student_section_year;
    const marking = !student.present;
    setError(null);
    setPending((prev) => new Set(prev).add(id));
    try {
      if (marking) {
        const saved = await api.markAttendance(classInfo.id, id);
        setStudents((prev) =>
          (prev ?? []).map((s) =>
            s.id_student_section_year === id
              ? { ...s, present: true, method: saved.method, recorded_at: saved.recorded_at }
              : s
          )
        );
      } else {
        await api.unmarkAttendance(classInfo.id, id);
        setStudents((prev) =>
          (prev ?? []).map((s) =>
            s.id_student_section_year === id ? { ...s, present: false, method: null, recorded_at: null } : s
          )
        );
      }
      // Se recarga en segundo plano para actualizar el porcentaje de asistencia
      load(classInfo.id, true);
    } catch (err: any) {
      setError(errorMessage(err, marking));
      load(classInfo.id, true);
    } finally {
      setPending((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const timeText = classInfo.start ? ` · ${classInfo.start}${classInfo.end ? `–${classInfo.end}` : ''}` : '';

  return (
    <Modal isOpen onClose={onClose} title="Asistencia" maxWidth="xl">
      <p className="text-sm text-ink">
        <span className="font-medium [overflow-wrap:anywhere]">{classInfo.title}</span> · {classInfo.section_name} ·{' '}
        {dateText(classInfo.date)}
        {timeText}
      </p>

      {error && <Alert className="mt-4">{error}</Alert>}

      {loadError ? (
        <div className="mt-4 space-y-3">
          <Alert>{loadError}</Alert>
          <Button variant="outline" size="sm" onClick={() => load(classInfo.id)}>
            Reintentar
          </Button>
        </div>
      ) : students === null ? (
        <div className="mt-4">
          <TableSkeleton rows={5} cols={3} />
        </div>
      ) : listed.length === 0 ? (
        students.length === 0 ? (
          <EmptyState
            className="mt-4"
            icon={<Users className="w-5 h-5" aria-hidden />}
            message="No hay alumnos cursando"
            description="Aparecen los alumnos con cursada en este curso lectivo. Un alumno solo inscripto empieza a cursar al integrar un equipo."
          />
        ) : (
          <EmptyState
            className="mt-4"
            icon={<Users className="w-5 h-5" aria-hidden />}
            message="Nadie figura presente"
            description="Los alumnos de este curso lectivo ya terminaron la cursada: no se los puede marcar presentes."
          />
        )
      ) : (
        <>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-ink-muted tabular-nums" aria-live="polite">
              {attending.length > 0 ? (
                <>
                  <span className="font-semibold text-ink">{presentCount}</span> de {attending.length} presentes
                  {finishedPresent > 0 && `, más ${finishedPresent} con la cursada finalizada`}
                </>
              ) : (
                <>
                  <span className="font-semibold text-ink">{finishedPresent}</span>{' '}
                  {finishedPresent === 1 ? 'presente' : 'presentes'} con la cursada finalizada
                </>
              )}
            </p>
            <div className="sm:w-64">
              <Input
                type="search"
                placeholder="Buscar por nombre o legajo"
                aria-label="Buscar alumno"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                leftIcon={<Search className="w-4 h-4" aria-hidden />}
              />
            </div>
          </div>

          {visible.length === 0 ? (
            <p className="mt-4 text-sm text-ink-muted">Ningún alumno coincide con la búsqueda.</p>
          ) : (
            <ul className="mt-3 max-h-[55vh] overflow-y-auto divide-y divide-line rounded-xl border border-line">
              {visible.map((s) => {
                const id = s.id_student_section_year;
                const finished = s.state !== 'attending';
                // Una cursada finalizada se puede desmarcar, pero no marcar de nuevo
                const disabled = pending.has(id) || (finished && !s.present);
                const pct = s.attendance?.attendance_percentage;
                return (
                  <li key={id}>
                    <label
                      className={`flex items-center gap-3 px-4 py-2.5 ${
                        disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-fill-neutral'
                      }`}
                      title={finished && !s.present ? 'La cursada ya finalizó: no se puede marcar presente.' : undefined}
                    >
                      <input
                        type="checkbox"
                        className="w-4 h-4 shrink-0 accent-primary"
                        checked={s.present}
                        disabled={disabled}
                        onChange={() => {
                          if (finished && s.present) setConfirming(confirming === id ? null : id);
                          else toggle(s);
                        }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-ink [overflow-wrap:anywhere]">
                          {s.last_name}, {s.first_name}
                        </span>
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted tabular-nums">
                          <span>
                            Legajo {s.legajo}
                            {pct !== null && pct !== undefined && ` · ${Math.round(pct)}% de asistencia`}
                          </span>
                          {finished && <Badge>{STATE_LABELS[s.state] ?? 'Finalizada'}</Badge>}
                        </span>
                      </span>
                      {s.present && s.method && (
                        <span className="text-xs text-ink-muted whitespace-nowrap">{METHOD_LABELS[s.method]}</span>
                      )}
                    </label>
                    {confirming === id && (
                      <div className="px-4 pb-3">
                        <Alert tone="warning">
                          <p>
                            La cursada de {s.last_name}, {s.first_name} ya finalizó: si le quitás la asistencia,
                            no se va a poder volver a marcar.
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => {
                                setConfirming(null);
                                toggle(s);
                              }}
                            >
                              Quitar asistencia
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setConfirming(null)}>
                              Cancelar
                            </Button>
                          </div>
                        </Alert>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      <div className="mt-4 flex justify-end pt-3 border-t border-line">
        <Button variant="outline" onClick={onClose}>
          Cerrar
        </Button>
      </div>
    </Modal>
  );
};
