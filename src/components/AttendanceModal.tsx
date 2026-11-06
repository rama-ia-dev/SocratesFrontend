import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCheck, Search, Users } from 'lucide-react';
import { api } from '../lib/api';
import { fetchAll } from '../lib/pagination';
import { AttendanceMethod, AttendanceStudent, StudentListItem } from '../types/api';
import { Modal } from './ui/Modal';
import { Alert } from './ui/Alert';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Badge } from './ui/Badge';
import { SegmentedControl } from './ui/SegmentedControl';
import { EmptyState, TableSkeleton } from './ui/EmptyState';
import { useToast } from './ui/Toast';

/** Clase cuya asistencia se registra. */
export interface AttendanceClass {
  id: number; // id_calendar_class
  id_section_year: number;
  date: string; // ISO
  start: string | null; // HH:MM
  end: string | null;
  title: string; // para mostrar
  section_name: string;
}

/** Equipo del curso lectivo con sus integrantes en la asistencia de la clase. */
interface Team {
  id_project: number;
  group_number: number;
  name: string | null;
  members: AttendanceStudent[];
}

type View = 'students' | 'teams';

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

const matchesStudent = (s: AttendanceStudent, q: string) =>
  normalize(`${s.last_name} ${s.first_name}`).includes(q) || String(s.legajo).startsWith(q);

const teamLabel = (t: Team) => `Grupo ${t.group_number}${t.name ? ` · ${t.name}` : ''}`;

// Se pueden marcar los que cursan y todavía no figuran presentes
const markable = (s: AttendanceStudent) => s.state === 'attending' && !s.present;

const errorMessage = (err: any, marking: boolean): string => {
  if (err?.status === 403) return 'Solo un docente del curso lectivo o el administrador puede registrar asistencia.';
  if (err?.status === 422) return 'El alumno ya no está cursando este curso lectivo: no se puede marcar presente.';
  if (err?.status === 404)
    return marking ? 'La clase ya no existe. Recargue la página.' : 'El alumno ya no figuraba como presente.';
  return marking ? 'No se pudo marcar la asistencia. Intente de nuevo.' : 'No se pudo quitar la asistencia. Intente de nuevo.';
};

const teamErrorMessage = (err: any): string => {
  if (err?.status === 403) return 'Solo un docente del curso lectivo o el administrador puede registrar asistencia.';
  if (err?.status === 422)
    return 'Algún integrante ya no está cursando este curso lectivo: no se marcó a nadie del equipo. Se actualizó la lista.';
  if (err?.status === 409) return 'La asistencia cambió mientras se guardaba. Intente de nuevo.';
  if (err?.status === 404) return 'La clase ya no existe. Recargue la página.';
  return 'No se pudo marcar al equipo. Intente de nuevo.';
};

export interface AttendanceModalProps {
  classInfo: AttendanceClass | null;
  onClose: () => void;
}

