import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { UserListItem } from '../types/api';
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
  Search,
  Plus,
  MoreVertical,
  Edit2,
  AlertCircle,
  UserCheck,
  GraduationCap,
} from 'lucide-react';

export const Users: React.FC = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { success, error: toastError } = useToast();

  const [users, setUsers] = useState<UserListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'student' | 'professor' | ''>('');
  const [isLoading, setIsLoading] = useState(true);

  // Menú contextual abierto
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  // ==========================================
  // Diálogo Alta Docente
  // ==========================================
  const [isProfCreateModalOpen, setIsProfCreateModalOpen] = useState(false);
  const [profCreateFirstName, setProfCreateFirstName] = useState('');
  const [profCreateLastName, setProfCreateLastName] = useState('');
  const [profCreateEmail, setProfCreateEmail] = useState('');
  const [profCreateLegajo, setProfCreateLegajo] = useState<number | ''>('');
  const [profCreateIsSuperAdmin, setProfCreateIsSuperAdmin] = useState(false);
  const [profCreateError, setProfCreateError] = useState<string | null>(null);
  const [isSavingProfCreate, setIsSavingProfCreate] = useState(false);

  // ==========================================
  // Diálogo Modificar Docente
  // ==========================================
  const [isProfEditModalOpen, setIsProfEditModalOpen] = useState(false);
  const [editingProf, setEditingProf] = useState<UserListItem | null>(null);
  const [profEditFirstName, setProfEditFirstName] = useState('');
  const [profEditLastName, setProfEditLastName] = useState('');
  const [profEditEmail, setProfEditEmail] = useState('');
  const [profEditOriginalEmail, setProfEditOriginalEmail] = useState('');
  const [profEditLegajo, setProfEditLegajo] = useState<number | ''>('');
  const [profEditIsSuperAdmin, setProfEditIsSuperAdmin] = useState(false);
  const [profEditError, setProfEditError] = useState<string | null>(null);
  const [isSavingProfEdit, setIsSavingProfEdit] = useState(false);

  // ==========================================
  // Diálogo Modificar Alumno
  // ==========================================
  const [isStudentEditModalOpen, setIsStudentEditModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<UserListItem | null>(null);
  const [studentEditFirstName, setStudentEditFirstName] = useState('');
  const [studentEditLastName, setStudentEditLastName] = useState('');
  const [studentEditLegajo, setStudentEditLegajo] = useState<number | ''>('');
  const [studentEditOriginalLegajo, setStudentEditOriginalLegajo] = useState<number | ''>('');
  const [studentEditBirthDate, setStudentEditBirthDate] = useState('2002-01-01');
  const [studentEditEnrollmentYear, setStudentEditEnrollmentYear] = useState<number>(2022);
  const [studentEditError, setStudentEditError] = useState<string | null>(null);
  const [isSavingStudentEdit, setIsSavingStudentEdit] = useState(false);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.getUsers({
        role: roleFilter ? roleFilter : null,
        q: searchQuery || null,
        limit: 10,
        offset,
      });
      setUsers(res.items);
      setTotal(res.total);
    } catch {
      toastError('Error al consultar usuarios');
    } finally {
      setIsLoading(false);
    }
  }, [roleFilter, searchQuery, offset, toastError]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // ==========================================
  // Handlers Alta Docente
  // ==========================================
  const handleOpenCreateProf = () => {
    setProfCreateFirstName('');
    setProfCreateLastName('');
    setProfCreateEmail('');
    setProfCreateLegajo('');
    setProfCreateIsSuperAdmin(false);
    setProfCreateError(null);
    setIsProfCreateModalOpen(true);
  };

  const handleSaveProfCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfCreateError(null);

    if (!profCreateFirstName.trim() || !profCreateLastName.trim()) {
      setProfCreateError('Ingrese nombre y apellido');
      return;
    }

    const mailLower = profCreateEmail.trim().toLowerCase();
    if (!mailLower) {
      setProfCreateError('Ingrese un correo electrónico');
      return;
    }

    if (mailLower.endsWith('@sistemas.frc.utn.edu.ar')) {
      setProfCreateError('No puede usar el dominio de los alumnos');
      return;
    }

    if (!profCreateLegajo || profCreateLegajo <= 0) {
      setProfCreateError('El legajo debe ser un número positivo');
      return;
    }

    setIsSavingProfCreate(true);
    try {
      await api.createProfessor({
        first_name: profCreateFirstName.trim(),
        last_name: profCreateLastName.trim(),
        mail: mailLower,
        legajo: Number(profCreateLegajo),
        birth_date: '1980-01-01',
        is_super_admin: profCreateIsSuperAdmin,
      });
      success('Docente registrado. Recibirá un correo para crear su contraseña');
      setIsProfCreateModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      if (err.status === 409 || err.message?.includes('existe')) {
        setProfCreateError('Ya existe un docente con ese correo');
      } else if (err.status === 422 || err.message?.includes('dominio')) {
        setProfCreateError('No puede usar el dominio de los alumnos');
      } else {
        setProfCreateError(err.message || 'Error al guardar docente');
      }
    } finally {
      setIsSavingProfCreate(false);
    }
  };

  // ==========================================
  // Handlers Modificar Docente
  // ==========================================
  const handleOpenEditProf = (u: UserListItem) => {
    setEditingProf(u);
    setProfEditFirstName(u.first_name);
    setProfEditLastName(u.last_name);
    setProfEditEmail(u.email);
    setProfEditOriginalEmail(u.email);
    setProfEditLegajo(u.legajo);
    setProfEditIsSuperAdmin(Boolean(u.is_super_admin));
    setProfEditError(null);
    setOpenMenuId(null);
    setIsProfEditModalOpen(true);
  };

  const handleSaveProfEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProf) return;
    setProfEditError(null);

    if (!profEditFirstName.trim() || !profEditLastName.trim()) {
      setProfEditError('Ingrese nombre y apellido');
      return;
    }

    const mailLower = profEditEmail.trim().toLowerCase();
    if (!mailLower) {
      setProfEditError('Ingrese un correo electrónico');
      return;
    }

    if (mailLower.endsWith('@sistemas.frc.utn.edu.ar')) {
      setProfEditError('No puede usar el dominio de los alumnos');
      return;
    }

    if (!profEditLegajo || profEditLegajo <= 0) {
      setProfEditError('El legajo debe ser un número positivo');
      return;
    }

    if (
      currentUser &&
      editingProf.id_user === currentUser.id_user &&
      !profEditIsSuperAdmin &&
      currentUser.is_super_admin
    ) {
      setProfEditError('No puede quitarse a sí mismo el rol de super administrador');
      return;
    }

    setIsSavingProfEdit(true);
    try {
      await api.updateProfessor(editingProf.id_user, {
        first_name: profEditFirstName.trim(),
        last_name: profEditLastName.trim(),
        mail: mailLower,
        legajo: Number(profEditLegajo),
        is_super_admin: profEditIsSuperAdmin,
      });
      success('Docente actualizado');
      setIsProfEditModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      if (err.status === 409 || err.message?.includes('existe')) {
        setProfEditError('Ya existe un docente con ese correo');
      } else if (err.status === 422 || err.message?.includes('dominio')) {
        setProfEditError('No puede usar el dominio de los alumnos');
      } else {
        setProfEditError(err.message || 'Error al actualizar docente');
      }
    } finally {
      setIsSavingProfEdit(false);
    }
  };

  // ==========================================
  // Handlers Modificar Alumno
  // ==========================================
  const handleOpenEditStudent = (u: UserListItem) => {
    setEditingStudent(u);
    setStudentEditFirstName(u.first_name);
    setStudentEditLastName(u.last_name);
    setStudentEditLegajo(u.legajo);
    setStudentEditOriginalLegajo(u.legajo);
    setStudentEditEnrollmentYear(u.enrollment_year || 2022);
    setStudentEditBirthDate('2002-05-15');
    setStudentEditError(null);
    setOpenMenuId(null);
    setIsStudentEditModalOpen(true);
  };

  const handleSaveStudentEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    setStudentEditError(null);

    if (!studentEditLegajo || studentEditLegajo <= 0) {
      setStudentEditError('El legajo debe ser un número positivo');
      return;
    }
    if (!studentEditFirstName.trim() || !studentEditLastName.trim()) {
      setStudentEditError('Ingrese nombre y apellido');
      return;
    }

    setIsSavingStudentEdit(true);
    try {
      await api.updateStudent(editingStudent.id_user, {
        first_name: studentEditFirstName.trim(),
        last_name: studentEditLastName.trim(),
        legajo: Number(studentEditLegajo),
        enrollment_year: studentEditEnrollmentYear,
        birth_date: studentEditBirthDate,
      });
      success('Datos del estudiante actualizados');
      setIsStudentEditModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      if (err.status === 409 || err.message?.includes('existe')) {
        setStudentEditError('Ya existe un alumno con ese legajo');
      } else {
        setStudentEditError(err.message || 'Error al actualizar estudiante');
      }
    } finally {
      setIsSavingStudentEdit(false);
    }
  };

  const isEditingSelf = Boolean(
    editingProf && currentUser && editingProf.id_user === currentUser.id_user
  );
  const profEmailChanged =
    editingProf && profEditEmail.trim().toLowerCase() !== profEditOriginalEmail.toLowerCase();
  const studentLegajoChanged =
    studentEditLegajo !== studentEditOriginalLegajo && studentEditLegajo !== '';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuarios"
        subtitle="Gestión unificada de docentes y estudiantes"
        action={
          <div className="flex items-center gap-2">
            {roleFilter === 'professor' ? (
              <Button variant="primary" onClick={handleOpenCreateProf}>
                <Plus className="w-4 h-4 mr-1.5" />
                Registrar docente
              </Button>
            ) : roleFilter === 'student' ? (
              <Button
                variant="primary"
                onClick={() => navigate('/estudiantes/nuevo')}
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Registrar estudiantes
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => navigate('/estudiantes/nuevo')}
                >
                  <GraduationCap className="w-4 h-4 mr-1.5 text-[#1D4ED8]" />
                  Registrar estudiantes
                </Button>
                <Button variant="primary" onClick={handleOpenCreateProf}>
                  <UserCheck className="w-4 h-4 mr-1.5" />
                  Registrar docente
                </Button>
              </div>
            )}
          </div>
        }
      />

      {/* Barra de herramientas: Buscador y Filtro Rol */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl">
        <div className="sm:col-span-2">
          <Input
            type="text"
            placeholder="Buscar por nombre, legajo o correo"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setOffset(0);
            }}
            leftIcon={<Search className="w-4 h-4" />}
          />
        </div>
        <div>
          <Select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value as any);
              setOffset(0);
            }}
          >
            <option value="">Todos los roles</option>
            <option value="student">Alumnos</option>
            <option value="professor">Docentes</option>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton rows={4} cols={6} />
      ) : users.length === 0 ? (
        <EmptyState message="No se encontraron usuarios para los filtros seleccionados." />
      ) : (
        <>
          <Table>
            <TableHeader>
              <tr>
                <TableHead>Apellido y nombre</TableHead>
                <TableHead>Correo electrónico</TableHead>
                <TableHead>Legajo</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Año de ingreso</TableHead>
                <TableHead className="w-20 text-right">Acciones</TableHead>
              </tr>
            </TableHeader>
            <tbody>
              {users.map((u) => (
                <TableRow key={u.id_user}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <InitialsAvatar
                        name={`${u.last_name} ${u.first_name}`}
                        size="sm"
                      />
                      <span className="font-medium text-[#0F1F3D]">
                        {u.last_name}, {u.first_name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-[#51607A]">{u.email}</TableCell>
                  <TableCell className="font-mono text-[#51607A]">
                    {u.legajo}
                  </TableCell>
                  <TableCell>
                    {u.is_super_admin ? (
                      <Badge variant="superadmin">Super administrador</Badge>
                    ) : u.role === 'professor' ? (
                      <Badge variant="professor">Profesor</Badge>
                    ) : (
                      <Badge variant="student">Alumno</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-[#51607A]">
                    {u.role === 'student' ? u.enrollment_year || '—' : '—'}
                  </TableCell>
                  <TableCell className="text-right relative">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenMenuId(openMenuId === u.id_user ? null : u.id_user)
                      }
                      className="p-1 rounded text-[#51607A] hover:text-[#0F1F3D] hover:bg-[#EFF6FF] cursor-pointer"
                      aria-label="Abrir menú de opciones"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {openMenuId === u.id_user && (
                      <div className="absolute right-4 top-10 w-36 bg-white border border-[#D6E4F7] rounded-lg shadow-lg py-1 z-20 text-left">
                        <button
                          type="button"
                          onClick={() => {
                            if (u.role === 'professor') {
                              handleOpenEditProf(u);
                            } else {
                              handleOpenEditStudent(u);
                            }
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#0F1F3D] hover:bg-[#EFF6FF] cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-[#1D4ED8]" />
                          <span>Modificar</span>
                        </button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
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

      {/* ========================================================= */}
      {/* Diálogo Registrar Docente                                */}
      {/* ========================================================= */}
      <Modal
        isOpen={isProfCreateModalOpen}
        onClose={() => setIsProfCreateModalOpen(false)}
        title="Registrar docente"
      >
        {profCreateError && (
          <div
            role="alert"
            className="mb-4 p-3 rounded-lg bg-[#FEE2E2] border border-[#FCA5A5] text-[#B91C1C] text-sm flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{profCreateError}</span>
          </div>
        )}

        <form onSubmit={handleSaveProfCreate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Nombre"
              requiredAsterisk
              value={profCreateFirstName}
              onChange={(e) => setProfCreateFirstName(e.target.value)}
              disabled={isSavingProfCreate}
              required
            />
            <Input
              label="Apellido"
              requiredAsterisk
              value={profCreateLastName}
              onChange={(e) => setProfCreateLastName(e.target.value)}
              disabled={isSavingProfCreate}
              required
            />
          </div>

          <div>
            <Input
              label="Correo electrónico"
              requiredAsterisk
              type="email"
              value={profCreateEmail}
              onChange={(e) => setProfCreateEmail(e.target.value)}
              disabled={isSavingProfCreate}
              placeholder="docente@ejemplo.com"
              helperText="Se guarda en minúsculas. No puede usar el dominio de alumnos."
              required
            />
          </div>

          <div>
            <Input
              label="Legajo"
              requiredAsterisk
              type="number"
              min={1}
              value={profCreateLegajo}
              onChange={(e) => setProfCreateLegajo(Number(e.target.value))}
              disabled={isSavingProfCreate}
              placeholder="Ej. 10423"
              required
            />
          </div>

          <div className="pt-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={profCreateIsSuperAdmin}
                onChange={(e) => setProfCreateIsSuperAdmin(e.target.checked)}
                disabled={isSavingProfCreate}
                className="w-4 h-4 rounded border-[#D6E4F7] text-[#1D4ED8] focus:ring-[#BAE6FD]"
              />
              <span className="text-sm font-medium text-[#0F1F3D]">
                Super administrador
              </span>
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#D6E4F7]">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsProfCreateModalOpen(false)}
              disabled={isSavingProfCreate}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isSavingProfCreate}
            >
              Guardar
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================= */}
      {/* Diálogo Modificar Docente                                */}
      {/* ========================================================= */}
      <Modal
        isOpen={isProfEditModalOpen}
        onClose={() => setIsProfEditModalOpen(false)}
        title="Modificar docente"
      >
        {profEditError && (
          <div
            role="alert"
            className="mb-4 p-3 rounded-lg bg-[#FEE2E2] border border-[#FCA5A5] text-[#B91C1C] text-sm flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{profEditError}</span>
          </div>
        )}

        {profEmailChanged && (
          <div className="mb-4 p-3 rounded-lg bg-[#FEF3C7] border border-[#FDE68A] text-[#B45309] text-xs">
            Al cambiar el correo se cerrará la sesión del docente.
          </div>
        )}

        <form onSubmit={handleSaveProfEdit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Nombre"
              requiredAsterisk
              value={profEditFirstName}
              onChange={(e) => setProfEditFirstName(e.target.value)}
              disabled={isSavingProfEdit}
              required
            />
            <Input
              label="Apellido"
              requiredAsterisk
              value={profEditLastName}
              onChange={(e) => setProfEditLastName(e.target.value)}
              disabled={isSavingProfEdit}
              required
            />
          </div>

          <div>
            <Input
              label="Correo electrónico"
              requiredAsterisk
              type="email"
              value={profEditEmail}
              onChange={(e) => setProfEditEmail(e.target.value)}
              disabled={isSavingProfEdit}
              required
            />
          </div>

          <div>
            <Input
              label="Legajo"
              requiredAsterisk
              type="number"
              min={1}
              value={profEditLegajo}
              onChange={(e) => setProfEditLegajo(Number(e.target.value))}
              disabled={isSavingProfEdit}
              required
            />
          </div>

          <div className="pt-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={profEditIsSuperAdmin}
                onChange={(e) => setProfEditIsSuperAdmin(e.target.checked)}
                disabled={isEditingSelf || isSavingProfEdit}
                className="w-4 h-4 rounded border-[#D6E4F7] text-[#1D4ED8] focus:ring-[#BAE6FD]"
              />
              <span className="text-sm font-medium text-[#0F1F3D]">
                Super administrador
              </span>
            </label>
            {isEditingSelf && (
              <p className="text-xs text-[#B45309] mt-1 pl-7">
                No puede quitarse a sí mismo el rol de super administrador
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#D6E4F7]">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsProfEditModalOpen(false)}
              disabled={isSavingProfEdit}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isSavingProfEdit}
            >
              Guardar
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================= */}
      {/* Diálogo Modificar Alumno                                 */}
      {/* ========================================================= */}
      <Modal
        isOpen={isStudentEditModalOpen}
        onClose={() => setIsStudentEditModalOpen(false)}
        title="Modificar estudiante"
      >
        {studentEditError && (
          <div
            role="alert"
            className="mb-4 p-3 rounded-lg bg-[#FEE2E2] border border-[#FCA5A5] text-[#B91C1C] text-sm flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{studentEditError}</span>
          </div>
        )}

        {studentLegajoChanged && (
          <div className="mb-4 p-3 rounded-lg bg-[#EFF6FF] border border-[#BAE6FD] text-[#1D4ED8] text-xs">
            El correo de ingreso pasará a ser{' '}
            <span className="font-mono font-semibold">
              {studentEditLegajo}@sistemas.frc.utn.edu.ar
            </span>
          </div>
        )}

        <form onSubmit={handleSaveStudentEdit} className="space-y-4">
          <div>
            <Input
              label="Legajo"
              requiredAsterisk
              type="number"
              min={1}
              value={studentEditLegajo}
              onChange={(e) => setStudentEditLegajo(Number(e.target.value))}
              disabled={isSavingStudentEdit}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Nombre"
              requiredAsterisk
              value={studentEditFirstName}
              onChange={(e) => setStudentEditFirstName(e.target.value)}
              disabled={isSavingStudentEdit}
              required
            />
            <Input
              label="Apellido"
              requiredAsterisk
              value={studentEditLastName}
              onChange={(e) => setStudentEditLastName(e.target.value)}
              disabled={isSavingStudentEdit}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Fecha de nacimiento"
              requiredAsterisk
              type="date"
              value={studentEditBirthDate}
              onChange={(e) => setStudentEditBirthDate(e.target.value)}
              disabled={isSavingStudentEdit}
              required
            />
            <Input
              label="Año de ingreso"
              requiredAsterisk
              type="number"
              min={1950}
              max={2100}
              value={studentEditEnrollmentYear}
              onChange={(e) => setStudentEditEnrollmentYear(Number(e.target.value))}
              disabled={isSavingStudentEdit}
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#D6E4F7]">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsStudentEditModalOpen(false)}
              disabled={isSavingStudentEdit}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isSavingStudentEdit}
            >
              Guardar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
