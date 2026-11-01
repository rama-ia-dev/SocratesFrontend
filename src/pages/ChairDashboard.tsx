import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { fetchAll } from '../lib/pagination';
import { courseLabel, teamLabel } from '../lib/projects';
import { ProjectPublic, SectionYearPublic, StudentListItem } from '../types/api';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { ChevronRight, CircleCheck, FolderKanban, GraduationCap, Layers, Users } from 'lucide-react';

// Etapas en las que se agrupan los estados de un equipo (las mismas que en Estado de la cátedra).
// Solo los equipos sin asegurar o en desarrollo pueden requerir atención.
type Stage = 'uninsured' | 'developing' | 'approved' | 'cancelled';

const stageOf = (code: string): Stage => {
  if (code === 'uninsured') return 'uninsured';
  if (code === 'approved') return 'approved';
  if (code === 'cancelled') return 'cancelled';
  return 'developing';
};

const STAGE_LABELS: Record<'uninsured' | 'developing', string> = {
  uninsured: 'Sin asegurar',
  developing: 'En desarrollo',
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

// Motivo por el que un equipo requiere atención. `warning` distingue lo que hay que corregir de lo
// que solo espera una acción (por ejemplo, un equipo listo para asegurar).
type Reason = { key: string; text: string; warning: boolean };

type AttentionTeam = Team & { reasons: Reason[] };

type Dashboard = {
  sections: number;
  professors: number;
  students: number;
  teams: number;
  attention: AttentionTeam[];
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const cupoText = (t: Team) =>
  t.min !== undefined && t.max !== undefined ? `cupo de ${t.min} a ${t.max}` : '';

const reasonsOf = (t: Team): Reason[] => {
  const reasons: Reason[] = [];
  const members = plural(t.active, 'integrante', 'integrantes');
  const cupo = cupoText(t);
  if (t.active === 0) reasons.push({ key: 'empty', text: 'Sin integrantes', warning: true });
  else if (!t.has_leader) reasons.push({ key: 'no-leader', text: 'Sin jefe', warning: true });
  const overMax = t.max !== undefined && t.active > t.max;
  // Ya asegurado, el equipo debería cumplir el mínimo (puede pasar si cambió el cupo)
  const underMin = t.stage === 'developing' && t.min !== undefined && t.active < t.min;
  if (overMax || underMin)
    reasons.push({ key: 'out-of-range', text: `Fuera del cupo: ${members}${cupo ? ` (${cupo})` : ''}`, warning: true });
  if (t.pending > 0)
    reasons.push({ key: 'pending', text: plural(t.pending, 'solicitud pendiente', 'solicitudes pendientes'), warning: false });
  const fits = t.min !== undefined && t.max !== undefined && t.active >= t.min && t.active <= t.max;
  if (t.stage === 'uninsured' && t.active > 0 && fits)
    reasons.push({ key: 'ready', text: `Listo para asegurar: ${members}`, warning: false });
  return reasons;
};

async function loadDashboard(): Promise<Dashboard> {
  // Totales del sistema: alcanza con el `total` de cada listado
  const [sections, professors, students, sectionYears, projects] = await Promise.all([
    api.getSections({ limit: 1 }),
    api.getUsers({ role: 'professor', limit: 1 }),
    api.getUsers({ role: 'student', limit: 1 }),
    fetchAll<SectionYearPublic>((o) => api.getSectionYears({ limit: 100, offset: o })),
    fetchAll<ProjectPublic>((o) => api.getProjects({ limit: 100, offset: o })),
  ]);

  const open = projects.filter((p) => {
    const stage = stageOf(statusCodeOf(p));
    return stage === 'uninsured' || stage === 'developing';
  });

  // Integrantes activos de los equipos abiertos: una consulta por curso lectivo (no por equipo).
  // Cada alumno trae sus equipos con el estado de la membresía y si es jefe.
  const courseIds = [...new Set(open.map((p) => p.id_section_year))];
  const studentsByCourse = await Promise.all(
    courseIds.map((id) =>
      fetchAll<StudentListItem>((o) => api.getStudents({ id_section_year: id, limit: 100, offset: o }))
    )
  );
  const openIds = new Set(open.map((p) => p.id_project));
  const active: Record<number, number> = {};
  const leaders = new Set<number>();
  for (const list of studentsByCourse) {
    for (const s of list) {
      for (const g of s.groups) {
        if (!openIds.has(g.id_project) || (g.status?.code ?? 'active') !== 'active') continue;
        active[g.id_project] = (active[g.id_project] ?? 0) + 1;
        if (g.is_leader) leaders.add(g.id_project);
      }
    }
  }

  // Solo los equipos sin asegurar pueden tener solicitudes pendientes: al asegurar, aprobar o
  // cancelar un equipo, el backend las rechaza.
  const pendingPairs = await Promise.all(
    open
      .filter((p) => statusCodeOf(p) === 'uninsured')
      .map(async (p) => [p.id_project, (await api.getProjectMembers(p.id_project, ['pending_approval'])).total] as const)
  );
  const pending: Record<number, number> = Object.fromEntries(pendingPairs);

  const courseById = new Map(sectionYears.map((sy) => [sy.id_section_year, sy]));
  const attention = open
    .map((p) => {
      const sy = courseById.get(p.id_section_year);
      const team: Team = {
        ...p,
        stage: stageOf(statusCodeOf(p)),
        active: active[p.id_project] ?? 0,
        has_leader: leaders.has(p.id_project),
        pending: pending[p.id_project] ?? 0,
        min: sy?.min_students,
        max: sy?.max_students,
      };
      return { ...team, reasons: reasonsOf(team) };
    })
    .filter((t) => t.reasons.length > 0)
    // Del curso lectivo más reciente al más viejo, por comisión y por número de equipo
    .sort(
      (a, b) =>
        b.year - a.year ||
        a.section_name.localeCompare(b.section_name, 'es') ||
        a.group_number - b.group_number
    );

  return {
    sections: sections.total,
    professors: professors.total,
    students: students.total,
    teams: projects.length,
    attention,
  };
}

const DashboardSkeleton: React.FC = () => (
  <div className="space-y-6 animate-pulse" aria-label="Cargando el dashboard">
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-[104px] rounded-xl border border-line bg-white" />
      ))}
    </div>
    <div className="h-72 rounded-xl border border-line bg-white" />
  </div>
);

