import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import type { ProfessorPublic, ProfessorSectionYearPublic, UserListItem } from '../types/api';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Table, TableHeader, TableRow, TableHead, TableCell, InitialsAvatar } from '../components/ui/Table';
import { Pagination } from '../components/ui/Pagination';
import { EmptyState, TableSkeleton } from '../components/ui/EmptyState';
import { ActionMenu } from '../components/ui/ActionMenu';
import { useToast } from '../components/ui/Toast';
import { ProfessorFormModal } from '../components/ProfessorFormModal';
import { DeleteUserModal } from '../components/DeleteUserModal';
import { useHighlight } from '../lib/useHighlight';
import { CloudOff, Edit2, Plus, RefreshCw, Search, SearchX, Trash2, UserCheck } from 'lucide-react';

const PAGE_SIZE = 10;

type Course = Pick<ProfessorSectionYearPublic, 'id_section_year' | 'section_name' | 'year'>;

// Todas las asignaciones de docentes a cursos lectivos, agrupadas por docente: el backend no
// filtra por varios docentes a la vez, y son pocas (se piden de a 100)
const allAssignments = async (): Promise<Map<number, Course[]>> => {
  const byProfessor = new Map<number, Course[]>();
  for (let offset = 0, total = Infinity; offset < total; offset += 100) {
    const res = await api.getProfessorSectionYears({ limit: 100, offset });
    total = res.total;
    if (res.items.length === 0) break;
    for (const a of res.items) {
      const list = byProfessor.get(a.id_professor) ?? [];
      list.push({ id_section_year: a.id_section_year, section_name: a.section_name, year: a.year });
      byProfessor.set(a.id_professor, list);
    }
  }
  for (const list of byProfessor.values())
    list.sort((a, b) => b.year - a.year || a.section_name.localeCompare(b.section_name, 'es'));
  return byProfessor;
};

const courseLabel = (c: Course) => `${c.section_name} (${c.year})`;

// Los cursos del ciclo lectivo más reciente y, si tiene de otros años, cuántos más (todos en el título)
const AssignedCourses: React.FC<{ courses?: Course[] }> = ({ courses }) => {
  if (!courses || courses.length === 0)
    return <span className="text-xs italic text-ink-subtle">Sin cursos asignados</span>;
  const latest = courses.filter((c) => c.year === courses[0].year);
  const rest = courses.length - latest.length;
  return (
    <span className="block [overflow-wrap:anywhere]" title={courses.map(courseLabel).join(', ')}>
      <span className="text-sm text-ink">{latest.map(courseLabel).join(', ')}</span>
      {rest > 0 && (
        <span className="text-xs text-ink-muted">
          {' '}
          · {rest === 1 ? '1 más de años anteriores' : `${rest} más de años anteriores`}
        </span>
      )}
    </span>
  );
};

const getId = (u: UserListItem) => u.id_user;

const fromCreated = (p: ProfessorPublic): UserListItem => ({
  id_user: p.id_professor,
  first_name: p.first_name,
  last_name: p.last_name,
  legajo: p.legajo,
  email: p.email,
  role: 'professor',
  birth_date: p.birth_date ?? null,
  is_super_admin: p.is_super_admin,
});

