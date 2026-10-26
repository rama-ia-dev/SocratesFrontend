import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { fetchAll } from '../lib/pagination';
import { courseLabel, teamLabel } from '../lib/projects';
import {
  ProfessorSectionYearPublic,
  ProjectPublic,
  SectionYearPublic,
  StudentListItem,
} from '../types/api';
import { PageHeader } from '../components/ui/PageHeader';
import { Select } from '../components/ui/Select';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../components/ui/Toast';
import { BarChart3, ChevronRight, CircleCheck, TriangleAlert } from 'lucide-react';

// Etapas en las que se agrupan los estados de un equipo (las mismas que en Estado de la cátedra)
type Stage = 'uninsured' | 'developing' | 'approved' | 'cancelled';

// Colores de las etapas, validados para daltonismo; cada barra lleva además su texto y cantidad
const STAGES: { key: Stage; label: string; color: string }[] = [
  { key: 'uninsured', label: 'Sin asegurar', color: 'bg-accent-strong' },
  { key: 'developing', label: 'En desarrollo', color: 'bg-primary' },
  { key: 'approved', label: 'Aprobados', color: 'bg-success-vivid' },
  { key: 'cancelled', label: 'Cancelados', color: 'bg-danger-hover' },
];

// Estados de la etapa "En desarrollo", en el orden de la máquina de estados
const DEVELOPING_STATUSES: { code: string; name: string }[] = [
  { code: 'in_idea', name: 'En idea' },
  { code: 'in_progress', name: 'En proceso' },
  { code: 'pending_approval', name: 'Pendiente de aprobación' },
  { code: 'rejected', name: 'Rechazado' },
];

const stageOf = (code: string): Stage => {
  if (code === 'uninsured') return 'uninsured';
  if (code === 'approved') return 'approved';
  if (code === 'cancelled') return 'cancelled';
  return 'developing';
};

// Los datos simulados no traen estado: se usa la marca de grupo asegurado
const statusCodeOf = (p: ProjectPublic): string =>
  p.status?.code ?? (p.is_secured ? 'in_idea' : 'uninsured');

// Equipo con lo que se calcula a partir de sus integrantes
type Team = ProjectPublic & {
  stage: Stage;
  active: number;
  has_leader: boolean;
  pending: number;
  min?: number;
  max?: number;
};

// Avance de un curso lectivo: aprobados sobre los equipos que siguen vigentes (sin cancelados)
type CourseProgress = {
  id_section_year: number;
  id_section: number;
  section_name: string;
  year: number;
  label: string;
  approved: number;
  current: number;
  progress: number | null;
};

type AlertItem = { key: string; label: string; detail?: string; to: string };

type DashboardAlert = {
  key: string;
  title: string;
  description: string;
  items: AlertItem[];
};

type Dashboard = {
  section_years: number;
  professors: number;
  teams: Team[];
  students_in_teams: number;
  stages: Record<Stage, number>;
  developing_detail: Record<string, number>;
  courses: CourseProgress[];
  alerts: DashboardAlert[];
};

const currentYear = new Date().getFullYear();

// Color de la barra de avance: rojo hasta 33 %, amarillo hasta 66 % y verde desde 67 %
const progressColor = (progress: number): string => {
  if (progress < 34) return 'bg-danger-vivid';
  if (progress < 67) return 'bg-warning-vivid';
  return 'bg-success-vivid';
};

const pct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

const cupoText = (t: Team) =>
  t.min !== undefined && t.max !== undefined ? ` (cupo de ${t.min} a ${t.max})` : '';

const teamItem = (t: Team, detail: string): AlertItem => ({
  key: String(t.id_project),
  label: `${courseLabel(t)} · ${teamLabel(t)}`,
  detail,
  to: `/equipos/${t.id_project}`,
});

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