export const ChairDashboard: React.FC<{ subtitle?: string }> = ({ subtitle }) => {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setData(await loadDashboard());
    } catch {
      setError(true);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const cards = data
    ? [
        { label: 'Comisiones', value: data.sections, to: '/comisiones', icon: Layers },
        { label: 'Docentes', value: data.professors, to: '/usuarios', icon: Users },
        { label: 'Estudiantes', value: data.students, to: '/estudiantes', icon: GraduationCap },
        { label: 'Equipos de trabajo', value: data.teams, to: '/equipos', icon: FolderKanban },
      ]
    : [];

  return (
    <div>
      <PageHeader title="Dashboard de la cátedra" subtitle={subtitle ?? 'Estado actual de la cátedra'} />

      {loading ? (
        <DashboardSkeleton />
      ) : error || !data ? (
        <Alert
          action={
            <Button variant="outline" size="sm" onClick={fetchDashboard}>
              Reintentar
            </Button>
          }
        >
          No se pudo cargar el dashboard de la cátedra
        </Alert>
      ) : (
        <div className="space-y-6">
          {/* Totales del sistema; cada tarjeta lleva a su pantalla */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {cards.map((card) => (
              <Link
                key={card.label}
                to={card.to}
                className="group rounded-xl border border-line bg-white p-5 hover:border-line-neutral-strong hover:bg-canvas transition-colors"
              >
                <div className="flex items-center gap-2 text-[13px] text-ink-muted">
                  <card.icon className="w-4 h-4 shrink-0" aria-hidden />
                  <span>{card.label}</span>
                  <ChevronRight className="w-4 h-4 ml-auto text-ink-faint group-hover:text-ink-muted" aria-hidden />
                </div>
                <p className="mt-2 text-[28px] leading-none font-semibold text-ink tabular-nums">{card.value}</p>
              </Link>
            ))}
          </div>

          {/* Equipos que requieren atención */}
          <section className="rounded-xl border border-line bg-white">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-5 pt-5">
              <h2 className="text-[15px] font-semibold text-ink">Equipos que requieren atención</h2>
              {data.attention.length > 0 && (
                <span className="text-sm text-ink-muted">{plural(data.attention.length, 'equipo', 'equipos')}</span>
              )}
              <Link to="/catedra" className="ml-auto text-sm font-medium text-primary hover:underline">
                Ver el estado de la cátedra
              </Link>
            </div>

            {data.attention.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  icon={<CircleCheck className="w-5 h-5" />}
                  message="Ningún equipo requiere atención"
                  description="Acá aparecen los equipos sin integrantes, sin jefe, fuera del cupo, con solicitudes pendientes o listos para asegurar."
                />
              </div>
            ) : (
              <ul className="mt-4 divide-y divide-line border-t border-line">
                {data.attention.map((t) => (
                  <li key={t.id_project}>
                    <Link
                      to={`/equipos/${t.id_project}`}
                      className="group flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-5 py-3 hover:bg-canvas transition-colors"
                    >
                      <span className="min-w-0 sm:w-64 shrink-0">
                        <span className="block text-sm font-medium text-ink truncate">{teamLabel(t)}</span>
                        <span className="block text-xs text-ink-muted">
                          {courseLabel(t)} · {STAGE_LABELS[t.stage as 'uninsured' | 'developing']}
                        </span>
                      </span>
                      <span className="flex flex-1 flex-wrap gap-1.5">
                        {t.reasons.map((r) => (
                          <span
                            key={r.key}
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                              r.warning
                                ? 'bg-warning-soft text-warning border-warning-line'
                                : 'bg-tint text-primary border-tint-strong'
                            }`}
                          >
                            {r.text}
                          </span>
                        ))}
                      </span>
                      <ChevronRight
                        className="hidden sm:block w-4 h-4 text-ink-faint shrink-0 group-hover:text-ink-muted"
                        aria-hidden
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
};
