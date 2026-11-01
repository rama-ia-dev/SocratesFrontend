import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CloudOff, FolderKanban, Plus, RefreshCw, Search, SearchX } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import type { ProjectPrivacy, ProjectPublic, SectionYearPublic } from '../types/api';
import { PageHeader } from '../components/ui/PageHeader';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Table, TableHeader, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { Pagination } from '../components/ui/Pagination';
import { useToast } from '../components/ui/Toast';
import { CreateTeamsModal } from '../components/CreateTeamsModal';
import { EmptyState, TableSkeleton } from '../components/ui/EmptyState';
import { PRIVACY_LABEL, STATUS_VARIANT, teamLabel } from '../lib/projects';

const PAGE_SIZE = 10;

type Scope = 'all' | 'mine';

type ProjectFilters = {
  year: number | null;
  id_section: number | null;
  privacy: ProjectPrivacy | null;
  q: string | null;
};

// Todos los equipos de un curso lectivo, recorriendo las páginas del backend (de a 100 como máximo)
const allProjectsOf = async (id_section_year: number, filters: ProjectFilters) => {
  const items: ProjectPublic[] = [];
  for (let offset = 0; ; offset += 100) {
    const res = await api.getProjects({ ...filters, id_section_year, limit: 100, offset });
    items.push(...res.items);
    if (items.length >= res.total || res.items.length === 0) return items;
  }
};

// Los equipos del curso lectivo actual del usuario, recorriendo las páginas del backend
const allMyProjects = async () => {
  const items: ProjectPublic[] = [];
  for (let offset = 0; ; offset += 100) {
    const res = await api.getMySectionYearProjects({ limit: 100, offset });
    items.push(...res.items);
    if (items.length >= res.total || res.items.length === 0) return items;
  }
};

// El mismo orden que usa el backend: año más reciente, comisión y número de equipo
const byYearSectionNumber = (a: ProjectPublic, b: ProjectPublic) =>
  b.year - a.year || a.section_name.localeCompare(b.section_name, 'es') || a.group_number - b.group_number;