export const AttendanceModal: React.FC<AttendanceModalProps> = ({ classInfo, onClose }) => {
  const { success } = useToast();
  const [students, setStudents] = useState<AttendanceStudent[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [view, setView] = useState<View>('students');
  // Equipo de cada alumno en el curso lectivo (id_student → equipo); null mientras carga
  const [teamOf, setTeamOf] = useState<Map<number, Omit<Team, 'members'>> | null>(null);
  const [teamsError, setTeamsError] = useState(false);
  // Cursadas con un cambio en curso: se deshabilita su casilla hasta que responda el backend
  const [pending, setPending] = useState<Set<number>>(new Set());
  const [markingTeam, setMarkingTeam] = useState<number | null>(null);

  const load = useCallback((id: number, quiet = false) => {
    if (!quiet) {
      setStudents(null);
      setLoadError(null);
    }
    return api
      .getClassAttendance(id)
      .then((res) => setStudents(res.items))
      .catch(() => !quiet && setLoadError('No se pudo cargar la asistencia de la clase.'));
  }, []);

  // Integrantes activos o finalizados de cada equipo del curso lectivo
  const loadTeams = useCallback((id_section_year: number) => {
    setTeamOf(null);
    setTeamsError(false);
    fetchAll<StudentListItem>((offset) =>
      api.getStudents({ id_section_year, kind: 'project', limit: 100, offset })
    )
      .then((items) => {
        const map = new Map<number, Omit<Team, 'members'>>();
        for (const st of items) {
          const g = st.groups.find((x) => x.id_section_year === id_section_year);
          if (g) map.set(st.id_student, { id_project: g.id_project, group_number: g.group_number, name: g.project_name ?? null });
        }
        setTeamOf(map);
      })
      .catch(() => setTeamsError(true));
  }, []);

  useEffect(() => {
    if (!classInfo) return;
    setQuery('');
    setError(null);
    setView('students');
    setPending(new Set());
    setMarkingTeam(null);
    load(classInfo.id);
    loadTeams(classInfo.id_section_year);
  }, [classInfo, load, loadTeams]);

  const q = normalize(query.trim());

  const visibleStudents = useMemo(
    () => (students ?? []).filter((s) => !q || matchesStudent(s, q)),
    [students, q]
  );

  // Equipos ordenados por número; los alumnos sin equipo quedan aparte. Con búsqueda, un equipo aparece
  // entero si coincide su nombre o número, o solo con los integrantes que coinciden.
  const { teams, withoutTeam } = useMemo(() => {
    const byProject = new Map<number, Team>();
    const loose: AttendanceStudent[] = [];
    for (const s of students ?? []) {
      const t = teamOf?.get(s.id_student);
      if (!t) {
        loose.push(s);
        continue;
      }
      if (!byProject.has(t.id_project)) byProject.set(t.id_project, { ...t, members: [] });
      byProject.get(t.id_project)!.members.push(s);
    }
    const all = [...byProject.values()].sort((a, b) => a.group_number - b.group_number);
    if (!q) return { teams: all, withoutTeam: loose };
    return {
      teams: all
        .map((t) =>
          normalize(teamLabel(t)).includes(q) ? t : { ...t, members: t.members.filter((s) => matchesStudent(s, q)) }
        )
        .filter((t) => t.members.length > 0),
      withoutTeam: loose.filter((s) => matchesStudent(s, q)),
    };
  }, [students, teamOf, q]);

  if (!classInfo) return null;

  const presentCount = students?.filter((s) => s.present).length ?? 0;

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

  // Marca presentes a los integrantes del equipo que cursan y todavía no figuran presentes. Se toman
  // de la lista completa, no de la filtrada por la búsqueda.
  const markTeam = async (team: Team) => {
    const full = (students ?? []).filter((s) => teamOf?.get(s.id_student)?.id_project === team.id_project);
    const ids = full.filter(markable).map((s) => s.id_student);
    if (ids.length === 0) return;
    setError(null);
    setMarkingTeam(team.id_project);
    try {
      const res = await api.markAttendanceBulk(classInfo.id, ids);
      success(
        res.created === 1
          ? `Se marcó presente a 1 integrante del grupo ${team.group_number}`
          : `Se marcó presentes a ${res.created} integrantes del grupo ${team.group_number}`
      );
      await load(classInfo.id, true);
    } catch (err: any) {
      setError(teamErrorMessage(err));
      load(classInfo.id, true);
    } finally {
      setMarkingTeam(null);
    }
  };

  const timeText = classInfo.start ? ` · ${classInfo.start}${classInfo.end ? `–${classInfo.end}` : ''}` : '';

  const renderRow = (s: AttendanceStudent) => (
    <StudentRow key={s.id_student_section_year} student={s} busy={pending.has(s.id_student_section_year) || markingTeam !== null} onToggle={toggle} />
  );

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
      ) : students.length === 0 ? (
        <EmptyState
          className="mt-4"
          icon={<Users className="w-5 h-5" aria-hidden />}
          message="No hay alumnos cursando"
          description="Aparecen los alumnos con cursada en este curso lectivo. Un alumno solo inscripto empieza a cursar al integrar un equipo."
        />
      ) : (
        <>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <SegmentedControl<View>
              label="Ver la asistencia"
              options={[
                { value: 'students', label: 'Por alumno' },
                { value: 'teams', label: 'Por equipo' },
              ]}
              value={view}
              onChange={setView}
            />
            <div className="sm:w-64">
              <Input
                type="search"
                placeholder={view === 'teams' ? 'Buscar alumno o equipo' : 'Buscar por nombre o legajo'}
                aria-label="Buscar"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                leftIcon={<Search className="w-4 h-4" aria-hidden />}
              />
            </div>
          </div>

          <p className="mt-3 text-sm text-ink-muted" aria-live="polite">
            <span className="font-semibold text-ink tabular-nums">{presentCount}</span> de{' '}
            <span className="tabular-nums">{students.length}</span> presentes
          </p>

          {view === 'students' ? (
            visibleStudents.length === 0 ? (
              <p className="mt-3 text-sm text-ink-muted">Ningún alumno coincide con la búsqueda.</p>
            ) : (
              <ul className="mt-2 max-h-[55vh] overflow-y-auto divide-y divide-line rounded-xl border border-line">
                {visibleStudents.map(renderRow)}
              </ul>
            )
          ) : teamsError ? (
            <div className="mt-3 space-y-3">
              <Alert>No se pudieron cargar los equipos del curso lectivo.</Alert>
              <Button variant="outline" size="sm" onClick={() => loadTeams(classInfo.id_section_year)}>
                Reintentar
              </Button>
            </div>
          ) : teamOf === null ? (
            <div className="mt-2">
              <TableSkeleton rows={4} cols={2} />
            </div>
          ) : teams.length === 0 && withoutTeam.length === 0 ? (
            <p className="mt-3 text-sm text-ink-muted">
              {q ? 'Ningún alumno ni equipo coincide con la búsqueda.' : 'No hay equipos en este curso lectivo.'}
            </p>
          ) : (
            <div className="mt-2 max-h-[55vh] overflow-y-auto space-y-3">
              {teams.map((t) => {
                const full = students.filter((s) => teamOf.get(s.id_student)?.id_project === t.id_project);
                const present = full.filter((s) => s.present).length;
                const toMark = full.filter(markable).length;
                return (
                  <section key={t.id_project} className="rounded-xl border border-line">
                    <header className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 bg-canvas rounded-t-xl border-b border-line">
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-semibold text-ink [overflow-wrap:anywhere]">{teamLabel(t)}</h4>
                        <p className="text-xs text-ink-muted tabular-nums">
                          {present} de {full.length} presentes
                        </p>
                      </div>
                      {toMark > 0 ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => markTeam(t)}
                          isLoading={markingTeam === t.id_project}
                          disabled={markingTeam !== null || full.some((s) => pending.has(s.id_student_section_year))}
                        >
                          {markingTeam !== t.id_project && <CheckCheck className="w-3.5 h-3.5" aria-hidden />}
                          Marcar equipo presente
                        </Button>
                      ) : (
                        present > 0 && <span className="text-xs font-medium text-success">Equipo completo</span>
                      )}
                    </header>
                    <ul className="divide-y divide-line">{t.members.map(renderRow)}</ul>
                  </section>
                );
              })}
              {withoutTeam.length > 0 && (
                <section className="rounded-xl border border-line">
                  <header className="px-4 py-2.5 bg-canvas rounded-t-xl border-b border-line">
                    <h4 className="text-sm font-semibold text-ink">Sin equipo</h4>
                  </header>
                  <ul className="divide-y divide-line">{withoutTeam.map(renderRow)}</ul>
                </section>
              )}
            </div>
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

/** Un alumno con su casilla de presente. */
const StudentRow: React.FC<{
  student: AttendanceStudent;
  busy: boolean;
  onToggle: (s: AttendanceStudent) => void;
}> = ({ student: s, busy, onToggle }) => {
  const finished = s.state !== 'attending';
  // Una cursada finalizada se puede desmarcar, pero no marcar de nuevo
  const disabled = busy || (finished && !s.present);
  const pct = s.attendance?.attendance_percentage;
  return (
    <li>
      <label
        className={`flex items-center gap-3 px-4 py-2.5 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-fill-neutral'}`}
        title={finished && !s.present ? 'La cursada ya finalizó: no se puede marcar presente.' : undefined}
      >
        <input
          type="checkbox"
          className="w-4 h-4 shrink-0 accent-primary"
          checked={s.present}
          disabled={disabled}
          onChange={() => onToggle(s)}
        />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-ink truncate">
            {s.last_name}, {s.first_name}
          </span>
          <span className="block text-xs text-ink-muted tabular-nums">
            Legajo {s.legajo}
            {pct !== null && pct !== undefined && ` · ${Math.round(pct)}% de asistencia`}
          </span>
        </span>
        {finished && <Badge>{STATE_LABELS[s.state] ?? 'Finalizada'}</Badge>}
        {s.present && s.method && <span className="text-xs text-ink-muted whitespace-nowrap">{METHOD_LABELS[s.method]}</span>}
      </label>
    </li>
  );
};
