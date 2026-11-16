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
import { FinalGradesModal } from '../components/FinalGradesModal';
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
  members: string[];
}

// Integrantes, "Apellido, Nombre", en orden alfabético
const memberNames = (members: ProjectMember[]) =>
  members.map((m) => `${m.last_name}, ${m.first_name}`).sort((a, b) => a.localeCompare(b, 'es'));

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
      <span className="block text-[13px] font-semibold text-ink [overflow-wrap:anywhere]">{activity.title}</span>
      <span className="block text-xs text-ink-muted">{formatDue(activity.due_date, activity.due_time)}</span>
    </span>
  );

  if (!d) {
    return (
      <div className="rounded-lg border border-dashed border-line px-3 py-2.5 space-y-2">
        {header}
        <span className="block text-xs italic text-ink-subtle">Sin entrega</span>
      </div>
    );
  }

  const grade = latestGrade(d, 'activity');
  const docs = documentStates(comments);

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${activity.title}, Equipo ${d.project.group_number}: ${grade ? grade.score.name : 'sin nota'}, ${d.status.name}`}
      className="w-full h-full flex flex-col justify-start text-left rounded-lg border border-line bg-white px-3 py-2.5 space-y-2.5 hover:border-accent-light hover:bg-tint focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/15 transition-colors cursor-pointer"
    >
      {header}
      <span className="block">
        <span className="block text-xs text-ink-muted">Nota de la entrega</span>
        {grade ? (
          <span className="block text-sm font-semibold text-ink">{grade.score.name}</span>
        ) : (
          <span className="block text-sm italic text-ink-subtle">Sin nota</span>
        )}
      </span>
      <span className="block space-y-1 border-t border-line pt-2">
        {DOCUMENTS.map((doc) => (
          <span key={doc} className="flex flex-wrap items-center justify-between gap-x-2 text-xs">
            <span className="text-ink-muted" title={doc}>
              {DOCUMENT_SHORT[doc]}
            </span>
            <DocState state={docs[doc]} />
          </span>
        ))}
      </span>
      <span className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2">
        <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
          <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
          {comments.length === 0 ? 'Sin comentarios' : comments.length === 1 ? '1 comentario' : `${comments.length} comentarios`}
        </span>
        <Badge variant={statusVariant(d.status.code)}>{d.status.name}</Badge>
      </span>
    </button>
  );
};

const FinalsSummary: React.FC<{ finals: FinalGrades; onEdit: () => void }> = ({ finals, onEdit }) => {
  const items: [string, string][] = [
    ['Entregas', finals.deliveries],
    ['Regularización', finals.regularization],
    ['Examen', finals.exam],
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
      <span className="font-medium text-ink">Notas finales</span>
      {items.map(([label, value]) => (
        <span key={label} className="text-ink-muted">
          {label}: {value ? <span className="font-semibold text-ink">{value}</span> : <span className="text-ink-subtle">—</span>}
        </span>
      ))}
      <button type="button" onClick={onEdit} className="text-primary font-medium hover:underline cursor-pointer">
        {items.some(([, v]) => v) ? 'Modificar' : 'Cargar'}
      </button>
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
            members: memberNames(memberLists[i].items),
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
        Vista previa para el equipo: el estado de cada documento sale de las devoluciones que lo nombran, y las notas
        finales se guardan solo en este navegador. Falta que el backend guarde el documento de cada devolución y las
        notas finales.
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
          {teams.map((t) => (
            <section key={t.id_project} className="rounded-xl border border-line bg-white overflow-hidden">
              <header className="px-4 sm:px-5 py-3 bg-tint border-b border-accent-light space-y-1.5">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <h2 className="text-[15px] font-semibold text-ink">
                    <Link to={`/equipos/${t.id_project}`} className="hover:text-primary hover:underline">
                      Equipo {t.group_number}
                    </Link>
                  </h2>
                  {t.name && <span className="text-sm text-ink-muted [overflow-wrap:anywhere]">{t.name}</span>}
                </div>
                <p className="text-xs text-ink-muted [overflow-wrap:anywhere]">
                  {t.members.length > 0 ? t.members.join(' · ') : <span className="italic">Sin integrantes</span>}
                </p>
                <FinalsSummary finals={finalsBy.get(t.id_project) ?? readFinals(t.id_project)} onEdit={() => setEditingFinals(t)} />
              </header>
              <div className="p-3 sm:p-4 grid gap-3 grid-cols-[repeat(auto-fill,minmax(10rem,1fr))]">
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
            </section>
          ))}
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
          initial={finalsBy.get(editingFinals.id_project) ?? readFinals(editingFinals.id_project)}
          scores={scores}
          onClose={() => setEditingFinals(null)}
          onSaved={(f) => setFinalsBy((prev) => new Map(prev).set(editingFinals.id_project, f))}
        />
      )}
    </div>
  );
};