async function loadDashboard(year: number | null): Promise<Dashboard> {
  const filters = { year };
  const [sectionYears, assignments, projects] = await Promise.all([
    fetchAll<SectionYearPublic>((o) => api.getSectionYears({ ...filters, limit: 100, offset: o })),
    fetchAll<ProfessorSectionYearPublic>((o) =>
      api.getProfessorSectionYears({ ...filters, limit: 100, offset: o })
    ),
    fetchAll<ProjectPublic>((o) => api.getProjects({ ...filters, limit: 100, offset: o })),
  ]);

  // Integrantes activos y finalizados de cada curso lectivo: una consulta por curso lectivo
  // (no por equipo). Cada alumno trae sus equipos con el estado de la membresía y si es jefe.
  const studentsByCourse = await Promise.all(
    sectionYears.map((sy) =>
      fetchAll<StudentListItem>((o) =>
        api.getStudents({ id_section_year: sy.id_section_year, limit: 100, offset: o })
      )
    )
  );

  const active: Record<number, number> = {};
  const leaders = new Set<number>();
  const studentsInTeams = new Set<number>();
  const projectIds = new Set(projects.map((p) => p.id_project));
  for (const students of studentsByCourse) {
    for (const s of students) {
      for (const g of s.groups) {
        if (!projectIds.has(g.id_project)) continue;
        studentsInTeams.add(s.id_student);
        if ((g.status?.code ?? 'active') !== 'active') continue;
        active[g.id_project] = (active[g.id_project] ?? 0) + 1;
        if (g.is_leader) leaders.add(g.id_project);
      }
    }
  }

  // Solo los equipos sin asegurar pueden tener solicitudes pendientes: al asegurar, aprobar o
  // cancelar un equipo, el backend las rechaza.
  const uninsured = projects.filter((p) => statusCodeOf(p) === 'uninsured');
  const pendingPairs = await Promise.all(
    uninsured.map(async (p) => {
      const res = await api.getProjectMembers(p.id_project, ['pending_approval']);
      return [p.id_project, res.total] as const;
    })
  );
  const pending: Record<number, number> = Object.fromEntries(pendingPairs);

  const courseById = new Map(sectionYears.map((sy) => [sy.id_section_year, sy]));
  const teams: Team[] = projects.map((p) => {
    const sy = courseById.get(p.id_section_year);
    return {
      ...p,
      stage: stageOf(statusCodeOf(p)),
      active: active[p.id_project] ?? 0,
      has_leader: leaders.has(p.id_project),
      pending: pending[p.id_project] ?? 0,
      min: sy?.min_students,
      max: sy?.max_students,
    };
  });

  const stages: Record<Stage, number> = { uninsured: 0, developing: 0, approved: 0, cancelled: 0 };
  const developingDetail: Record<string, number> = {};
  for (const t of teams) {
    stages[t.stage] += 1;
    if (t.stage === 'developing') {
      const code = statusCodeOf(t);
      developingDetail[code] = (developingDetail[code] ?? 0) + 1;
    }
  }

  // Con un año elegido alcanza el nombre de la comisión; con todos los años, va también el año
  const courses: CourseProgress[] = sectionYears
    .map((sy) => {
      const own = teams.filter((t) => t.id_section_year === sy.id_section_year);
      const approved = own.filter((t) => t.stage === 'approved').length;
      const current = own.filter((t) => t.stage !== 'cancelled').length;
      return {
        id_section_year: sy.id_section_year,
        id_section: sy.id_section,
        section_name: sy.section_name,
        year: sy.year,
        label: year ? sy.section_name : courseLabel(sy),
        approved,
        current,
        progress: current > 0 ? pct(approved, current) : null,
      };
    })
    // De menor a mayor avance: primero lo que viene más atrasado; los cursos sin equipos al final
    .sort(
      (a, b) =>
        (a.progress ?? 101) - (b.progress ?? 101) ||
        b.year - a.year ||
        a.label.localeCompare(b.label, 'es')
    );

  const professorsByCourse = new Set(assignments.map((a) => a.id_section_year));
  const open = teams.filter((t) => t.stage === 'uninsured' || t.stage === 'developing');
  const fits = (t: Team) =>
    t.min !== undefined && t.max !== undefined && t.active >= t.min && t.active <= t.max;

  const alerts: DashboardAlert[] = [
    {
      key: 'no-professors',
      title: 'Cursos lectivos sin docentes',
      description: 'Se asignan desde Comisiones.',
      items: sectionYears
        .filter((sy) => !professorsByCourse.has(sy.id_section_year))
        .map((sy) => ({
          key: String(sy.id_section_year),
          label: courseLabel(sy),
          to: '/comisiones',
        })),
    },
    {
      key: 'empty',
      title: 'Equipos sin integrantes',
      description: 'Equipos sin asegurar a los que todavía no se sumó nadie.',
      items: open.filter((t) => t.active === 0).map((t) => teamItem(t, 'Sin integrantes')),
    },
    {
      key: 'no-leader',
      title: 'Equipos sin jefe',
      description: 'Tienen integrantes activos, pero ninguno es el jefe del grupo.',
      items: open
        .filter((t) => t.active > 0 && !t.has_leader)
        .map((t) => teamItem(t, plural(t.active, 'integrante', 'integrantes'))),
    },
    {
      key: 'out-of-range',
      title: 'Equipos fuera del cupo',
      description:
        'Superan el máximo de integrantes o, ya asegurados, no llegan al mínimo (por ejemplo, si cambió el cupo).',
      items: open
        .filter(
          (t) =>
            (t.max !== undefined && t.active > t.max) ||
            (t.stage === 'developing' && t.min !== undefined && t.active < t.min)
        )
        .map((t) => teamItem(t, `${plural(t.active, 'integrante', 'integrantes')}${cupoText(t)}`)),
    },
    {
      key: 'ready',
      title: 'Equipos listos para asegurar',
      description: 'Sin asegurar y con el cupo de integrantes cumplido.',
      items: open
        .filter((t) => t.stage === 'uninsured' && t.active > 0 && fits(t))
        .map((t) => teamItem(t, `${plural(t.active, 'integrante', 'integrantes')}${cupoText(t)}`)),
    },
    {
      key: 'pending',
      title: 'Equipos con solicitudes pendientes',
      description: 'Alumnos que pidieron sumarse y esperan la respuesta del jefe del grupo.',
      items: open
        .filter((t) => t.pending > 0)
        .map((t) => teamItem(t, plural(t.pending, 'solicitud', 'solicitudes'))),
    },
  ];

  return {
    section_years: sectionYears.length,
    professors: new Set(assignments.map((a) => a.id_professor)).size,
    teams,
    students_in_teams: studentsInTeams.size,
    stages,
    developing_detail: developingDetail,
    courses,
    alerts,
  };
}

