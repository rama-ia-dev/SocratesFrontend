import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CloudOff, Eye, FolderKanban, RefreshCw, SearchX } from 'lucide-react';
import { api } from '../lib/api';
import type { ProjectPrivacy, ProjectPublic, SectionYearPublic } from '../types/api';
import { PageHeader } from '../components/ui/PageHeader';
import { Select } from '../components/ui/Select';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Table, TableHeader, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { Pagination } from '../components/ui/Pagination';
import { EmptyState, TableSkeleton } from '../components/ui/EmptyState';
import { PRIVACY_LABEL, STATUS_VARIANT, teamLabel } from '../lib/projects';
import { useAuth } from '../context/AuthContext';

const PAGE_SIZE = 10;

type Scope = 'all' | 'mine';

type ProjectFilters = { year: number | null; id_section: number | null; privacy: ProjectPrivacy | null };

// Todos los equipos de un curso lectivo, recorriendo las páginas del backend (de a 100 como máximo)
const allProjectsOf = async (id_section_year: number, filters: ProjectFilters) => {
  const items: ProjectPublic[] = [];
  for (let offset = 0; ; offset += 100) {
    const res = await api.getProjects({ ...filters, id_section_year, limit: 100, offset });
    items.push(...res.items);
    if (items.length >= res.total || res.items.length === 0) return items;
  }
};

// El mismo orden que usa el backend: año más reciente, comisión y número de equipo
const byYearSectionNumber = (a: ProjectPublic, b: ProjectPublic) =>
  b.year - a.year || a.section_name.localeCompare(b.section_name, 'es') || a.group_number - b.group_number;

