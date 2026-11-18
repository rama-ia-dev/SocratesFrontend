import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import type { ActivityPublic, DeliveryComment, DeliveryPublic, ProjectMember, SectionYearScore } from '../types/api';
import { useAuth } from '../context/AuthContext';
import { PageHeader } from '../components/ui/PageHeader';
import { Select } from '../components/ui/Select';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Alert } from '../components/ui/Alert';
import { EmptyState, TableSkeleton } from '../components/ui/EmptyState';
import { DeliveryModal } from '../components/DeliveryModal';
import { FinalGradesModal, type FinalsMember } from '../components/FinalGradesModal';
import { formatDue, latestGrade, statusVariant } from '../lib/deliveries';
import {
  DOCUMENTS,
  DOCUMENT_SHORT,
  DOCUMENT_STATE_LABEL,
  documentStates,
  readFinals,
  type DocumentState,
  type FinalGrades,
} from '../lib/deliveryDocs';
import { CalendarX, ClipboardList, CloudOff, MessageSquare, RefreshCw, Users } from 'lucide-react';

interface CourseOption {
  id_section_year: number;
  label: string;
  year: number;
}

interface Team {
  id_project: number;
  group_number: number;
  name?: string | null;
  members: FinalsMember[];
}

// Integrantes activos, "Apellido, Nombre", en orden alfabético
const toMembers = (members: ProjectMember[]): FinalsMember[] =>
  members
    .map((m) => ({ id_student: m.id_student, name: `${m.last_name}, ${m.first_name}`, legajo: m.legajo }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));

// Estado de un documento en la tarjeta: punto de color y texto, sin pastilla, para que entre en una línea
const DocState: React.FC<{ state: DocumentState }> = ({ state }) =>
  state === 'none' ? (
    <span className="text-ink-subtle" aria-label={DOCUMENT_STATE_LABEL.none}>
      —
    </span>
  ) : (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap font-medium ${
        state === 'corrected' ? 'text-success' : 'text-warning'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${state === 'corrected' ? 'bg-success-vivid' : 'bg-warning-vivid'}`} aria-hidden="true" />
      {DOCUMENT_STATE_LABEL[state]}
    </span>
  );

// Una entrega está vencida cuando ya pasó su fecha y hora límite (sin hora, al final del día)
const isDue = (a: ActivityPublic) => new Date(`${a.due_date}T${a.due_time ?? '23:59:59'}`).getTime() < Date.now();

// Cada tarjeta ocupa cuatro filas de la grilla y las comparte con las demás tarjetas de su fila
// (subgrid): el título, la nota, los documentos y el pie quedan a la misma altura en todas.
const CARD_ROWS = 'row-span-4 grid grid-rows-subgrid gap-y-2.5';

/**
 * Una entrega de un equipo, en el orden de la planilla de notas de la cátedra: la nota de la
 * entrega, el estado de cada documento y los comentarios; el estado de la entrega va al final.
 */
const DeliveryCard: React.FC<{
  activity: ActivityPublic;
  d?: DeliveryPublic;
  comments: DeliveryComment[];
  onOpen: () => void;
}> = ({ activity, d, comments, onOpen }) => {
  const header = (
    <span className="block">
      <span className="block text-[13px] font-semibold text-ink line-clamp-2" title={activity.title}>
        {activity.title}
      </span>
      <span className="block text-xs text-ink-muted">{formatDue(activity.due_date, activity.due_time)}</span>
    </span>
  );

  if (!d) {
    return (
      <div className={`${CARD_ROWS} rounded-lg border border-dashed border-line px-2.5 py-2.5`}>
        {header}
        <span className="block text-xs italic text-ink-subtle">Sin entrega</span>
        <span />
        <span />
      </div>
    );
  }

  const grade = latestGrade(d, 'activity');
  const followUp = latestGrade(d, 'follow_up');
  const docs = documentStates(comments);

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${activity.title}, Equipo ${d.project.group_number}: ${grade ? grade.score.name : 'sin nota'}, ${d.status.name}`}
      className={`${CARD_ROWS} text-left rounded-lg border border-line bg-white px-2.5 py-2.5 hover:border-accent-light hover:bg-tint focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/15 transition-colors cursor-pointer`}
    >
      {header}
      <span className="block">
        <span className="block text-xs text-ink-muted">Nota de la entrega</span>
        {grade ? (
          <span className="block text-sm font-semibold text-ink">{grade.score.name}</span>
        ) : (
          <span className="block text-sm italic text-ink-subtle">Sin nota</span>
        )}
        {/* El seguimiento es opcional: aparece solo cuando se cargó */}
        {followUp && <span className="block text-xs text-ink-muted mt-0.5">Seguimiento: {followUp.score.name}</span>}
      </span>
      <span className="block space-y-1 border-t border-line pt-2">
        {DOCUMENTS.map((doc) => (
          <span key={doc} className="flex flex-wrap items-center justify-between gap-x-1.5 text-xs">
            <span className="text-ink-muted" title={doc}>
              {DOCUMENT_SHORT[doc]}
            </span>
            <DocState state={docs[doc]} />
          </span>
        ))}
      </span>
      <span className="flex flex-col items-start gap-1.5 border-t border-line pt-2">
        <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
          <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
          {comments.length === 0 ? 'Sin comentarios' : comments.length === 1 ? '1 comentario' : `${comments.length} comentarios`}
        </span>
        <Badge variant={statusVariant(d.status.code)}>{d.status.name}</Badge>
      </span>
    </button>
  );
};

