import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import {
  ProjectPublic,
  SectionYearPublic,
  SectionPublic,
  ProjectPrivacy,
} from '../types/api';
import { useAuth } from '../context/AuthContext';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
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
import { useToast } from '../components/ui/Toast';
import {
  Plus,
  MoreVertical,
  Eye,
  AlertCircle,
  Users,
  UserPlus,
  UserMinus,
  CheckCircle2,
  Info,
  ShieldCheck,
} from 'lucide-react';

export const Projects: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { success, error: toastError } = useToast();

  const isStudent = user?.role === 'student';

  const [projects, setProjects] = useState<ProjectPublic[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Filtros (solo para profesores y superadmin)
  const [sectionYears, setSectionYears] = useState<SectionYearPublic[]>([]);
  const [sections, setSections] = useState<SectionPublic[]>([]);
  const [filterSY, setFilterSY] = useState<string>('');
  const [filterYear, setFilterYear] = useState<string>('');
  const [filterSection, setFilterSection] = useState<string>('');
  const [filterPrivacy, setFilterPrivacy] = useState<ProjectPrivacy | ''>('');

  // Diálogo Crear Equipos de Trabajo (profesores y superadmin)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createCourseId, setCreateCourseId] = useState<number | ''>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [groupNumber, setGroupNumber] = useState<number | ''>('');
  const [minMembers, setMinMembers] = useState<number>(3);
  const [maxMembers, setMaxMembers] = useState<number>(5);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Acciones de alumno (Unirse o Salirse)
  const [joiningProject, setJoiningProject] = useState<ProjectPublic | null>(null);
  const [leavingProject, setLeavingProject] = useState<ProjectPublic | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Menú contextual para vista de tabla
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  // Cargar metadatos para filtros
  useEffect(() => {
    if (!isStudent) {
      const loadFiltersData = async () => {
        try {
          const [syRes, sRes] = await Promise.all([
            api.getSectionYears({ limit: 100 }),
            api.getSections({ limit: 100 }),
          ]);
          setSectionYears(syRes.items);
          setSections(sRes.items);
        } catch {
          // Ignorar
        }
      };
      loadFiltersData();
    }
  }, [isStudent]);

  const fetchProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      // Para alumnos, cargamos todos los equipos de su curso lectivo (ej. 3K1 2025)
      const res = await api.getProjects({
        id_section_year: isStudent ? 1 : filterSY ? Number(filterSY) : null,
        year: isStudent ? null : filterYear ? Number(filterYear) : null,
        id_section: isStudent ? null : filterSection ? Number(filterSection) : null,
        privacy: isStudent ? null : filterPrivacy ? filterPrivacy : null,
        limit: isStudent ? 50 : 10,
        offset: isStudent ? 0 : offset,
      });
      setProjects(res.items);
      setTotal(res.total);
    } catch {
      toastError('Error al cargar equipos de trabajo');
    } finally {
      setIsLoading(false);
    }
  }, [isStudent, filterSY, filterYear, filterSection, filterPrivacy, offset, toastError]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Identificar el equipo actual del alumno si pertenece a alguno
  const myCurrentProject = isStudent
    ? projects.find((p) =>
        (p.members || []).some((m) => m.id_student === user?.id_user)
      )
    : null;

  // Confirmar unirse a un equipo
  const handleConfirmJoin = async () => {
    if (!joiningProject || !user) return;
    setIsActionLoading(true);
    try {
      await api.joinProject(joiningProject.id_project);
      success(`Te has sumado al Equipo ${joiningProject.group_number}`);
      setJoiningProject(null);
      await fetchProjects();
    } catch (err: any) {
      toastError(err.message || 'Error al sumarse al equipo');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Confirmar salir del equipo
  const handleConfirmLeave = async () => {
    if (!leavingProject || !user) return;
    setIsActionLoading(true);
    try {
      await api.leaveProject(leavingProject.id_project);
      success(`Has salido del Equipo ${leavingProject.group_number}`);
      setLeavingProject(null);
      await fetchProjects();
    } catch (err: any) {
      toastError(err.message || 'Error al salir del equipo');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Permiso para crear equipos (solo profesores y super admin)
  const canCreate = user?.is_super_admin || user?.role === 'professor';

  const availableCoursesForCreate = sectionYears.filter((sy) => {
    if (user?.is_super_admin) return true;
    if (user?.role === 'professor') {
      return (sy.assigned_professors || []).some(
        (p) => p.id_professor === user.id_user
      );
    }
    return false;
  });

  const handleOpenCreate = () => {
    setCreateCourseId(availableCoursesForCreate[0]?.id_section_year || '');
    setQuantity(1);
    setGroupNumber('');
    setMinMembers(3);
    setMaxMembers(5);
    setModalError(null);
    setIsCreateModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!createCourseId) {
      setModalError('Seleccione un curso lectivo');
      return;
    }

    if (quantity < 1 || quantity > 50) {
      setModalError('Ingrese un número entre 1 y 50');
      return;
    }

    if (minMembers < 1) {
      setModalError('La cantidad mínima de estudiantes debe ser al menos 1');
      return;
    }

    if (maxMembers < minMembers) {
      setModalError('La cantidad mínima no puede superar la cantidad máxima');
      return;
    }

    setIsCreating(true);
    try {
      if (quantity === 1) {
        await api.createProject({
          id_section_year: Number(createCourseId),
          group_number: groupNumber ? Number(groupNumber) : null,
          min_members: minMembers,
          max_members: maxMembers,
        });
        success('Equipo de trabajo creado');
      } else {
        await api.createProjectsBulk({
          id_section_year: Number(createCourseId),
          quantity,
          min_members: minMembers,
          max_members: maxMembers,
        });
        success(`${quantity} equipos de trabajo creados`);
      }
      setIsCreateModalOpen(false);
      fetchProjects();
    } catch (err: any) {
      if (err.status === 409 || err.message?.includes('existe')) {
        setModalError('Ya existe ese número de equipo en el curso lectivo');
      } else if (err.status === 422) {
        setModalError('Ingrese un número entre 1 y 50');
      } else {
        setModalError(err.message || 'Error al crear equipo');
      }
    } finally {
      setIsCreating(false);
    }
  };

  const renderPrivacyBadge = (privacy: ProjectPrivacy) => {
    const labels = {
      public: 'Público',
      protected: 'Protegido',
      private: 'Privado',
    };
    return <Badge variant={privacy}>{labels[privacy]}</Badge>;
  };

  // =========================================================================
  // VISTA PARA ROL DE ALUMNO (Tarjetas de espacios de trabajo + Integrantes + Cupos)
  // =========================================================================
  if (isStudent) {
    const commissionName = projects[0]?.section_name || '3K1';
    const academicYear = projects[0]?.year || 2025;

    return (
      <div className="space-y-6">
        <PageHeader
          title="Equipos de trabajo"
          subtitle={`Comisión ${commissionName} · Ciclo lectivo ${academicYear}`}
        />

        {/* Banner de estado del alumno */}
        {myCurrentProject ? (
          <div className="p-4 rounded-xl bg-[#EFF6FF] border border-[#BAE6FD] text-[#0B2A66] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#DCFCE7] text-[#15803D] shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">
                    Perteneces al Equipo {myCurrentProject.group_number}
                  </p>
                  {(myCurrentProject.members?.length || 0) >= (myCurrentProject.min_members || 3) ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-[#DCFCE7] text-[#15803D] px-2 py-0.5 rounded-full border border-[#86EFAC]">
                      <ShieldCheck className="w-3 h-3" />
                      Grupo asegurado
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-[#FEF3C7] text-[#B45309] px-2 py-0.5 rounded-full border border-[#FDE68A]">
                      <AlertCircle className="w-3 h-3" />
                      Falta(n) {(myCurrentProject.min_members || 3) - (myCurrentProject.members?.length || 0)} para asegurar
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#51607A] mt-0.5">
                  {myCurrentProject.name || 'Sin nombre asignado todavía'} · {myCurrentProject.members?.length || 1} de {myCurrentProject.max_members || 5} integrantes (Mínimo: {myCurrentProject.min_members || 3})
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/equipos/${myCurrentProject.id_project}`)}
              >
                <Eye className="w-3.5 h-3.5 mr-1" />
                Ver mi equipo
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-[#B91C1C] hover:bg-[#FEE2E2]"
                onClick={() => setLeavingProject(myCurrentProject)}
              >
                <UserMinus className="w-3.5 h-3.5 mr-1" />
                Salir del equipo
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-[#EFF6FF] border border-[#BAE6FD] text-[#0B2A66] flex items-center gap-3 shadow-2xs">
            <div className="p-2 rounded-lg bg-[#E0F2FE] text-[#1D4ED8] shrink-0">
              <Info className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">
                Aún no te has sumado a ningún equipo de trabajo
              </p>
              <p className="text-xs text-[#51607A]">
                Revisa los equipos de tu comisión disponibles a continuación y pulsa «Unirme al equipo» para incorporarte a un grupo.
              </p>
            </div>
          </div>
        )}

        {/* Cuadrícula de tarjetas de equipos de trabajo */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div
                key={idx}
                className="h-64 rounded-xl bg-white border border-[#D6E4F7] animate-pulse p-6"
              />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <EmptyState message="No hay equipos de trabajo registrados en tu comisión." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((proj) => {
              const isMyTeam = (proj.members || []).some(
                (m) => m.id_student === user?.id_user
              );
              const membersCount = proj.members?.length || 0;
              const minLimit = proj.min_members || 3;
              const maxLimit = proj.max_members || 5;
              const isSecured = membersCount >= minLimit;
              const isFull = membersCount >= maxLimit;

              return (
                <div
                  key={proj.id_project}
                  className={`bg-white border rounded-xl shadow-2xs flex flex-col justify-between transition-all duration-150 ${
                    isMyTeam
                      ? 'border-[#1D4ED8] ring-2 ring-[#BAE6FD]'
                      : 'border-[#D6E4F7] hover:border-[#1D4ED8]/60 hover:shadow-xs'
                  }`}
                >
                  <div className="p-6">
                    {/* Encabezado de la tarjeta */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-serif font-semibold text-lg text-[#0B2A66]">
                          Equipo {proj.group_number}
                        </span>
                        {isMyTeam && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-[#DCFCE7] text-[#15803D] px-2 py-0.5 rounded-full border border-[#86EFAC]">
                            <CheckCircle2 className="w-3 h-3" />
                            Mi equipo
                          </span>
                        )}
                      </div>
                      {renderPrivacyBadge(proj.privacy)}
                    </div>

                    {/* Nombre del proyecto */}
                    <div className="mb-3">
                      {proj.name ? (
                        <p className="text-sm font-semibold text-[#0F1F3D] line-clamp-2">
                          {proj.name}
                        </p>
                      ) : (
                        <p className="text-xs text-[#94A3B8] italic">
                          Sin nombre de proyecto aún
                        </p>
                      )}
                    </div>

                    {/* Estado de aseguramiento y cupo */}
                    <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
                      {isSecured ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-[#15803D] bg-[#DCFCE7] px-2 py-0.5 rounded-md border border-[#86EFAC]">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Grupo asegurado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-medium text-[#B45309] bg-[#FEF3C7] px-2 py-0.5 rounded-md border border-[#FDE68A]">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Faltan {minLimit - membersCount} para asegurar
                        </span>
                      )}

                      {isFull && (
                        <span className="font-semibold text-[#B91C1C] bg-[#FEE2E2] px-2 py-0.5 rounded-md border border-[#FCA5A5]">
                          Cupo completo
                        </span>
                      )}
                    </div>

                    {/* Sección de integrantes */}
                    <div className="border-t border-[#D6E4F7]/60 pt-3">
                      <div className="flex items-center justify-between text-xs font-semibold text-[#51607A] uppercase tracking-wider mb-2.5">
                        <div className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-[#1D4ED8]" />
                          <span>Integrantes</span>
                        </div>
                        <span className="font-mono text-[#0F1F3D]">
                          {membersCount} / {maxLimit} (mín. {minLimit})
                        </span>
                      </div>

                      {membersCount === 0 ? (
                        <p className="text-xs text-[#94A3B8] italic py-2">
                          Sin integrantes todavía
                        </p>
                      ) : (
                        <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                          {proj.members?.map((m) => {
                            const isMe = m.id_student === user?.id_user;
                            return (
                              <div
                                key={m.id_student}
                                className={`flex items-center justify-between text-xs p-1.5 rounded-lg ${
                                  isMe ? 'bg-[#EFF6FF]' : 'hover:bg-[#F5F9FF]'
                                }`}
                              >
                                <div className="flex items-center gap-2 truncate">
                                  <InitialsAvatar
                                    name={`${m.last_name} ${m.first_name}`}
                                    size="sm"
                                  />
                                  <span className={`truncate font-medium ${isMe ? 'text-[#1D4ED8]' : 'text-[#0F1F3D]'}`}>
                                    {m.last_name}, {m.first_name} {isMe && '(Tú)'}
                                  </span>
                                </div>
                                <span className="font-mono text-[#51607A] text-[11px] shrink-0 ml-1">
                                  Leg. {m.legajo}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Pie con acciones */}
                  <div className="p-4 bg-[#F5F9FF]/60 border-t border-[#D6E4F7] flex items-center justify-between gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/equipos/${proj.id_project}`)}
                    >
                      <Eye className="w-3.5 h-3.5 mr-1" />
                      Detalle
                    </Button>

                    {isMyTeam ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-[#B91C1C] hover:bg-[#FEE2E2]"
                        onClick={() => setLeavingProject(proj)}
                      >
                        <UserMinus className="w-3.5 h-3.5 mr-1" />
                        Salir del equipo
                      </Button>
                    ) : isFull ? (
                      <span className="text-xs font-medium text-[#51607A] px-2 py-1 bg-[#F1F5F9] rounded-md border border-[#D6E4F7]">
                        Cupo completo
                      </span>
                    ) : (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => setJoiningProject(proj)}
                      >
                        <UserPlus className="w-3.5 h-3.5 mr-1" />
                        Unirme al equipo
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal de confirmación para UNIRSE a un equipo */}
        <Modal
          isOpen={Boolean(joiningProject)}
          onClose={() => setJoiningProject(null)}
          title={`Unirme al Equipo ${joiningProject?.group_number}`}
        >
          <div className="space-y-4">
            {myCurrentProject ? (
              <p className="text-sm text-[#0F1F3D]">
                Actualmente perteneces al <span className="font-semibold">Equipo {myCurrentProject.group_number}</span>.
                Al unirte al <span className="font-semibold">Equipo {joiningProject?.group_number}</span>, serás reasignado automáticamente a este nuevo grupo. ¿Deseas continuar?
              </p>
            ) : (
              <p className="text-sm text-[#0F1F3D]">
                ¿Deseas sumarte al <span className="font-semibold">Equipo {joiningProject?.group_number}</span> de la Comisión {commissionName}?
              </p>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-[#D6E4F7]">
              <Button
                variant="outline"
                onClick={() => setJoiningProject(null)}
                disabled={isActionLoading}
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmJoin}
                isLoading={isActionLoading}
              >
                Confirmar e ingresar
              </Button>
            </div>
          </div>
        </Modal>

        {/* Modal de confirmación para SALIR de un equipo */}
        <Modal
          isOpen={Boolean(leavingProject)}
          onClose={() => setLeavingProject(null)}
          title={`Salir del Equipo ${leavingProject?.group_number}`}
        >
          <div className="space-y-4">
            <p className="text-sm text-[#0F1F3D]">
              ¿Estás seguro de que deseas salir del <span className="font-semibold">Equipo {leavingProject?.group_number}</span>? Tu lugar quedará disponible para otros compañeros.
            </p>

            <div className="flex justify-end gap-3 pt-4 border-t border-[#D6E4F7]">
              <Button
                variant="outline"
                onClick={() => setLeavingProject(null)}
                disabled={isActionLoading}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmLeave}
                isLoading={isActionLoading}
              >
                Salir del equipo
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    );
  }

  // =========================================================================
  // VISTA PARA ROL DE PROFESOR Y SUPER ADMINISTRADOR (Tabla administrativa)
  // =========================================================================
  return (
    <div className="space-y-6">
      <PageHeader
        title="Equipos de trabajo"
        action={
          canCreate ? (
            <Button variant="primary" onClick={handleOpenCreate}>
              <Plus className="w-4 h-4 mr-1.5" />
              Crear equipos de trabajo
            </Button>
          ) : null
        }
      />

      {/* Barra de herramientas: Filtros */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <Select
            value={filterSY}
            onChange={(e) => {
              setFilterSY(e.target.value);
              setOffset(0);
            }}
          >
            <option value="">Todos los cursos lectivos</option>
            {sectionYears.map((sy) => (
              <option key={sy.id_section_year} value={sy.id_section_year}>
                {sy.section_name} - {sy.year}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Select
            value={filterYear}
            onChange={(e) => {
              setFilterYear(e.target.value);
              setOffset(0);
            }}
          >
            <option value="">Todos los años</option>
            <option value="2025">2025</option>
            <option value="2024">2024</option>
            <option value="2023">2023</option>
          </Select>
        </div>

        <div>
          <Select
            value={filterSection}
            onChange={(e) => {
              setFilterSection(e.target.value);
              setOffset(0);
            }}
          >
            <option value="">Todas las comisiones</option>
            {sections.map((s) => (
              <option key={s.id_section} value={s.id_section}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Select
            value={filterPrivacy}
            onChange={(e) => {
              setFilterPrivacy(e.target.value as any);
              setOffset(0);
            }}
          >
            <option value="">Todas las privacidades</option>
            <option value="public">Público</option>
            <option value="protected">Protegido</option>
            <option value="private">Privado</option>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton rows={4} cols={7} />
      ) : projects.length === 0 ? (
        <EmptyState message="No se encontraron equipos de trabajo para los criterios seleccionados." />
      ) : (
        <>
          <Table>
            <TableHeader>
              <tr>
                <TableHead>Equipo</TableHead>
                <TableHead>Comisión</TableHead>
                <TableHead>Año</TableHead>
                <TableHead>Nombre del proyecto</TableHead>
                <TableHead>Cupo / Integrantes</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Privacidad</TableHead>
                <TableHead className="w-20 text-right">Acciones</TableHead>
              </tr>
            </TableHeader>
            <tbody>
              {projects.map((proj) => {
                const membersCount = proj.members?.length || 0;
                const minLimit = proj.min_members || 3;
                const maxLimit = proj.max_members || 5;
                const isSecured = membersCount >= minLimit;

                return (
                  <TableRow
                    key={proj.id_project}
                    onClick={() => navigate(`/equipos/${proj.id_project}`)}
                  >
                    <TableCell className="font-semibold text-[#0B2A66]">
                      Equipo {proj.group_number}
                    </TableCell>
                    <TableCell className="font-medium text-[#0F1F3D]">
                      {proj.section_name}
                    </TableCell>
                    <TableCell className="font-mono text-[#51607A]">
                      {proj.year}
                    </TableCell>
                    <TableCell>
                      {proj.name ? (
                        <span className="font-medium text-[#0F1F3D]">
                          {proj.name}
                        </span>
                      ) : (
                        <span className="text-[#94A3B8] italic">
                          Sin nombre
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-[#51607A]">
                      <span className="font-semibold text-[#0F1F3D]">{membersCount}</span> / {maxLimit} (mín. {minLimit})
                    </TableCell>
                    <TableCell>
                      {isSecured ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#15803D] bg-[#DCFCE7] px-2 py-0.5 rounded-md border border-[#86EFAC]">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Asegurado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-[#B45309] bg-[#FEF3C7] px-2 py-0.5 rounded-md border border-[#FDE68A]">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Pendiente
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{renderPrivacyBadge(proj.privacy)}</TableCell>
                    <TableCell
                      className="text-right relative"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setOpenMenuId(
                            openMenuId === proj.id_project ? null : proj.id_project
                          )
                        }
                        className="p-1 rounded text-[#51607A] hover:text-[#0F1F3D] hover:bg-[#EFF6FF] cursor-pointer"
                        aria-label="Opciones del equipo"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {openMenuId === proj.id_project && (
                        <div className="absolute right-4 top-10 w-36 bg-white border border-[#D6E4F7] rounded-lg shadow-lg py-1 z-20 text-left">
                          <button
                            type="button"
                            onClick={() => navigate(`/equipos/${proj.id_project}`)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#0F1F3D] hover:bg-[#EFF6FF] cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 text-[#1D4ED8]" />
                            <span>Ver detalle</span>
                          </button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </tbody>
          </Table>

          <Pagination
            total={total}
            limit={10}
            offset={offset}
            onChangeOffset={setOffset}
          />
        </>
      )}

      {/* Diálogo Crear Equipos de Trabajo (Administrativo) */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Crear equipos de trabajo"
        maxWidth="lg"
      >
        {modalError && (
          <div
            role="alert"
            className="mb-4 p-3 rounded-lg bg-[#FEE2E2] border border-[#FCA5A5] text-[#B91C1C] text-sm flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{modalError}</span>
          </div>
        )}

        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <div>
            <Select
              label="Curso lectivo"
              requiredAsterisk
              value={createCourseId}
              onChange={(e) => setCreateCourseId(Number(e.target.value))}
              disabled={isCreating}
              required
            >
              <option value="" disabled>Seleccione un curso lectivo</option>
              {availableCoursesForCreate.map((sy) => (
                <option key={sy.id_section_year} value={sy.id_section_year}>
                  {sy.section_name} ({sy.year})
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Input
              label="Cantidad de equipos a crear"
              requiredAsterisk
              type="number"
              min={1}
              max={50}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              disabled={isCreating}
              helperText="De 1 a 50 equipos consecutivos"
              required
            />
          </div>

          {quantity === 1 && (
            <div>
              <Input
                label="Número de equipo"
                type="number"
                min={1}
                placeholder="Automático (siguiente disponible)"
                value={groupNumber}
                onChange={(e) => setGroupNumber(e.target.value ? Number(e.target.value) : '')}
                disabled={isCreating}
                helperText="Si no lo indica, se asigna el siguiente libre"
              />
            </div>
          )}

          {/* Configuración de cupo mínimo y máximo para asegurar el grupo */}
          <div className="p-4 rounded-xl bg-[#EFF6FF]/60 border border-[#BAE6FD] space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#0B2A66] uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4 text-[#1D4ED8]" />
              <span>Reglas de cupo y aseguramiento</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Input
                  label="Cantidad mínima de estudiantes"
                  requiredAsterisk
                  type="number"
                  min={1}
                  value={minMembers}
                  onChange={(e) => setMinMembers(Number(e.target.value))}
                  disabled={isCreating}
                  helperText="Mínimo para considerar el grupo asegurado"
                  required
                />
              </div>

              <div>
                <Input
                  label="Cantidad máxima de estudiantes"
                  requiredAsterisk
                  type="number"
                  min={1}
                  value={maxMembers}
                  onChange={(e) => setMaxMembers(Number(e.target.value))}
                  disabled={isCreating}
                  helperText="Capacidad máxima admisible por equipo"
                  required
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-[#D6E4F7]">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCreateModalOpen(false)}
              disabled={isCreating}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isCreating}
            >
              Crear equipos
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