// Equipos de trabajo (SCRUM-105). El backend decide qué equipos ve cada usuario según la
// privacidad: los privados solo aparecen para sus integrantes, los docentes del curso y los
// super administradores.
export const Projects: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  // El docente ve también equipos de cursos ajenos (los públicos); puede quedarse solo con los suyos
  const isProfessor = user?.role === 'professor' && !user.is_super_admin;
  const [scope, setScope] = useState<Scope>('all');
  const [mySectionYears, setMySectionYears] = useState<number[] | null>(null);

  useEffect(() => {
    if (!isProfessor || !user) return;
    api
      .getProfessorSectionYears({ id_professor: user.id_user, limit: 100 })
      .then((res) => setMySectionYears(res.items.map((a) => a.id_section_year)))
      .catch(() => setMySectionYears([]));
  }, [isProfessor, user]);

  const [projects, setProjects] = useState<ProjectPublic[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [sectionYears, setSectionYears] = useState<SectionYearPublic[]>([]);
  const [year, setYear] = useState('');
  const [section, setSection] = useState('');
  const [privacy, setPrivacy] = useState<ProjectPrivacy | ''>('');

  // Los filtros de año y comisión salen de los cursos lectivos existentes
  useEffect(() => {
    api
      .getSectionYears({ limit: 100 })
      .then((res) => setSectionYears(res.items))
      .catch(() => setSectionYears([]));
  }, []);

  const yearOptions = useMemo(
    () => [...new Set(sectionYears.map((sy) => sy.year))].sort((a, b) => b - a),
    [sectionYears]
  );
  const sectionOptions = useMemo(() => {
    const byId = new Map(sectionYears.map((sy) => [sy.id_section, sy.section_name]));
    return [...byId].sort((a, b) => a[1].localeCompare(b[1], 'es'));
  }, [sectionYears]);

  const requestId = useRef(0);
  const fetchProjects = useCallback(async () => {
    // Los cursos del docente todavía no llegaron: se sigue mostrando la carga
    if (scope === 'mine' && mySectionYears === null) return;
    // Si se cambian los filtros rápido, una respuesta vieja no pisa la nueva
    const current = ++requestId.current;
    setIsLoading(true);
    setLoadError(false);
    const filters: ProjectFilters = {
      year: year ? Number(year) : null,
      id_section: section ? Number(section) : null,
      privacy: privacy || null,
    };
    try {
      if (scope === 'mine') {
        // El backend filtra por un solo curso lectivo: con varios, se piden todos y se pagina acá
        const lists = await Promise.all((mySectionYears ?? []).map((id) => allProjectsOf(id, filters)));
        if (current !== requestId.current) return;
        const mine = lists.flat().sort(byYearSectionNumber);
        setProjects(mine.slice(offset, offset + PAGE_SIZE));
        setTotal(mine.length);
      } else {
        const res = await api.getProjects({ ...filters, limit: PAGE_SIZE, offset });
        if (current !== requestId.current) return;
        setProjects(res.items);
        setTotal(res.total);
      }
    } catch {
      if (current !== requestId.current) return;
      setLoadError(true);
    } finally {
      if (current === requestId.current) setIsLoading(false);
    }
  }, [year, section, privacy, offset, scope, mySectionYears]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const changeFilter = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    setter(e.target.value);
    setOffset(0);
  };
  const hasFilters = Boolean(year || section || privacy || scope === 'mine');

  return (
    <div className="space-y-6">
      <PageHeader title="Equipos de trabajo" subtitle="Equipos de cada comisión y su proyecto" />

      {isProfessor && (
        <SegmentedControl
          label="Qué cursos lectivos mostrar"
          value={scope}
          onChange={(v) => {
            setScope(v);
            setOffset(0);
          }}
          options={[
            { value: 'all' as const, label: 'Todos los cursos' },
            { value: 'mine' as const, label: 'Mis cursos' },
          ]}
        />
      )}

      {/* Años y comisiones pueden ser muchos: desplegables. La privacidad tiene tres: a la vista */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:w-[440px] shrink-0">
          <Select
            aria-label="Año"
            value={year}
            onChange={changeFilter(setYear)}
            options={[
              { value: '', label: 'Todos los años' },
              ...yearOptions.map((y) => ({ value: y, label: String(y) })),
            ]}
          />
          <Select
            aria-label="Comisión"
            value={section}
            onChange={changeFilter(setSection)}
            options={[
              { value: '', label: 'Todas las comisiones' },
              ...sectionOptions.map(([id, name]) => ({ value: id, label: name })),
            ]}
          />
        </div>
        <SegmentedControl
          label="Filtrar por privacidad"
          value={privacy}
          onChange={(v) => {
            setPrivacy(v);
            setOffset(0);
          }}
          options={[
            { value: '' as const, label: 'Todos' },
            ...(Object.keys(PRIVACY_LABEL) as ProjectPrivacy[]).map((p) => ({
              value: p,
              label: PRIVACY_LABEL[p],
            })),
          ]}
        />
      </div>

      {isLoading ? (
        <TableSkeleton rows={5} cols={5} />
      ) : loadError ? (
        <EmptyState
          icon={<CloudOff className="w-5 h-5" />}
          message="No se pudieron cargar los equipos de trabajo"
          description="Puede ser un problema de conexión. Pruebe de nuevo en unos segundos."
          action={
            <Button variant="outline" size="sm" onClick={fetchProjects}>
              <RefreshCw className="w-4 h-4 mr-1.5" />
              Reintentar
            </Button>
          }
        />
      ) : projects.length === 0 ? (
        <EmptyState
          icon={hasFilters ? <SearchX className="w-5 h-5" /> : <FolderKanban className="w-5 h-5" />}
          message={
            hasFilters
              ? 'Ningún equipo de trabajo coincide con los filtros'
              : 'Todavía no hay equipos de trabajo que pueda ver'
          }
          description={hasFilters ? 'Pruebe con otro año, otra comisión u otra privacidad.' : undefined}
          action={
            hasFilters ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setYear('');
                  setSection('');
                  setPrivacy('');
                  setScope('all');
                  setOffset(0);
                }}
              >
                Limpiar filtros
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          {/* Anchos fijos por columna: al filtrar, la tabla no cambia de forma */}
          <Table className="table-fixed min-w-[900px]">
            <colgroup>
              <col className="w-[12%]" />
              <col className="w-[12%]" />
              <col className="w-[9%]" />
              <col className="w-[33%]" />
              <col className="w-[18%]" />
              <col className="w-[16%]" />
              <col className="w-16" />
            </colgroup>
            <TableHeader>
              <tr>
                <TableHead>Equipo</TableHead>
                <TableHead>Comisión</TableHead>
                <TableHead>Año</TableHead>
                <TableHead>Nombre del proyecto</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Privacidad</TableHead>
                {/* Fija a la derecha: con la tabla más ancha que la pantalla, las acciones siguen a la vista */}
                <TableHead className="sticky right-0 bg-canvas">
                  <span className="sr-only">Acciones</span>
                </TableHead>
              </tr>
            </TableHeader>
            <tbody>
              {projects.map((p) => (
                <TableRow key={p.id_project} onClick={() => navigate(`/equipos/${p.id_project}`)}>
                  <TableCell className="font-semibold text-ink whitespace-nowrap">{teamLabel(p)}</TableCell>
                  <TableCell>{p.section_name}</TableCell>
                  <TableCell className="text-ink-muted tabular-nums">{p.year}</TableCell>
                  <TableCell className="[overflow-wrap:anywhere]">
                    {p.restricted ? (
                      <span className="italic text-ink-muted">Detalle reservado</span>
                    ) : p.name ? (
                      p.name
                    ) : (
                      <span className="italic text-ink-subtle">Sin nombre todavía</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {p.status ? (
                      <Badge variant={STATUS_VARIANT[p.status.code] ?? 'neutral'}>{p.status.name}</Badge>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.privacy}>{PRIVACY_LABEL[p.privacy]}</Badge>
                  </TableCell>
                  <TableCell className="text-right sticky right-0 bg-white group-hover:bg-canvas transition-colors duration-150">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/equipos/${p.id_project}`);
                      }}
                      className="p-1.5 rounded-md text-ink-muted hover:text-primary hover:bg-tint transition-colors duration-150 cursor-pointer"
                      aria-label={`Ver ${teamLabel(p)} de ${p.section_name} ${p.year}`}
                      title="Ver detalle"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </tbody>
          </Table>

          <Pagination total={total} limit={PAGE_SIZE} offset={offset} onChangeOffset={setOffset} />
        </>
      )}
    </div>
  );
};
