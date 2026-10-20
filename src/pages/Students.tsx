import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { StudentListItem } from '../types/api';
import { useAuth } from '../context/AuthContext';
import { PageHeader } from '../components/ui/PageHeader';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableCell,
  InitialsAvatar,
} from '../components/ui/Table';
import { Pagination } from '../components/ui/Pagination';
import { EmptyState, TableSkeleton } from '../components/ui/EmptyState';
import { ActionMenu } from '../components/ui/ActionMenu';
import { EditStudentModal } from '../components/EditStudentModal';
import { Search, Plus, RefreshCw, Edit2 } from 'lucide-react';

const PAGE_SIZE = 10;

interface CourseOption {
  id_section_year: number;
  label: string;
}

// Consultar estudiantes (SCRUM-99): GET /students. El docente común ve los alumnos de sus cursos
// lectivos, con el equipo al que pertenece cada uno; el super administrador, todos los alumnos.
export const Students: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [course, setCourse] = useState('');
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentListItem | null>(null);

  // Filtro por curso lectivo: los del docente o, para el super administrador, todos
  useEffect(() => {
    if (!user) return;
    const load = user.is_super_admin
      ? api.getSectionYears({ limit: 100 }).then((r) =>
          r.items.map((sy) => ({ id_section_year: sy.id_section_year, label: `${sy.section_name} (${sy.year})` }))
        )
      : api.getProfessorSectionYears({ id_professor: user.id_user, limit: 100 }).then((r) =>
          r.items.map((a) => ({ id_section_year: a.id_section_year, label: `${a.section_name} (${a.year})` }))
        );
    load.then(setCourses).catch(() => setCourses([]));
  }, [user]);

  // La búsqueda espera a que se deje de escribir; cada pedido descarta las respuestas anteriores
  // que lleguen tarde (si no, "Pe" podría pisar los resultados de "Pérez").
  const [query, setQuery] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setQuery(searchQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);
  const requestId = useRef(0);

  const fetchStudents = useCallback(async () => {
    const current = ++requestId.current;
    setIsLoading(true);
    setLoadError(false);
    try {
      const res = await api.getStudents({
        id_section_year: course ? Number(course) : null,
        q: query || null,
        limit: PAGE_SIZE,
        offset,
      });
      if (current !== requestId.current) return;
      setStudents(res.items);
      setTotal(res.total);
    } catch {
      if (current !== requestId.current) return;
      setLoadError(true);
    } finally {
      if (current === requestId.current) setIsLoading(false);
    }
  }, [query, course, offset]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const hasFilters = Boolean(searchQuery.trim() || course);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Estudiantes"
        subtitle={
          user?.is_super_admin
            ? 'Todos los alumnos registrados y sus equipos'
            : 'Alumnos de sus cursos lectivos y el equipo de cada uno'
        }
        // El docente registra alumnos con su historia (SCRUM-97)
        action={
          user?.is_super_admin ? (
            <Button variant="primary" onClick={() => navigate('/estudiantes/nuevo')}>
              <Plus className="w-4 h-4 mr-1.5" />
              Registrar estudiantes
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-3xl">
        <Input
          type="text"
          aria-label="Buscar"
          placeholder="Buscar por nombre, apellido o legajo"
          maxLength={100}
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setOffset(0);
          }}
          leftIcon={<Search className="w-4 h-4" />}
        />
        <Select
          aria-label="Curso lectivo"
          value={course}
          onChange={(e) => {
            setCourse(e.target.value);
            setOffset(0);
          }}
          options={[
            { value: '', label: user?.is_super_admin ? 'Todos los cursos lectivos' : 'Todos mis cursos lectivos' },
            ...courses.map((c) => ({ value: c.id_section_year, label: c.label })),
          ]}
        />
      </div>

      {isLoading ? (
        <TableSkeleton rows={4} cols={5} />
      ) : loadError ? (
        <EmptyState
          message="No se pudo cargar el listado de estudiantes."
          action={
            <Button variant="outline" size="sm" onClick={fetchStudents}>
              <RefreshCw className="w-4 h-4 mr-1.5" />
              Reintentar
            </Button>
          }
        />
      ) : students.length === 0 ? (
        <EmptyState
          message={
            hasFilters
              ? 'No hay estudiantes que coincidan con la búsqueda.'
              : user?.is_super_admin
                ? 'Todavía no hay estudiantes registrados.'
                : 'Todavía no hay estudiantes en sus cursos lectivos. Aparecen cuando se suman a un equipo.'
          }
          action={
            hasFilters ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setCourse('');
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
          <Table>
            <TableHeader>
              <tr>
                <TableHead>Legajo</TableHead>
                <TableHead>Apellido y nombre</TableHead>
                <TableHead>Correo de ingreso</TableHead>
                <TableHead>Año de ingreso</TableHead>
                <TableHead>Equipo</TableHead>
                <TableHead className="w-20 text-right sticky right-0 bg-[#EFF6FF]">Acciones</TableHead>
              </tr>
            </TableHeader>
            <tbody>
              {students.map((st) => (
                <TableRow key={st.id_student}>
                  <TableCell className="font-mono font-medium text-[#0F1F3D]">{st.legajo}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3 min-w-[160px]">
                      <InitialsAvatar name={`${st.last_name} ${st.first_name}`} size="sm" />
                      <span className="font-medium text-[#0F1F3D]">
                        {st.last_name}, {st.first_name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-[#51607A] text-xs">{st.email}</TableCell>
                  <TableCell className="text-[#51607A]">{st.enrollment_year}</TableCell>
                  <TableCell className="min-w-[160px]">
                    {st.groups.length === 0 ? (
                      <span className="text-xs italic text-[#8A9AB5]">Sin equipo</span>
                    ) : (
                      <ul className="space-y-0.5">
                        {st.groups.map((g) => (
                          <li key={g.id_project}>
                            <span className="text-sm text-[#0F1F3D]">Equipo {g.group_number}</span>
                            <span className="text-xs text-[#51607A]">
                              {' '}
                              · {g.section_name} ({g.year})
                              {g.project_name ? ` · ${g.project_name}` : ''}
                            </span>
                            {g.is_leader && (
                              <Badge variant="superadmin" className="ml-1.5">Jefe</Badge>
                            )}
                            {g.status && g.status.code !== 'active' && (
                              <Badge variant="neutral" className="ml-1.5">{g.status.name}</Badge>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </TableCell>
                  <TableCell className="text-right sticky right-0 bg-white border-b border-[#D6E4F7]">
                    <ActionMenu
                      label={`Acciones de ${st.first_name} ${st.last_name}`}
                      items={[
                        {
                          label: 'Modificar',
                          icon: <Edit2 className="w-3.5 h-3.5 text-[#1D4ED8]" />,
                          onClick: () => setEditingStudent(st),
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

      {/* GET /students no expone la fecha de nacimiento al docente: el diálogo no la muestra */}
      {editingStudent && (
        <EditStudentModal
          key={editingStudent.id_student}
          student={{
            id: editingStudent.id_student,
            first_name: editingStudent.first_name,
            last_name: editingStudent.last_name,
            legajo: editingStudent.legajo,
            enrollment_year: editingStudent.enrollment_year,
          }}
          onClose={() => setEditingStudent(null)}
          onSaved={fetchStudents}
        />
      )}
    </div>
  );
};
