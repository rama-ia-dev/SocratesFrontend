import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCheck, KeyRound, RefreshCw, Search, Users } from 'lucide-react';
import { api } from '../lib/api';
import { fetchAll } from '../lib/pagination';
import { AttendanceMethod, AttendanceStudent, ClassAttendance, StudentListItem } from '../types/api';
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

const teamLabel = (t: Team) => `Equipo ${t.group_number}${t.name ? ` · ${t.name}` : ''}`;

// Se pueden marcar los que cursan y todavía no figuran presentes
const markable = (s: AttendanceStudent) => s.state === 'attending' && !s.present;

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

// Códigos generados en esta pestaña (id de la clase → código y vencimiento). El backend no vuelve a
// mostrar un código: así se puede cerrar y reabrir el modal sin perderlo mientras siga vigente.
const issuedCodes = new Map<number, { code: string; expires_at: string }>();

const pad2 = (n: number) => String(n).padStart(2, '0');
const localIso = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const countdownText = (ms: number) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${pad2(total % 60)}`;
};
const clockText = (iso: string) => {
  const d = new Date(iso);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

const codeErrorMessage = (err: any, opening: boolean): string => {
  if (err?.status === 403)
    return `Solo un docente del curso lectivo o el administrador puede ${opening ? 'habilitar' : 'cerrar'} la asistencia con código.`;
  if (err?.status === 404) return opening ? 'La clase ya no existe. Recargue la página.' : 'La asistencia con código ya estaba cerrada.';
  return opening
    ? 'No se pudo habilitar la asistencia con código. Intente de nuevo.'
    : 'No se pudo cerrar la asistencia con código. Intente de nuevo.';
};

const teamErrorMessage =(err: any): string => {
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
  // Toma de asistencia con código: estado según el backend, código generado y reloj de la cuenta regresiva
  const [session, setSession] = useState<ClassAttendance['session']>(null);
  const [code, setCode] = useState<{ code: string; expires_at: string } | null>(null);
  const [codeBusy, setCodeBusy] = useState<'open' | 'close' | null>(null);
  const [now, setNow] = useState(() => Date.now());

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
        setSession(null);
      }
      return api
        .getClassAttendance(id)
        .then((res) => {
          setStudents(res.items);
          setSession(res.session);
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
    setCodeBusy(null);
    setCode(issuedCodes.get(classInfo.id) ?? null);
    setNow(Date.now());
    setConfirming(null);
    load(classInfo.id);
    loadTeams(classInfo.id_section_year);
  }, [classInfo, load, loadTeams]);

  // Se listan los que están cursando y, de los finalizados, solo los que figuraban presentes: a una
  // cursada finalizada no se la puede marcar, pero su asistencia registrada se puede revisar o quitar.
  const listed = useMemo(
    () => (students ?? []).filter((s) => s.state === 'attending' || shownFinished.has(s.id_student_section_year)),
    [students, shownFinished]
  );

  const q = normalize(query.trim());

  const visibleStudents = useMemo(
    () => listed.filter((s) => !q || matchesStudent(s, q)),
    [listed, q]
  );

  // Equipos ordenados por número; los alumnos sin equipo quedan aparte. Con búsqueda, un equipo aparece
  // entero si coincide su nombre o número, o solo con los integrantes que coinciden.
  const { teams, withoutTeam } = useMemo(() => {
    const byProject = new Map<number, Team>();
    const loose: AttendanceStudent[] = [];
    for (const s of listed) {
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
  }, [listed, teamOf, q]);

  // La asistencia con código vale mientras la toma no esté cerrada ni vencida
  const codeOpen = !!session && !session.closed_at && new Date(session.expires_at).getTime() > now;
  // El código se conoce solo si se generó en esta pestaña y es el vigente
  const visibleCode = codeOpen && code && code.expires_at === session?.expires_at ? code.code : null;

  // Mientras está habilitada, la cuenta regresiva avanza cada segundo y la lista se actualiza cada 5
  // segundos con los alumnos que van ingresando el código
  useEffect(() => {
    if (!classInfo || !codeOpen) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(() => load(classInfo.id, true), 5000);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [classInfo, codeOpen, load]);

  // Cuando el código vence, la lista se actualiza una última vez: así aparecen los alumnos que lo
  // ingresaron después de la última actualización automática
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !codeOpen && classInfo) load(classInfo.id, true);
    wasOpen.current = codeOpen;
  }, [codeOpen, classInfo, load]);

  if (!classInfo) return null;

  // El código se habilita solo el día de la clase
  const isToday = classInfo.date === localIso(new Date());

  const openCode = async () => {
    setError(null);
    setCodeBusy('open');
    try {
      const res = await api.openAttendance(classInfo.id);
      const issued = { code: res.code, expires_at: res.expires_at };
      issuedCodes.set(classInfo.id, issued);
      setCode(issued);
      setNow(Date.now());
      await load(classInfo.id, true);
    } catch (err: any) {
      setError(codeErrorMessage(err, true));
    } finally {
      setCodeBusy(null);
    }
  };

  const closeCode = async () => {
    setError(null);
    setCodeBusy('close');
    try {
      await api.closeAttendance(classInfo.id);
      issuedCodes.delete(classInfo.id);
      setCode(null);
    } catch (err: any) {
      if (err?.status !== 404) setError(codeErrorMessage(err, false));
    } finally {
      await load(classInfo.id, true);
      setCodeBusy(null);
    }
  };

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
          ? `Se marcó presente a 1 integrante del Equipo ${team.group_number}`
          : `Se marcó presentes a ${res.created} integrantes del Equipo ${team.group_number}`
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
    <StudentRow
      key={s.id_student_section_year}
      student={s}
      busy={pending.has(s.id_student_section_year) || markingTeam !== null}
      confirming={confirming === s.id_student_section_year}
      onToggle={toggle}
      onConfirmChange={(open) => setConfirming(open ? s.id_student_section_year : null)}
    />
  );

  return (
    <Modal isOpen onClose={onClose} title="Asistencia" maxWidth="xl">
      <p className="text-sm text-ink">
        <span className="font-medium [overflow-wrap:anywhere]">{classInfo.title}</span> · {classInfo.section_name} ·{' '}
        {dateText(classInfo.date)}
        {timeText}
      </p>

      {isToday && students !== null && !loadError && (
        <CodePanel
          open={codeOpen}
          code={visibleCode}
          expiresAt={session?.expires_at ?? null}
          remaining={session ? new Date(session.expires_at).getTime() - now : 0}
          wasOpened={!!session}
          busy={codeBusy}
          onOpen={openCode}
          onClose={closeCode}
        />
      )}

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

          <p className="mt-3 text-sm text-ink-muted tabular-nums" aria-live="polite">
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
                const full = listed.filter((s) => teamOf.get(s.id_student)?.id_project === t.id_project);
                const present = full.filter((s) => s.present).length;
                const toMark = full.filter(markable).length;
                return (
                  <section key={t.id_project} className="rounded-xl border border-line">
                    <header className="flex items-center gap-3 px-4 py-2.5 bg-canvas rounded-t-xl border-b border-line">
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-semibold text-ink [overflow-wrap:anywhere]">{teamLabel(t)}</h4>
                        <p className="text-xs text-ink-muted tabular-nums">
                          {present} de {full.length} presentes
                        </p>
                      </div>
                      {toMark > 0 ? (
                        // En pantallas chicas el texto se acorta y va en dos líneas para no bajar de renglón
                        <Button
                          variant="secondary"
                          size="sm"
                          className="shrink-0 h-auto min-h-8 py-1 sm:h-8 sm:py-0"
                          aria-label={`Marcar presente al ${teamLabel(t)}`}
                          onClick={() => markTeam(t)}
                          isLoading={markingTeam === t.id_project}
                          disabled={markingTeam !== null || full.some((s) => pending.has(s.id_student_section_year))}
                        >
                          {markingTeam !== t.id_project && <CheckCheck className="w-3.5 h-3.5 shrink-0" aria-hidden />}
                          <span className="sm:hidden text-left leading-tight">
                            Marcar
                            <br />
                            todos
                          </span>
                          <span className="hidden sm:inline">Marcar equipo presente</span>
                        </Button>
                      ) : (
                        present > 0 && (
                          <span className="shrink-0 text-right text-xs font-medium leading-tight text-success">
                            Equipo
                            <br className="sm:hidden" /> completo
                          </span>
                        )
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

/** Asistencia con código: habilitarla, mostrar el código con su vencimiento, generar otro o cerrarla. */
const CodePanel: React.FC<{
  open: boolean;
  code: string | null;
  expiresAt: string | null;
  remaining: number;
  wasOpened: boolean;
  busy: 'open' | 'close' | null;
  onOpen: () => void;
  onClose: () => void;
}> = ({ open, code, expiresAt, remaining, wasOpened, busy, onOpen, onClose }) => (
  <section className="mt-4 rounded-xl border border-line bg-canvas px-4 py-3" aria-label="Asistencia con código">
    {!open ? (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink-muted">
          {wasOpened
            ? 'La asistencia con código está cerrada. Puede habilitarla de nuevo con un código nuevo.'
            : 'Habilite la asistencia con código para que los alumnos la registren desde el calendario.'}
        </p>
        <Button size="sm" className="shrink-0" onClick={onOpen} isLoading={busy === 'open'} disabled={busy !== null}>
          {busy !== 'open' && <KeyRound className="w-3.5 h-3.5" aria-hidden />}
          Habilitar asistencia con código
        </Button>
      </div>
    ) : (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {code ? (
          <div>
            <p className="text-xs text-ink-muted">Código para los alumnos</p>
            <p className="font-mono text-3xl font-semibold tracking-[0.3em] text-navy tabular-nums">{code}</p>
            <p className="text-xs text-ink-muted tabular-nums">Vence en {countdownText(remaining)}</p>
          </div>
        ) : (
          <p className="text-sm text-ink-muted">
            La asistencia con código está habilitada hasta las {expiresAt ? clockText(expiresAt) : ''}. El código se
            muestra solo al generarlo: genere uno nuevo para verlo.
          </p>
        )}
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button variant="secondary" size="sm" onClick={onOpen} isLoading={busy === 'open'} disabled={busy !== null}>
            {busy !== 'open' && <RefreshCw className="w-3.5 h-3.5" aria-hidden />}
            Generar código nuevo
          </Button>
          <Button variant="outline" size="sm" onClick={onClose} isLoading={busy === 'close'} disabled={busy !== null}>
            Cerrar asistencia con código
          </Button>
        </div>
      </div>
    )}
  </section>
);

/** Un alumno con su casilla de presente. */
const StudentRow: React.FC<{
  student: AttendanceStudent;
  busy: boolean;
  confirming: boolean;
  onToggle: (s: AttendanceStudent) => void;
  onConfirmChange: (open: boolean) => void;
}> = ({ student: s, busy, confirming, onToggle, onConfirmChange }) => {
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
          onChange={() => {
            // Quitarle la asistencia a una cursada finalizada pide confirmación: no se puede volver a marcar
            if (finished && s.present) onConfirmChange(!confirming);
            else onToggle(s);
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
        {s.present && s.method && <span className="text-xs text-ink-muted whitespace-nowrap">{METHOD_LABELS[s.method]}</span>}
      </label>
      {confirming && (
        <div className="px-4 pb-3">
          <Alert tone="warning">
            <p>
              La cursada de {s.last_name}, {s.first_name} ya finalizó: si se quita la asistencia, no se podrá volver a
              marcar.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  onConfirmChange(false);
                  onToggle(s);
                }}
              >
                Quitar asistencia
              </Button>
              <Button variant="outline" size="sm" onClick={() => onConfirmChange(false)}>
                Cancelar
              </Button>
            </div>
          </Alert>
        </div>
      )}
    </li>
  );
};