// Equipos de trabajo (SCRUM-105). El backend decide qué equipos ve cada usuario según la
// privacidad: los privados solo aparecen para sus integrantes, los docentes del curso y los
// administradores.
export const Projects: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { success } = useToast();
  const isProfessor = user?.role === 'professor';
  // El alumno ve solo los equipos de su curso lectivo actual
  const isStudent = user?.role === 'student';
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  // El docente ve también equipos de cursos ajenos (los públicos); arranca por los suyos
  const canFilterMine = isProfessor && !user?.is_super_admin;
  const [scope, setScope] = useState<Scope>(canFilterMine ? 'mine' : 'all');
  const [mySectionYears, setMySectionYears] = useState<number[] | null>(null);

  useEffect(() => {
    if (!canFilterMine || !user) return;
    api
      .getProfessorSectionYears({ id_professor: user.id_user, limit: 100 })
      .then((res) => setMySectionYears(res.items.map((a) => a.id_section_year)))
      .catch(() => setMySectionYears([]));
  }, [canFilterMine, user]);

  const [projects, setProjects] = useState<ProjectPublic[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [sectionYears, setSectionYears] = useState<SectionYearPublic[]>([]);
  const [year, setYear] = useState('');
  const [section, setSection] = useState('');
  const [privacy, setPrivacy] = useState<ProjectPrivacy | ''>('');
  const [searchQuery, setSearchQuery] = useState('');

  // La búsqueda espera a que se deje de escribir
  const [query, setQuery] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setQuery(searchQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

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
  // Con un año elegido, solo las comisiones que tienen curso lectivo ese año
  const sectionsOfYear = useCallback(
    (y: string) => {
      const byId = new Map(
        sectionYears.filter((sy) => !y || sy.year === Number(y)).map((sy) => [sy.id_section, sy.section_name])
      );
      return [...byId].sort((a, b) => a[1].localeCompare(b[1], 'es'));
    },
    [sectionYears]
  );
  const sectionOptions = useMemo(() => sectionsOfYear(year), [sectionsOfYear, year]);

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
      q: query || null,
    };
    try {
      if (isStudent) {
        // Un solo curso lectivo: se trae entero y la búsqueda y la privacidad se aplican acá
        const q = query.toLowerCase();
        const mine = (await allMyProjects())
          .filter((p) => !privacy || p.privacy === privacy)
          .filter((p) => !q || (p.name ?? '').toLowerCase().includes(q))
          .sort(byYearSectionNumber);
        if (current !== requestId.current) return;
        setProjects(mine.slice(offset, offset + PAGE_SIZE));
        setTotal(mine.length);
      } else if (scope === 'mine') {
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
  }, [year, section, privacy, query, offset, scope, mySectionYears, isStudent]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const changeYear = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value;
    setYear(next);
    // La comisión elegida no tiene curso lectivo en el año nuevo: se vuelve a todas
    if (section && !sectionsOfYear(next).some(([id]) => String(id) === section)) setSection('');
    setOffset(0);
  };
  const hasFilters = Boolean(year || section || privacy || searchQuery.trim());

  return (
    <div className="space-y-6">
      <PageHeader
        title="Equipos de trabajo"
        subtitle={isStudent ? 'Equipos de su curso lectivo y su proyecto' : 'Equipos de cada comisión y su proyecto'}
        action={
          isProfessor ? (
            <Button variant="primary" onClick={() => setIsCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" />
              Crear equipos de trabajo
            </Button>
          ) : undefined
        }
      />

      {canFilterMine && (
        <SegmentedControl
          label="Qué cursos lectivos mostrar"
          value={scope}
          onChange={(v) => {
            setScope(v);
            setOffset(0);
          }}
          options={[
            { value: 'mine' as const, label: 'Mis cursos' },
            { value: 'all' as const, label: 'Todos los cursos' },
          ]}
        />
      )}

      {/* Años y comisiones pueden ser muchos: desplegables. La privacidad tiene tres: a la vista */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div
          className={`grid grid-cols-1 gap-3 shrink-0 ${isStudent ? 'sm:w-[320px]' : 'sm:grid-cols-3 lg:w-[660px]'}`}
        >
          <Input
            type="text"
            aria-label="Buscar por nombre del proyecto"
            placeholder="Buscar proyecto"
            maxLength={200}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setOffset(0);
            }}
            leftIcon={<Search className="w-4 h-4" />}
          />
          {/* El alumno ve un solo curso lectivo: año y comisión no hacen falta */}
          {!isStudent && (
            <>
              <Select
                aria-label="Año"
                value={year}
                onChange={changeYear}
                options={[
                  { value: '', label: 'Todos los años' },
                  ...yearOptions.map((y) => ({ value: y, label: String(y) })),
                ]}
              />
              <Select
                aria-label="Comisión"
                value={section}
                onChange={(e) => {
                  setSection(e.target.value);
                  setOffset(0);
                }}
                options={[
                  { value: '', label: 'Todas las comisiones' },
                  ...sectionOptions.map(([id, name]) => ({ value: id, label: name })),
                ]}
              />
            </>
          )}
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
              : isStudent
                ? 'Todavía no hay equipos de trabajo en su curso lectivo'
                : scope === 'mine'
                  ? 'Todavía no hay equipos de trabajo en sus cursos lectivos'
                  : 'Todavía no hay equipos de trabajo que pueda ver'
          }
          description={
            hasFilters
              ? isStudent
                ? 'Pruebe con otro nombre u otra privacidad.'
                : 'Pruebe con otro nombre, otro año, otra comisión u otra privacidad.'
              : undefined
          }
          action={
            hasFilters ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setYear('');
                  setSection('');
                  setPrivacy('');
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
          <Table className="table-fixed min-w-[860px]">
            <colgroup>
              <col className="w-[12%]" />
              <col className="w-[14%]" />
              <col className="w-[9%]" />
              <col className="w-[33%]" />
              <col className="w-[17%]" />
              <col className="w-[15%]" />
            </colgroup>
            <TableHeader>
              <tr>
                <TableHead>Equipo</TableHead>
                <TableHead>Comisión</TableHead>
                <TableHead>Año</TableHead>
                <TableHead>Nombre del proyecto</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Privacidad</TableHead>
              </tr>
            </TableHeader>
            <tbody>
              {projects.map((p) => (
                <TableRow key={p.id_project} onClick={() => navigate(`/equipos/${p.id_project}`)}>
                  {/* Toda la fila abre el detalle; el enlace del equipo lo hace alcanzable con el teclado */}
                  <TableCell className="font-semibold text-ink whitespace-nowrap">
                    <Link
                      to={`/equipos/${p.id_project}`}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Ver ${teamLabel(p)} de ${p.section_name} ${p.year}`}
                      className="rounded-sm hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      {teamLabel(p)}
                    </Link>
                  </TableCell>
                  <TableCell className="[overflow-wrap:anywhere]">{p.section_name}</TableCell>
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
                </TableRow>
              ))}
            </tbody>
          </Table>

          <Pagination total={total} limit={PAGE_SIZE} offset={offset} onChangeOffset={setOffset} />
        </>
      )}

      {isCreateOpen && (
        <CreateTeamsModal
          onClose={() => setIsCreateOpen(false)}
          onCreated={(created) => {
            setIsCreateOpen(false);
            const first = created[0];
            // Los números libres pueden no ser consecutivos (4 y 6): el rango solo si no hay huecos
            const numbers = created.map((p) => p.group_number).sort((a, b) => a - b);
            const consecutive = numbers.every((n, i) => i === 0 || n === numbers[i - 1] + 1);
            const which = consecutive
              ? `del ${numbers[0]} al ${numbers[numbers.length - 1]}`
              : `${numbers.slice(0, -1).join(', ')} y ${numbers[numbers.length - 1]}`;
            success(
              created.length === 1
                ? `Se creó el ${teamLabel(first)} de ${first.section_name} (${first.year})`
                : `Se crearon ${created.length} equipos en ${first.section_name} (${first.year}): ${which}`
            );
            fetchProjects();
          }}
        />
      )}
    </div>
  );
};