// Docentes (SCRUM-5, SCRUM-6, SCRUM-7, SCRUM-111, SCRUM-609): los docentes y administradores de la
// cátedra, con los cursos lectivos que tiene asignados cada uno. Solo el administrador.
export const Professors: React.FC = () => {
  const { success } = useToast();
  const [professors, setProfessors] = useState<UserListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  // null mientras llegan; si no se pueden leer, la columna lo dice y el resto de la lista se muestra igual
  const [assignments, setAssignments] = useState<Map<number, Course[]> | null>(null);
  const [assignmentsError, setAssignmentsError] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editing, setEditing] = useState<UserListItem | null>(null);
  const [deleting, setDeleting] = useState<UserListItem | null>(null);
  const { highlight, withHighlighted, isHighlighted } = useHighlight(getId);

  // La búsqueda espera a que se deje de escribir; cada pedido descarta las respuestas anteriores
  const [query, setQuery] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setQuery(searchQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);
  const requestId = useRef(0);

  const fetchProfessors = useCallback(async () => {
    const current = ++requestId.current;
    setIsLoading(true);
    setLoadError(false);
    try {
      const res = await api.getUsers({ role: 'professor', q: query || null, limit: PAGE_SIZE, offset });
      if (current !== requestId.current) return;
      setProfessors(res.items);
      setTotal(res.total);
    } catch {
      if (current === requestId.current) setLoadError(true);
    } finally {
      if (current === requestId.current) setIsLoading(false);
    }
  }, [query, offset]);

  const fetchAssignments = useCallback(() => {
    setAssignmentsError(false);
    allAssignments()
      .then(setAssignments)
      .catch(() => {
        setAssignments(new Map());
        setAssignmentsError(true);
      });
  }, []);

  useEffect(() => {
    fetchProfessors();
  }, [fetchProfessors]);
  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  const rows = withHighlighted(professors);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Docentes"
        subtitle="Docentes y administradores de la cátedra, con sus cursos lectivos asignados"
        action={
          <Button variant="primary" onClick={() => setIsCreating(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            Registrar docente
          </Button>
        }
      />

      <div className="w-full sm:max-w-sm">
        <Input
          type="text"
          aria-label="Buscar docentes"
          placeholder="Buscar por nombre, legajo o correo"
          maxLength={100}
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setOffset(0);
          }}
          leftIcon={<Search className="w-4 h-4" />}
        />
      </div>

      {assignmentsError && (
        <p className="text-sm text-warning">
          No se pudieron consultar los cursos lectivos asignados.{' '}
          <button type="button" onClick={fetchAssignments} className="font-medium underline cursor-pointer">
            Reintentar
          </button>
        </p>
      )}

      {isLoading && rows.length === 0 ? (
        <TableSkeleton rows={4} cols={5} />
      ) : loadError ? (
        <EmptyState
          icon={<CloudOff className="w-5 h-5" />}
          message="No se pudo cargar el listado de docentes"
          description="Puede ser un problema de conexión. Intente nuevamente en unos segundos."
          action={
            <Button variant="outline" size="sm" onClick={fetchProfessors}>
              <RefreshCw className="w-4 h-4 mr-1.5" />
              Reintentar
            </Button>
          }
        />
      ) : rows.length === 0 ? (
        query ? (
          <EmptyState
            icon={<SearchX className="w-5 h-5" />}
            message="Ningún docente coincide con la búsqueda"
            description="Revise el nombre, el legajo o el correo."
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setOffset(0);
                }}
              >
                Limpiar búsqueda
              </Button>
            }
          />
        ) : (
          <EmptyState icon={<UserCheck className="w-5 h-5" />} message="Todavía no hay docentes registrados" />
        )
      ) : (
        <>
          {/* Anchos fijos por columna: al buscar, la tabla no cambia de forma */}
          <Table className="table-fixed min-w-[900px]">
            <colgroup>
              <col className="w-[24%]" />
              <col className="w-[24%]" />
              <col className="w-[10%]" />
              <col className="w-[13%]" />
              <col className="w-[29%]" />
              <col className="w-16" />
            </colgroup>
            <TableHeader>
              <tr>
                <TableHead>Apellido y nombre</TableHead>
                <TableHead>Correo electrónico</TableHead>
                <TableHead>Legajo</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Cursos asignados</TableHead>
                {/* Fija a la derecha: con la tabla más ancha que la pantalla, las acciones siguen a la vista */}
                <TableHead className="sticky right-0 bg-canvas">
                  <span className="sr-only">Acciones</span>
                </TableHead>
              </tr>
            </TableHeader>
            <tbody>
              {rows.map((p) => (
                <TableRow key={p.id_user} className={isHighlighted(p) ? 'row-highlight' : ''}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <InitialsAvatar name={`${p.last_name} ${p.first_name}`} size="sm" />
                      <span className="min-w-0 font-medium text-ink [overflow-wrap:anywhere]">
                        {p.last_name}, {p.first_name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-ink-muted">
                    <span className="block truncate" title={p.email}>
                      {p.email}
                    </span>
                  </TableCell>
                  <TableCell className="text-ink-muted tabular-nums">{p.legajo}</TableCell>
                  <TableCell>
                    {p.is_super_admin ? (
                      <Badge variant="superadmin">Administrador</Badge>
                    ) : (
                      <Badge variant="professor">Docente</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {assignments === null ? (
                      <span className="block h-4 w-28 rounded bg-fill-neutral animate-pulse" aria-label="Cargando" />
                    ) : assignmentsError ? (
                      <span className="text-xs text-ink-subtle">—</span>
                    ) : (
                      <AssignedCourses courses={assignments.get(p.id_user)} />
                    )}
                  </TableCell>
                  <TableCell className="text-right sticky right-0 bg-white group-hover:bg-canvas transition-colors duration-150">
                    <ActionMenu
                      label={`Acciones de ${p.first_name} ${p.last_name}`}
                      items={[
                        {
                          label: 'Modificar',
                          icon: <Edit2 className="w-3.5 h-3.5 text-primary" />,
                          onClick: () => setEditing(p),
                        },
                        {
                          label: 'Eliminar',
                          icon: <Trash2 className="w-3.5 h-3.5" />,
                          onClick: () => setDeleting(p),
                          danger: true,
                        },
                      ]}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </tbody>
          </Table>

          <Pagination total={total} limit={PAGE_SIZE} offset={offset} onChangeOffset={setOffset} />
        </>
      )}

      {(isCreating || editing) && (
        <ProfessorFormModal
          key={editing?.id_user ?? 'new'}
          professor={editing}
          onClose={() => {
            setIsCreating(false);
            setEditing(null);
          }}
          onSaved={(created) => {
            setIsCreating(false);
            setEditing(null);
            if (created) highlight(fromCreated(created));
            fetchProfessors();
          }}
        />
      )}

      {deleting && (
        <DeleteUserModal
          key={deleting.id_user}
          person={{
            id: deleting.id_user,
            first_name: deleting.first_name,
            last_name: deleting.last_name,
            legajo: deleting.legajo,
            role: 'professor',
            is_super_admin: deleting.is_super_admin,
          }}
          remove={api.deleteUser}
          onClose={() => setDeleting(null)}
          onDeleted={(name) => {
            setDeleting(null);
            success(`Se eliminó a ${name}`);
            // Si era el único de la última página, se vuelve a la anterior
            if (professors.length === 1 && offset > 0) setOffset(offset - PAGE_SIZE);
            else fetchProfessors();
          }}
        />
      )}
    </div>
  );
};
