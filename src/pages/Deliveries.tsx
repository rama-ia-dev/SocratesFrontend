import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import type { ActivityPublic, DeliveryPublic } from '../types/api';
import { useAuth } from '../context/AuthContext';
import { PageHeader } from '../components/ui/PageHeader';
import { Select } from '../components/ui/Select';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { EmptyState, TableSkeleton } from '../components/ui/EmptyState';
import { DeliveryModal } from '../components/DeliveryModal';
import { CATEGORY_LABEL, formatDue, latestGrade, statusVariant } from '../lib/deliveries';
import { CalendarX, ClipboardList, CloudOff, RefreshCw, Users } from 'lucide-react';

interface CourseOption {
  id_section_year: number;
  label: string;
  year: number;
}

interface Team {
  id_project: number;
  group_number: number;
  name?: string | null;
}

// Una celda de la planilla: estado y notas de la entrega de un equipo
const Cell: React.FC<{ d: DeliveryPublic; onOpen: () => void }> = ({ d, onOpen }) => {
  const activity = latestGrade(d, 'activity');
  const followUp = latestGrade(d, 'follow_up');
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Entrega ${d.activity.title} del Equipo ${d.project.group_number}: ${d.status.name}`}
      className="w-full h-full text-left rounded-lg px-2.5 py-2 hover:bg-tint focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/15 transition-colors cursor-pointer space-y-1"
    >
      <Badge variant={statusVariant(d.status.code)}>{d.status.name}</Badge>
      {(activity || followUp) && (
        <span className="block text-xs text-ink-muted leading-snug">
          {activity && (
            <span className="block">
              {CATEGORY_LABEL.activity}: <span className="text-ink">{activity.score.name}</span>
            </span>
          )}
          {followUp && (
            <span className="block">
              {CATEGORY_LABEL.follow_up}: <span className="text-ink">{followUp.score.name}</span>
            </span>
          )}
        </span>
      )}
    </button>
  );
};

/**
 * Entregas de un curso lectivo (SCRUM-59 a 61 y 590): una fila por equipo y una columna por cada
 * entrega del calendario, como la planilla de notas de la cátedra. Cada celda abre la entrega para
 * registrarla, cambiar su estado, calificarla y comentarla. Docentes del curso y administrador.
 */
export const Deliveries: React.FC = () => {
  const { user } = useAuth();
  const [courses, setCourses] = useState<CourseOption[] | null>(null);
  const [course, setCourse] = useState('');
  const [activities, setActivities] = useState<ActivityPublic[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  // Entrega de cada equipo para cada actividad: clave `${id_project}-${id_activity}`
  const [byKey, setByKey] = useState<Map<string, DeliveryPublic>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [open, setOpen] = useState<DeliveryPublic | null>(null);
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
      const acts = (await api.getSectionYearActivities(Number(course))).items.sort(
        (a, b) => a.due_date.localeCompare(b.due_date) || a.id_activity - b.id_activity
      );
      const lists = await Promise.all(acts.map((a) => api.getActivityDeliveries(a.id_activity)));
      if (current !== requestId.current) return;
      const map = new Map<string, DeliveryPublic>();
      const teamMap = new Map<number, Team>();
      for (const d of lists.flat()) {
        map.set(`${d.id_project}-${d.id_activity}`, d);
        teamMap.set(d.id_project, d.project);
      }
      setActivities(acts);
      setTeams([...teamMap.values()].sort((a, b) => a.group_number - b.group_number));
      setByKey(map);
    } catch {
      if (current === requestId.current) setLoadError(true);
    } finally {
      if (current === requestId.current) setIsLoading(false);
    }
  }, [course]);

  useEffect(() => {
    fetchSheet();
  }, [fetchSheet]);

  const handleChanged = useCallback((d: DeliveryPublic) => {
    setByKey((prev) => new Map(prev).set(`${d.id_project}-${d.id_activity}`, d));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="Entregas" subtitle="Estado y notas de cada equipo en cada entrega del curso lectivo" />

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
        <div className="overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full table-fixed border-collapse text-sm" style={{ minWidth: `${128 + activities.length * 190}px` }}>
            <colgroup>
              <col className="w-32 sm:w-44" />
              {activities.map((a) => (
                <col key={a.id_activity} />
              ))}
            </colgroup>
            <thead>
              <tr className="border-b border-line bg-canvas">
                <th scope="col" className="sticky left-0 z-10 bg-canvas px-3 sm:px-4 py-3 text-left font-medium text-ink-muted">
                  Equipo
                </th>
                {activities.map((a) => (
                  <th key={a.id_activity} scope="col" className="px-3 py-3 text-left align-bottom">
                    <span className="block font-medium text-ink [overflow-wrap:anywhere]">{a.title}</span>
                    <span className="block text-xs font-normal text-ink-muted">{formatDue(a.due_date, a.due_time)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {teams.map((t) => (
                <tr key={t.id_project} className="border-b border-line last:border-b-0 align-top">
                  <th scope="row" className="sticky left-0 z-10 bg-white px-3 sm:px-4 py-3 text-left font-normal">
                    <Link to={`/equipos/${t.id_project}`} className="font-medium text-ink hover:text-primary hover:underline">
                      Equipo {t.group_number}
                    </Link>
                    {t.name && <span className="block text-xs text-ink-muted [overflow-wrap:anywhere]">{t.name}</span>}
                  </th>
                  {activities.map((a) => {
                    const d = byKey.get(`${t.id_project}-${a.id_activity}`);
                    return (
                      <td key={a.id_activity} className="px-1.5 py-1.5">
                        {d ? (
                          <Cell d={d} onOpen={() => setOpen(d)} />
                        ) : (
                          <span className="block px-2.5 py-2 text-xs italic text-ink-subtle">Sin entrega</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && <DeliveryModal delivery={open} onClose={() => setOpen(null)} onChanged={handleChanged} />}
    </div>
  );
};
