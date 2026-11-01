import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../lib/api';
import {
  ProfessorSectionYearPublic,
  ProjectPublic,
  SectionPublic,
  SectionYearPublic,
} from '../types/api';
import { PageHeader } from '../components/ui/PageHeader';
import { Select } from '../components/ui/Select';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableCell,
} from '../components/ui/Table';
import { Pagination } from '../components/ui/Pagination';
import { EmptyState, TableSkeleton } from '../components/ui/EmptyState';
import { useToast } from '../components/ui/Toast';
import { Button } from '../components/ui/Button';
import { SearchX, BarChart3 } from 'lucide-react';

// El backend devuelve, además de lo tipado, el mínimo y máximo de integrantes del curso lectivo
// y el estado actual de cada proyecto.
type SectionYearWithLimits = SectionYearPublic & {
  min_students?: number;
  max_students?: number;
};
type ProjectWithStatus = ProjectPublic & {
  status?: { code: string; name: string };
};

// Etapas en las que se agrupan los estados de un proyecto
type Stage = 'uninsured' | 'developing' | 'approved' | 'cancelled';

const STAGE_LABELS: Record<Stage, string> = {
  uninsured: 'Sin asegurar',
  developing: 'En desarrollo',
  approved: 'Aprobados',
  cancelled: 'Cancelados',
};

// Estados que forman la etapa "En desarrollo", en el orden de la máquina de estados
// (nombres abreviados para que entren en la celda)
const DEVELOPING_STATUSES: { code: string; name: string }[] = [
  { code: 'in_idea', name: 'En idea' },
  { code: 'in_progress', name: 'En proceso' },
  { code: 'pending_approval', name: 'Pendiente' },
  { code: 'rejected', name: 'Rechazado' },
];

const stageOf = (project: ProjectWithStatus): Stage => {
  // Los datos simulados no traen estado: se usa la marca de grupo asegurado
  const code = project.status?.code ?? (project.is_secured ? 'in_idea' : 'uninsured');
  if (code === 'uninsured') return 'uninsured';
  if (code === 'approved') return 'approved';
  if (code === 'cancelled') return 'cancelled';
  return 'developing';
};

// Fila de la tabla: el curso lectivo con sus docentes, sus grupos por etapa y sus alumnos
type ChairRow = SectionYearWithLimits & {
  professors: { id_professor: number; first_name: string; last_name: string }[];
  project_count: number;
  stages: Record<Stage, number>;
  developing_detail: Record<string, number>;
};

type Summary = {
  section_years: number;
  projects: number;
  approved: number;
  without_professors: number;
};

const PAGE_SIZE = 10;

// Opciones del filtro de año: del año que viene hacia atrás.
const currentYear = new Date().getFullYear();

// Trae todas las páginas de un listado (el backend devuelve hasta 100 por consulta)
async function fetchAll<T>(
  fetchPage: (offset: number) => Promise<{ items: T[]; total: number }>
): Promise<T[]> {
  const items: T[] = [];
  for (;;) {
    const page = await fetchPage(items.length);
    items.push(...page.items);
    if (page.items.length === 0 || items.length >= page.total) return items;
  }
}