/** Integrantes del equipo con su nota de regularización y de examen (una por alumno). */
const MembersPanel: React.FC<{ team: Team; finals: FinalGrades; onEdit: () => void }> = ({ team, finals, onEdit }) => {
  const any = Boolean(finals.deliveries) || Object.values(finals.students).some((s) => s.regularization || s.exam);
  return (
    <div className="rounded-lg border border-line bg-white">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-line">
        <span className="text-xs font-semibold text-ink">Integrantes</span>
        <button type="button" onClick={onEdit} className="text-xs text-primary font-medium hover:underline cursor-pointer">
          {any ? 'Modificar' : 'Cargar notas'}
        </button>
      </div>
      {team.members.length === 0 ? (
        <p className="px-3 py-2.5 text-xs italic text-ink-subtle">Sin integrantes</p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-ink-muted">
              <th className="px-3 pt-2 pb-1 text-left font-medium">Integrante</th>
              <th className="px-1 pt-2 pb-1 text-center font-medium" title="Regularización">
                Reg.
              </th>
              <th className="pl-1 pr-3 pt-2 pb-1 text-center font-medium">Examen</th>
            </tr>
          </thead>
          <tbody>
            {team.members.map((m) => {
              const s = finals.students[m.id_student];
              return (
                <tr key={m.id_student}>
                  <td className="px-3 py-1 text-ink [overflow-wrap:anywhere]">{m.name}</td>
                  <td className="px-1 py-1 text-center tabular-nums">
                    {s?.regularization ? <span className="font-semibold text-ink">{s.regularization}</span> : <span className="text-ink-subtle">—</span>}
                  </td>
                  <td className="pl-1 pr-3 py-1 text-center tabular-nums">
                    {s?.exam ? <span className="font-semibold text-ink">{s.exam}</span> : <span className="text-ink-subtle">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-line text-xs">
        <span className="text-ink-muted">Nota de las entregas del equipo</span>
        {finals.deliveries ? <span className="shrink-0 whitespace-nowrap font-semibold text-ink">{finals.deliveries}</span> : <span className="text-ink-subtle">—</span>}
      </div>
    </div>
  );
};

/**
 * Entregas de un curso lectivo (SCRUM-59 a 61 y 590), con el contenido de la planilla de notas de
 * la cátedra: un bloque por equipo, con sus integrantes y sus notas finales, y una tarjeta por
 * cada entrega del calendario. Las tarjetas se acomodan al ancho de la pantalla: en una pantalla
 * ancha quedan alineadas por entrega entre equipos y en el celular, una debajo de la otra.
 * Docentes del curso y administrador.
 */
export const Deliveries: React.FC = () => {
  const { user } = useAuth();
  const [courses, setCourses] = useState<CourseOption[] | null>(null);
  const [course, setCourse] = useState('');
  const [activities, setActivities] = useState<ActivityPublic[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  // Entrega de cada equipo para cada actividad: clave `${id_project}-${id_activity}`
  const [byKey, setByKey] = useState<Map<string, DeliveryPublic>>(new Map());
  // Comentarios de cada entrega, del más nuevo al más viejo
  const [commentsBy, setCommentsBy] = useState<Map<number, DeliveryComment[]>>(new Map());
  const [finalsBy, setFinalsBy] = useState<Map<number, FinalGrades>>(new Map());
  const [scores, setScores] = useState<SectionYearScore[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [open, setOpen] = useState<DeliveryPublic | null>(null);
  const [editingFinals, setEditingFinals] = useState<Team | null>(null);
  const requestId = useRef(0);

  // Cursos: los del docente o, para el administrador, todos. Arranca en el más nuevo.
  useEffect(() => {
    if (!user) return;
    const load = user.is_super_admin
      ? api.getSectionYears({ limit: 100 }).then((r) => r.items)
      : api.getProfessorSectionYears({ id_professor: user.id_user, limit: 100 }).then((r) => r.items);
    load
      .then((items) => {
        const list = items
          .map((c) => ({ id_section_year: c.id_section_year, label: `${c.section_name} (${c.year})`, year: c.year }))
          .sort((a, b) => b.year - a.year || a.label.localeCompare(b.label, 'es'));
        setCourses(list);
        if (list.length > 0) setCourse(String(list[0].id_section_year));
      })
      .catch(() => {
        setCourses([]);
        setLoadError(true);
      });
  }, [user]);

  const fetchSheet = useCallback(async () => {
    if (!course) return;
    const current = ++requestId.current;
    setIsLoading(true);
    setLoadError(false);
    try {
      const [actList, projects] = await Promise.all([
        api.getSectionYearActivities(Number(course)),
        api.getProjects({ id_section_year: Number(course), limit: 100 }),
      ]);
      const acts = actList.items.sort(
        (a, b) => a.due_date.localeCompare(b.due_date) || a.id_activity - b.id_activity
      );
      // El listado de equipos no trae los integrantes: se piden los activos de cada equipo
      const [deliveryLists, commentLists, memberLists] = await Promise.all([
        Promise.all(acts.map((a) => api.getActivityDeliveries(a.id_activity))),
        Promise.all(acts.map((a) => api.getActivityComments(a.id_activity))),
        Promise.all(projects.items.map((p) => api.getProjectMembers(p.id_project, ['active']))),
      ]);
      if (current !== requestId.current) return;
      const map = new Map<string, DeliveryPublic>();
      for (const d of deliveryLists.flat()) map.set(`${d.id_project}-${d.id_activity}`, d);
      const comments = new Map<number, DeliveryComment[]>();
      for (const c of commentLists.flat()) {
        comments.set(c.id_delivery, [...(comments.get(c.id_delivery) ?? []), c]);
      }
      setActivities(acts);
      setTeams(
        projects.items
          .map((p, i) => ({
            id_project: p.id_project,
            group_number: p.group_number,
            name: p.name,
            members: toMembers(memberLists[i].items),
          }))
          .sort((a, b) => a.group_number - b.group_number)
      );
      setByKey(map);
      setCommentsBy(comments);
      setFinalsBy(new Map(projects.items.map((p) => [p.id_project, readFinals(p.id_project)])));
    } catch {
      if (current === requestId.current) setLoadError(true);
    } finally {
      if (current === requestId.current) setIsLoading(false);
    }
  }, [course]);

  useEffect(() => {
    fetchSheet();
  }, [fetchSheet]);

  // Conceptos del curso lectivo, para la nota final de las entregas
  useEffect(() => {
    if (!course) return;
    api
      .getSectionYearScores(Number(course))
      .then((items) => setScores([...items].sort((a, b) => b.value - a.value)))
      .catch(() => setScores([]));
  }, [course]);

  const handleChanged = useCallback((d: DeliveryPublic) => {
    setByKey((prev) => new Map(prev).set(`${d.id_project}-${d.id_activity}`, d));
  }, []);

  const handleCommentsChanged = useCallback((id: number, list: DeliveryComment[]) => {
    setCommentsBy((prev) => new Map(prev).set(id, list));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="Entregas" subtitle="Nota, documentos y comentarios de cada equipo en cada entrega del curso lectivo" />

      <Alert tone="info">
        Las notas finales de cada equipo (la nota de las entregas, la de regularización y la de examen) se guardan, por
        el momento, solo en este navegador.
      </Alert>

      <div className="w-full sm:max-w-sm">
        <Select
          aria-label="Curso lectivo"
          value={course}
          disabled={!courses || courses.length === 0}
          onChange={(e) => setCourse(e.target.value)}
          options={
            courses === null
              ? [{ value: '', label: 'Cargando cursos lectivos…' }]
              : courses.map((c) => ({ value: c.id_section_year, label: c.label }))
          }
        />
      </div>

      {courses !== null && courses.length === 0 && !loadError ? (
        <EmptyState icon={<ClipboardList className="w-5 h-5" />} message="No tiene cursos lectivos asignados" />
      ) : loadError ? (
        <EmptyState
          icon={<CloudOff className="w-5 h-5" />}
          message="No se pudieron cargar las entregas"
          description="Puede ser un problema de conexión. Intente nuevamente en unos segundos."
          action={
            <Button variant="outline" size="sm" onClick={fetchSheet}>
              <RefreshCw className="w-4 h-4 mr-1.5" />
              Reintentar
            </Button>
          }
        />
      ) : isLoading || courses === null ? (
        <TableSkeleton rows={4} cols={4} />
      ) : activities.length === 0 ? (
        <EmptyState
          icon={<CalendarX className="w-5 h-5" />}
          message="Este curso lectivo no tiene entregas"
          description="Las entregas se cargan como eventos de tipo Entrega en el calendario."
          action={
            <Link to="/calendario" className="text-sm text-primary font-medium hover:underline">
              Ir al calendario
            </Link>
          }
        />
      ) : teams.length === 0 ? (
        <EmptyState icon={<Users className="w-5 h-5" />} message="Este curso lectivo no tiene equipos de trabajo" />
      ) : (
        <div className="space-y-4">
          {teams.map((t) => {
            // Al día: todas las entregas con la fecha vencida están aprobadas (las que todavía no
            // vencieron no cuentan). Sin ninguna vencida no hay nada para estar al día.
            const due = activities.filter((a) => isDue(a));
            const upToDate =
              due.length > 0 && due.every((a) => byKey.get(`${t.id_project}-${a.id_activity}`)?.status.code === 'approved');
            return (
            <section
              key={t.id_project}
              className={`rounded-xl border overflow-hidden ${upToDate ? 'border-success-line bg-success-soft' : 'border-line bg-white'}`}
            >
              <header
                className={`px-4 sm:px-5 py-3 border-b space-y-1.5 ${upToDate ? 'border-success-line' : 'bg-tint border-accent-light'}`}
              >
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <h2 className="text-[15px] font-semibold text-ink">
                    <Link to={`/equipos/${t.id_project}`} className="hover:text-primary hover:underline">
                      Equipo {t.group_number}
                    </Link>
                  </h2>
                  {t.name && <span className="text-sm text-ink-muted [overflow-wrap:anywhere]">{t.name}</span>}
                  {upToDate && (
                    <span className="self-center" title="Todas las entregas con la fecha vencida están aprobadas">
                      <Badge variant="public">Al día</Badge>
                    </span>
                  )}
                </div>
              </header>
              {/* En pantalla ancha, los integrantes a la izquierda y las entregas a la derecha; si no, uno arriba del otro */}
              <div className="p-3 sm:p-4 grid gap-4 xl:grid-cols-[15rem_minmax(0,1fr)] xl:items-start">
                <MembersPanel
                  team={t}
                  finals={finalsBy.get(t.id_project) ?? readFinals(t.id_project)}
                  onEdit={() => setEditingFinals(t)}
                />
                {/* Todas las entregas en una sola fila, en orden, con scroll horizontal propio; las tarjetas
                    tienen el mismo ancho y sus filas se alinean con las de sus vecinas */}
                <div className="min-w-0 overflow-x-auto p-1 -m-1 pb-2">
                <div className="grid grid-flow-col auto-cols-[13.25rem] grid-rows-[repeat(4,auto)] gap-x-3 w-max">
                {activities.map((a) => {
                  const d = byKey.get(`${t.id_project}-${a.id_activity}`);
                  return (
                    <DeliveryCard
                      key={a.id_activity}
                      activity={a}
                      d={d}
                      comments={d ? commentsBy.get(d.id_delivery) ?? [] : []}
                      onOpen={() => d && setOpen(d)}
                    />
                  );
                })}
                </div>
                </div>
              </div>
            </section>
            );
          })}
        </div>
      )}

      {open && (
        <DeliveryModal
          delivery={open}
          onClose={() => setOpen(null)}
          onChanged={handleChanged}
          onCommentsChanged={handleCommentsChanged}
        />
      )}

      {editingFinals && (
        <FinalGradesModal
          teamLabel={`Equipo ${editingFinals.group_number}`}
          id_project={editingFinals.id_project}
          members={editingFinals.members}
          initial={finalsBy.get(editingFinals.id_project) ?? readFinals(editingFinals.id_project)}
          scores={scores}
          onClose={() => setEditingFinals(null)}
          onSaved={(f) => setFinalsBy((prev) => new Map(prev).set(editingFinals.id_project, f))}
        />
      )}
    </div>
  );
};