// Tarjeta con título para cada bloque del dashboard
const Panel: React.FC<{ title: string; subtitle?: string; children: React.ReactNode }> = ({
  title,
  subtitle,
  children,
}) => (
  <section className="rounded-xl border border-line bg-white p-5">
    <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
    {subtitle && <p className="mt-0.5 text-sm text-ink-muted">{subtitle}</p>}
    <div className="mt-4">{children}</div>
  </section>
);

const DashboardSkeleton: React.FC = () => (
  <div className="space-y-4 animate-pulse" aria-label="Cargando el dashboard">
    <div className="h-[76px] rounded-xl border border-line bg-white" />
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      <div className="lg:col-span-3 h-72 rounded-xl border border-line bg-white" />
      <div className="lg:col-span-2 h-72 rounded-xl border border-line bg-white" />
    </div>
  </div>
);

export const ChairDashboard: React.FC<{ subtitle?: string }> = ({ subtitle }) => {
  const { error: toastError } = useToast();

  const [yearFilter, setYearFilter] = useState<string>(String(currentYear));
  const [yearOptions, setYearOptions] = useState<number[]>([]);
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAll<SectionYearPublic>((o) => api.getSectionYears({ limit: 100, offset: o }))
      .then((items) => {
        const years = [...new Set(items.map((sy) => sy.year))].sort((a, b) => b - a);
        setYearOptions(years);
        // Si el año actual todavía no tiene cursos lectivos, se muestra el más reciente
        if (years.length > 0 && !years.includes(currentYear)) setYearFilter(String(years[0]));
      })
      .catch(() => setYearOptions([]));
  }, []);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      setData(await loadDashboard(yearFilter ? parseInt(yearFilter, 10) : null));
    } catch {
      toastError('Error al cargar el dashboard de la cátedra');
      setData(null);
    } finally {
      setLoading(false);
    }
    // Sin toastError: cambia con cada aviso y volvería a disparar la carga
  }, [yearFilter]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const teamCount = data?.teams.length ?? 0;
  const currentTeams = data ? teamCount - data.stages.cancelled : 0;
  const pendingTotal = data?.teams.reduce((acc, t) => acc + t.pending, 0) ?? 0;
  const activeAlerts = data?.alerts.filter((a) => a.items.length > 0) ?? [];

  return (
    <div>
      <PageHeader
        title="Dashboard de la cátedra"
        subtitle={subtitle ?? 'Panorama de la cátedra en el ciclo lectivo'}
        action={
          <div className="sm:w-48">
            <Select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              aria-label="Ciclo lectivo"
            >
              <option value="">Todos los años</option>
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  Ciclo lectivo {y}
                </option>
              ))}
            </Select>
          </div>
        }
      />

      {loading ? (
        <DashboardSkeleton />
      ) : !data ? null : data.section_years === 0 ? (
        <EmptyState
          icon={<BarChart3 className="w-5 h-5" />}
          message={yearFilter ? `No hay cursos lectivos en ${yearFilter}` : 'Todavía no hay cursos lectivos'}
          description="El dashboard se completa cuando se registran cursos lectivos en Comisiones."
          action={
            <Link to="/comisiones" className="text-sm font-medium text-primary hover:underline">
              Ir a Comisiones
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {/* Indicadores: una sola franja, como en Estado de la cátedra */}
          <dl className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 rounded-xl border border-line overflow-hidden gap-px bg-line">
            {[
              { label: 'Cursos lectivos', value: String(data.section_years) },
              { label: 'Docentes asignados', value: String(data.professors) },
              { label: 'Equipos', value: String(teamCount) },
              { label: 'Alumnos en equipos', value: String(data.students_in_teams) },
              { label: 'Solicitudes pendientes', value: String(pendingTotal) },
              {
                label: 'Proyectos aprobados',
                value: currentTeams > 0 ? `${pct(data.stages.approved, currentTeams)} %` : '—',
                hint:
                  currentTeams > 0 ? `${data.stages.approved} de ${currentTeams} vigentes` : 'Sin equipos vigentes',
              },
            ].map((card) => (
              <div key={card.label} className="bg-white px-5 py-3.5">
                <dt className="text-[13px] text-ink-muted">{card.label}</dt>
                <dd className="mt-0.5 text-xl font-semibold text-ink tabular-nums">{card.value}</dd>
                {card.hint && <dd className="text-xs text-ink-subtle">{card.hint}</dd>}
              </div>
            ))}
          </dl>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
            <div className="lg:col-span-3 space-y-4">
              <Panel title="Equipos por etapa" subtitle={plural(teamCount, 'equipo', 'equipos')}>
                {teamCount === 0 ? (
                  <p className="text-sm text-ink-muted">Todavía no hay equipos en estos cursos lectivos.</p>
                ) : (
                  <>
                    {/* Barra apilada: cada tramo es una etapa, separado por un hueco blanco */}
                    <div className="flex h-3 gap-0.5" role="img" aria-label="Equipos por etapa">
                      {STAGES.filter((s) => data.stages[s.key] > 0).map((s) => (
                        <div
                          key={s.key}
                          className={`${s.color} first:rounded-l last:rounded-r`}
                          style={{ width: `${pct(data.stages[s.key], teamCount)}%`, minWidth: 6 }}
                          title={`${s.label}: ${data.stages[s.key]} (${pct(data.stages[s.key], teamCount)} %)`}
                        />
                      ))}
                    </div>
                    <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
                      {STAGES.map((s) => (
                        <li key={s.key} className="text-sm">
                          <div className="flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-sm shrink-0 ${s.color}`} aria-hidden />
                            <span className="text-ink">{s.label}</span>
                            <span className="ml-auto tabular-nums font-semibold text-ink">
                              {data.stages[s.key]}
                            </span>
                            <span className="w-11 text-right tabular-nums text-ink-muted">
                              {pct(data.stages[s.key], teamCount)} %
                            </span>
                          </div>
                          {s.key === 'developing' && data.stages.developing > 0 && (
                            <ul className="mt-1 ml-[18px] space-y-0.5">
                              {DEVELOPING_STATUSES.filter((d) => data.developing_detail[d.code]).map((d) => (
                                <li key={d.code} className="flex text-xs text-ink-muted">
                                  <span>{d.name}</span>
                                  <span className="ml-auto mr-11 tabular-nums">
                                    {data.developing_detail[d.code]}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </Panel>

              <Panel
                title={yearFilter ? 'Avance por comisión' : 'Avance por curso lectivo'}
                subtitle="Proyectos aprobados sobre los equipos vigentes (sin contar los cancelados)"
              >
                <ul className="space-y-1">
                  {data.courses.map((c) => (
                    <li key={c.id_section_year}>
                      <Link
                        to={`/catedra?anio=${c.year}&comision=${c.id_section}`}
                        className="group flex items-center gap-3 -mx-2 px-2 py-1.5 rounded-lg hover:bg-canvas transition-colors"
                        title={`Ver ${courseLabel(c)} en Estado de la cátedra`}
                      >
                        <span className="w-24 shrink-0 text-sm font-medium text-ink truncate">{c.label}</span>
                        {c.progress === null ? (
                          <span className="flex-1 text-xs text-ink-faint">Sin equipos vigentes</span>
                        ) : (
                          <>
                            <div
                              className="h-2 flex-1 rounded-full bg-line-neutral overflow-hidden"
                              role="progressbar"
                              aria-valuenow={c.progress}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-label={`Proyectos aprobados de ${courseLabel(c)}`}
                            >
                              <div
                                className={`h-full rounded-full ${progressColor(c.progress)}`}
                                style={{ width: `${c.progress}%` }}
                              />
                            </div>
                            <span className="w-24 text-right text-xs text-ink-muted tabular-nums">
                              {c.approved} de {c.current} · {c.progress} %
                            </span>
                          </>
                        )}
                        <ChevronRight className="w-4 h-4 text-ink-faint shrink-0 group-hover:text-ink-muted" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>

            <div className="lg:col-span-2">
              <Panel
                title="Requiere atención"
                subtitle={
                  activeAlerts.length > 0
                    ? 'Toque cada aviso para ver los cursos o equipos'
                    : undefined
                }
              >
                {activeAlerts.length === 0 ? (
                  <div className="flex items-center gap-2.5 text-sm text-success">
                    <CircleCheck className="w-5 h-5 shrink-0" />
                    <span>Todo en orden: no hay nada que requiera atención.</span>
                  </div>
                ) : (
                  <ul className="divide-y divide-line -my-2">
                    {activeAlerts.map((alert) => (
                      <li key={alert.key} className="py-2">
                        <details className="group">
                          <summary className="flex items-start gap-2.5 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                            <TriangleAlert className="w-4 h-4 mt-0.5 text-warning shrink-0" />
                            <span className="flex-1 min-w-0">
                              <span className="block text-sm font-medium text-ink">{alert.title}</span>
                              <span className="block text-xs text-ink-muted">{alert.description}</span>
                            </span>
                            <span className="text-sm font-semibold text-ink tabular-nums">
                              {alert.items.length}
                            </span>
                            <ChevronRight className="w-4 h-4 mt-0.5 text-ink-faint shrink-0 transition-transform group-open:rotate-90" />
                          </summary>
                          <ul className="mt-2 ml-6 space-y-0.5">
                            {alert.items.map((item) => (
                              <li key={item.key}>
                                <Link
                                  to={item.to}
                                  className="flex items-baseline gap-2 rounded-md px-2 py-1 text-sm hover:bg-canvas"
                                >
                                  <span className="text-primary">{item.label}</span>
                                  {item.detail && (
                                    <span className="ml-auto text-xs text-ink-muted text-right">{item.detail}</span>
                                  )}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </details>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