export const ChairOverview: React.FC = () => {
  const { error: toastError } = useToast();

  const [yearFilter, setYearFilter] = useState<string>(String(currentYear));
  const [sectionFilter, setSectionFilter] = useState<string>('');
  const [allSections, setAllSections] = useState<SectionPublic[]>([]);
  // Todos los cursos lectivos, para armar las opciones de los filtros
  const [allSectionYears, setAllSectionYears] = useState<SectionYearPublic[]>([]);

  const [rows, setRows] = useState<ChairRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);

  // Alumnos en grupos de cada curso lectivo de la página visible
  const [studentCounts, setStudentCounts] = useState<Record<number, number>>({});

  useEffect(() => {
    api
      .getSections({ limit: 100 })
      .then((res) => setAllSections(res.items))
      .catch(() => toastError('Error al cargar comisiones'));
  }, [toastError]);

  useEffect(() => {
    fetchAll<SectionYearPublic>((o) => api.getSectionYears({ limit: 100, offset: o }))
      .then((items) => {
        setAllSectionYears(items);
        // Si el año actual todavía no tiene cursos lectivos, se muestran todos los años
        if (!items.some((sy) => sy.year === currentYear)) setYearFilter('');
      })
      .catch(() => setAllSectionYears([]));
  }, []);

  // Opciones del filtro de año: los años que tienen cursos lectivos, del más reciente al más viejo
  const yearOptions = [...new Set(allSectionYears.map((sy) => sy.year))].sort((a, b) => b - a);

  // Opciones del filtro de comisión: con un año elegido, solo las comisiones con curso lectivo en ese año
  const sectionsOfYear = (year: string): SectionPublic[] => {
    if (!year) return allSections;
    const ids = new Set(
      allSectionYears.filter((sy) => sy.year === parseInt(year, 10)).map((sy) => sy.id_section)
    );
    return allSections.filter((s) => ids.has(s.id_section));
  };
  const sectionOptions = sectionsOfYear(yearFilter);

  // Se traen todos los cursos lectivos, asignaciones y proyectos del filtro y se agrupan acá:
  // son tres listados en total, sin importar cuántos cursos lectivos haya.
  const fetchOverview = useCallback(async () => {
    setLoading(true);
    const filters = {
      year: yearFilter ? parseInt(yearFilter, 10) : null,
      id_section: sectionFilter ? parseInt(sectionFilter, 10) : null,
    };
    try {
      const [sectionYears, assignments, projects] = await Promise.all([
        fetchAll<SectionYearWithLimits>((o) =>
          api.getSectionYears({ ...filters, limit: 100, offset: o })
        ),
        fetchAll<ProfessorSectionYearPublic>((o) =>
          api.getProfessorSectionYears({ ...filters, limit: 100, offset: o })
        ),
        fetchAll<ProjectWithStatus>((o) =>
          api.getProjects({ ...filters, limit: 100, offset: o })
        ),
      ]);

      const built = sectionYears.map((sy): ChairRow => {
        const syProjects = projects.filter((p) => p.id_section_year === sy.id_section_year);
        const stages: Record<Stage, number> = {
          uninsured: 0,
          developing: 0,
          approved: 0,
          cancelled: 0,
        };
        const developingDetail: Record<string, number> = {};
        for (const p of syProjects) {
          const stage = stageOf(p);
          stages[stage] += 1;
          if (stage === 'developing') {
            const code = p.status?.code ?? 'in_idea';
            developingDetail[code] = (developingDetail[code] ?? 0) + 1;
          }
        }
        return {
          ...sy,
          professors: assignments
            .filter((a) => a.id_section_year === sy.id_section_year)
            .map((a) => ({
              id_professor: a.id_professor,
              first_name: a.professor_first_name,
              last_name: a.professor_last_name,
            })),
          project_count: syProjects.length,
          stages,
          developing_detail: developingDetail,
        };
      });

      setRows(built);
      setSummary({
        section_years: built.length,
        projects: built.reduce((acc, r) => acc + r.project_count, 0),
        approved: built.reduce((acc, r) => acc + r.stages.approved, 0),
        without_professors: built.filter((r) => r.professors.length === 0).length,
      });
    } catch {
      toastError('Error al cargar el estado de la cátedra');
      setRows([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [yearFilter, sectionFilter, toastError]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const pageRows = rows.slice(offset, offset + PAGE_SIZE);

  // Cursos lectivos cuyos alumnos ya se contaron (o se están contando) para el listado actual
  const counted = useRef<{ rows: ChairRow[]; ids: Set<number> }>({ rows: [], ids: new Set() });

  // La cantidad de alumnos en grupos se consulta solo para la página visible. Con cada listado
  // nuevo se vuelve a contar, pero se sigue mostrando el número anterior hasta que llega el nuevo.
  useEffect(() => {
    if (counted.current.rows !== rows) counted.current = { rows, ids: new Set() };
    const { ids } = counted.current;
    const missing = pageRows.filter((r) => !ids.has(r.id_section_year));
    if (missing.length === 0) return;
    missing.forEach((r) => ids.add(r.id_section_year));
    let cancelled = false;
    let done = false;
    Promise.all(
      missing.map(async (r) => {
        const res = await api.getStudents({ id_section_year: r.id_section_year, limit: 1 });
        return [r.id_section_year, res.total] as const;
      })
    )
      .then((pairs) => {
        if (cancelled) return;
        done = true;
        setStudentCounts((prev) => ({ ...prev, ...Object.fromEntries(pairs) }));
      })
      .catch(() => {
        if (cancelled) return;
        missing.forEach((r) => ids.delete(r.id_section_year));
        toastError('Error al cargar la cantidad de alumnos');
      });
    return () => {
      cancelled = true;
      // Si se cambió de página o de listado antes de la respuesta, se podrán volver a pedir
      if (!done) missing.forEach((r) => ids.delete(r.id_section_year));
    };
  }, [rows, offset]);

  // Grupos aprobados sobre los grupos que siguen vigentes (sin contar cancelados). Un grupo
  // rechazado sigue vigente: rehace la propuesta hasta aprobar.
  const progressOf = (row: ChairRow): number | null => {
    const active = row.project_count - row.stages.cancelled;
    return active > 0 ? Math.round((row.stages.approved / active) * 100) : null;
  };

  // Color de la barra de grupos aprobados: rojo hasta 33 %, amarillo hasta 66 % y verde desde 67 %
  const progressColor = (progress: number): string => {
    if (progress < 34) return 'bg-danger-vivid';
    if (progress < 67) return 'bg-warning-vivid';
    return 'bg-success-vivid';
  };

  // Estados de la etapa "En desarrollo" que tienen al menos un grupo
  const developingStatusesOf = (row: ChairRow) =>
    DEVELOPING_STATUSES.filter((s) => (row.developing_detail[s.code] ?? 0) > 0);

  return (
    <div>
      <PageHeader
        title="Estado de la cátedra"
        subtitle="Panorama de los cursos lectivos: docentes, grupos y aprobados"
      />

      <div className="space-y-4">
        {/* Filtros Año y Comisión */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <Select
              value={yearFilter}
              onChange={(e) => {
                const year = e.target.value;
                setYearFilter(year);
                // Si la comisión elegida no tiene curso lectivo en el año nuevo, se quita el filtro
                if (sectionFilter && !sectionsOfYear(year).some((s) => String(s.id_section) === sectionFilter)) {
                  setSectionFilter('');
                }
                setOffset(0);
              }}
              aria-label="Filtrar por año"
            >
              <option value="">Todos los años</option>
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Select
              value={sectionFilter}
              onChange={(e) => {
                setSectionFilter(e.target.value);
                setOffset(0);
              }}
              aria-label="Filtrar por comisión"
            >
              <option value="">Todas las comisiones</option>
              {sectionOptions.map((s) => (
                <option key={s.id_section} value={s.id_section}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* Totales del filtro: una sola franja, no tarjetas sueltas */}
        {summary && summary.section_years > 0 && (
          <dl className="grid grid-cols-2 lg:grid-cols-4 rounded-xl border border-line bg-white divide-line max-lg:[&>div:nth-child(-n+2)]:border-b lg:divide-x max-lg:[&>div:nth-child(odd)]:border-r">
            {[
              { label: 'Cursos lectivos', value: summary.section_years, alert: false },
              { label: 'Grupos', value: summary.projects, alert: false },
              { label: 'Grupos aprobados', value: summary.approved, alert: false },
              {
                label: 'Cursos sin docentes',
                value: summary.without_professors,
                alert: summary.without_professors > 0,
              },
            ].map((card) => (
              <div key={card.label} className="px-5 py-3.5 border-line">
                <dt className="text-[13px] text-ink-muted">{card.label}</dt>
                <dd
                  className={`mt-0.5 text-xl font-semibold tabular-nums ${
                    card.alert ? 'text-danger' : 'text-ink'
                  }`}
                >
                  {card.value}
                </dd>
              </div>
            ))}
          </dl>
        )}

        {/* El esqueleto va solo en la primera carga: al cambiar un filtro se siguen viendo los datos
            anteriores hasta que llegan los nuevos, sin que la pantalla parpadee */}
        {loading && rows.length === 0 ? (
          <TableSkeleton rows={4} cols={8} />
        ) : rows.length === 0 ? (
          yearFilter || sectionFilter ? (
            <EmptyState
              icon={<SearchX className="w-5 h-5" />}
              message="Ningún curso lectivo coincide con los filtros"
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setYearFilter(''); setSectionFilter(''); setOffset(0); }}
                >
                  Limpiar filtros
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<BarChart3 className="w-5 h-5" />}
              message="Todavía no hay cursos lectivos"
              description="El estado de la cátedra aparece cuando se registra el primer curso lectivo en Comisiones."
            />
          )
        ) : (
          <>
            {/* Anchos fijos por columna: al filtrar, la tabla no cambia de forma */}
            <Table className="table-fixed min-w-[1340px]">
              <colgroup>
                <col className="w-[120px]" />
                <col className="w-[64px]" />
                <col className="w-[150px]" />
                <col className="w-[260px]" />
                <col className="w-[80px]" />
                <col className="w-[100px]" />
                <col className="w-[150px]" />
                <col className="w-[96px]" />
                <col className="w-[100px]" />
                <col className="w-[100px]" />
                <col className="w-[120px]" />
              </colgroup>
              <TableHeader>
                <tr>
                  <TableHead>Comisión</TableHead>
                  <TableHead>Año</TableHead>
                  <TableHead>Grupos aprobados (%)</TableHead>
                  <TableHead>Docentes</TableHead>
                  <TableHead className="text-center">Grupos</TableHead>
                  {(Object.keys(STAGE_LABELS) as Stage[]).map((stage) => (
                    <TableHead key={stage} className="text-center">
                      {STAGE_LABELS[stage]}
                    </TableHead>
                  ))}
                  <TableHead className="text-center">Alumnos en grupos</TableHead>
                  <TableHead className="text-center">Cupo de integrantes por grupo</TableHead>
                </tr>
              </TableHeader>
              <tbody>
                {pageRows.map((row) => {
                  const progress = progressOf(row);
                  const students = studentCounts[row.id_section_year];
                  return (
                    <TableRow key={row.id_section_year}>
                      <TableCell className="font-medium text-ink">
                        {row.section_name}
                      </TableCell>
                      <TableCell className="text-ink-muted tabular-nums">{row.year}</TableCell>
                      <TableCell>
                        {progress === null ? (
                          <span className="text-xs text-ink-faint">Sin grupos</span>
                        ) : (
                          <div className="flex items-center gap-2 min-w-28">
                            <div
                              className="h-2 flex-1 rounded-full bg-line-neutral overflow-hidden"
                              role="progressbar"
                              aria-valuenow={progress}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-label={`Grupos aprobados de ${row.section_name} ${row.year}`}
                            >
                              <div
                                className={`h-full ${progressColor(progress)}`}
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className="text-xs text-ink-muted tabular-nums w-9 text-right">
                              {progress}%
                            </span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5">
                          {row.professors.length > 0 ? (
                            row.professors.map((p) => (
                              <span
                                key={p.id_professor}
                                title={`${p.first_name} ${p.last_name}`}
                                className="inline-block max-w-full truncate px-2 py-0.5 rounded-md text-xs font-medium bg-tint text-navy border border-tint-strong"
                              >
                                {p.first_name} {p.last_name}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs font-medium text-danger">
                              Sin docentes
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-semibold tabular-nums">
                        {row.project_count}
                      </TableCell>
                      {(Object.keys(STAGE_LABELS) as Stage[]).map((stage) => (
                        <TableCell
                          key={stage}
                          className={`text-center tabular-nums ${
                            row.stages[stage] === 0 ? 'text-ink-faint' : ''
                          }`}
                        >
                          {stage === 'developing' && row.stages.developing > 0 ? (
                            <div className="flex flex-col items-center gap-0.5 font-sans text-xs whitespace-nowrap">
                              {developingStatusesOf(row).map((s) => (
                                <span key={s.code}>
                                  {s.name}:{' '}
                                  <span className="font-semibold tabular-nums">
                                    {row.developing_detail[s.code]}
                                  </span>
                                </span>
                              ))}
                              {/* Con más de un estado, se suma el total de la etapa */}
                              {developingStatusesOf(row).length > 1 && (
                                <span className="mt-0.5 pt-0.5 border-t border-line text-ink-muted">
                                  Total:{' '}
                                  <span className="font-semibold tabular-nums text-ink">
                                    {row.stages.developing}
                                  </span>
                                </span>
                              )}
                            </div>
                          ) : (
                            row.stages[stage]
                          )}
                        </TableCell>
                      ))}
                      <TableCell className="text-center tabular-nums">
                        {students ?? '…'}
                      </TableCell>
                      <TableCell className="text-center tabular-nums whitespace-nowrap">
                        {row.min_students !== undefined && row.max_students !== undefined
                          ? `${row.min_students} – ${row.max_students}`
                          : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </tbody>
            </Table>

            <Pagination
              total={rows.length}
              limit={PAGE_SIZE}
              offset={offset}
              onChangeOffset={setOffset}
            />
          </>
        )}
      </div>
    </div>
  );
};
