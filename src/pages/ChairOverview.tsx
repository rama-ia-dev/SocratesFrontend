import React, { useState, useEffect, useCallback } from 'react';
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
const YEAR_OPTIONS = Array.from({ length: 7 }, (_, i) => currentYear + 1 - i);

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

  // La cantidad de alumnos en grupos se consulta solo para la página visible
  useEffect(() => {
    const missing = pageRows.filter((r) => studentCounts[r.id_section_year] === undefined);
    if (missing.length === 0) return;
    let cancelled = false;
    Promise.all(
      missing.map(async (r) => {
        const res = await api.getStudents({ id_section_year: r.id_section_year, limit: 1 });
        return [r.id_section_year, res.total] as const;
      })
    )
      .then((pairs) => {
        if (cancelled) return;
        setStudentCounts((prev) => ({ ...prev, ...Object.fromEntries(pairs) }));
      })
      .catch(() => {
        if (!cancelled) toastError('Error al cargar la cantidad de alumnos');
      });
    return () => {
      cancelled = true;
    };
  }, [rows, offset]);

  // Al cambiar los filtros se vuelven a contar los alumnos
  useEffect(() => {
    setStudentCounts({});
  }, [yearFilter, sectionFilter]);

  // Avance: grupos aprobados sobre los grupos que siguen vigentes (sin contar cancelados)
  const progressOf = (row: ChairRow): number | null => {
    const active = row.project_count - row.stages.cancelled;
    return active > 0 ? Math.round((row.stages.approved / active) * 100) : null;
  };

  // Color de la barra de avance: rojo hasta 33 %, amarillo hasta 66 % y verde desde 67 %
  const progressColor = (progress: number): string => {
    if (progress < 34) return 'bg-[#DC2626]';
    if (progress < 67) return 'bg-[#F59E0B]';
    return 'bg-[#16A34A]';
  };

  // Estados de la etapa "En desarrollo" que tienen al menos un grupo
  const developingStatusesOf = (row: ChairRow) =>
    DEVELOPING_STATUSES.filter((s) => (row.developing_detail[s.code] ?? 0) > 0);

  return (
    <div>
      <PageHeader
        title="Estado de la cátedra"
        subtitle="Panorama de los cursos lectivos: docentes, grupos y avance"
      />

      <div className="space-y-4">
        {/* Filtros Año y Comisión */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <Select
              value={yearFilter}
              onChange={(e) => {
                setYearFilter(e.target.value);
                setOffset(0);
              }}
              aria-label="Filtrar por año"
            >
              <option value="">Todos los años</option>
              {YEAR_OPTIONS.map((y) => (
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
              {allSections.map((s) => (
                <option key={s.id_section} value={s.id_section}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* Totales del filtro */}
        {!loading && summary && summary.section_years > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
              <div
                key={card.label}
                className="p-4 rounded-lg bg-white border border-[#D6E4F7]"
              >
                <p className="text-xs font-medium text-[#51607A]">{card.label}</p>
                <p
                  className={`mt-1 font-mono text-2xl font-semibold ${
                    card.alert ? 'text-[#B91C1C]' : 'text-[#0B2A66]'
                  }`}
                >
                  {card.value}
                </p>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <TableSkeleton rows={4} cols={8} />
        ) : rows.length === 0 ? (
          <EmptyState message="No se encontraron cursos lectivos para los filtros seleccionados." />
        ) : (
          <>
            <Table>
              <TableHeader>
                <tr>
                  <TableHead>Comisión</TableHead>
                  <TableHead>Año</TableHead>
                  <TableHead>Docentes</TableHead>
                  <TableHead className="text-center">Grupos</TableHead>
                  {(Object.keys(STAGE_LABELS) as Stage[]).map((stage) => (
                    <TableHead key={stage} className="text-center">
                      {STAGE_LABELS[stage]}
                    </TableHead>
                  ))}
                  <TableHead className="text-center">Alumnos en grupos</TableHead>
                  <TableHead className="text-center">Integrantes por grupo</TableHead>
                  <TableHead>Avance</TableHead>
                </tr>
              </TableHeader>
              <tbody>
                {pageRows.map((row) => {
                  const progress = progressOf(row);
                  const students = studentCounts[row.id_section_year];
                  return (
                    <TableRow key={row.id_section_year}>
                      <TableCell className="font-semibold text-[#0B2A66]">
                        {row.section_name}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{row.year}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5">
                          {row.professors.length > 0 ? (
                            row.professors.map((p) => (
                              <span
                                key={p.id_professor}
                                className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-[#EFF6FF] text-[#1D4ED8] border border-[#BAE6FD] whitespace-nowrap"
                              >
                                {p.first_name} {p.last_name}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs font-medium text-[#B91C1C]">
                              Sin docentes
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-mono text-sm font-semibold">
                        {row.project_count}
                      </TableCell>
                      {(Object.keys(STAGE_LABELS) as Stage[]).map((stage) => (
                        <TableCell
                          key={stage}
                          className={`text-center font-mono text-sm ${
                            row.stages[stage] === 0 ? 'text-[#94A3B8]' : ''
                          }`}
                        >
                          {stage === 'developing' && row.stages.developing > 0 ? (
                            <div className="flex flex-col items-center gap-0.5 font-sans text-xs whitespace-nowrap">
                              {developingStatusesOf(row).map((s) => (
                                <span key={s.code}>
                                  {s.name}:{' '}
                                  <span className="font-mono font-semibold">
                                    {row.developing_detail[s.code]}
                                  </span>
                                </span>
                              ))}
                              {/* Con más de un estado, se suma el total de la etapa */}
                              {developingStatusesOf(row).length > 1 && (
                                <span className="mt-0.5 pt-0.5 border-t border-[#D6E4F7] text-[#51607A]">
                                  Total:{' '}
                                  <span className="font-mono font-semibold text-[#0F1F3D]">
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
                      <TableCell className="text-center font-mono text-sm">
                        {students ?? '…'}
                      </TableCell>
                      <TableCell className="text-center font-mono text-sm whitespace-nowrap">
                        {row.min_students !== undefined && row.max_students !== undefined
                          ? `${row.min_students} – ${row.max_students}`
                          : '—'}
                      </TableCell>
                      <TableCell>
                        {progress === null ? (
                          <span className="text-xs text-[#94A3B8]">Sin grupos</span>
                        ) : (
                          <div className="flex items-center gap-2 min-w-28">
                            <div
                              className="h-2 flex-1 rounded-full bg-[#E2E8F0] overflow-hidden"
                              role="progressbar"
                              aria-valuenow={progress}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-label={`Avance de ${row.section_name} ${row.year}`}
                            >
                              <div
                                className={`h-full ${progressColor(progress)}`}
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className="font-mono text-xs text-[#51607A] w-9 text-right">
                              {progress}%
                            </span>
                          </div>
                        )}
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
