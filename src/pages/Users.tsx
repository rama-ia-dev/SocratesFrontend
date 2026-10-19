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
  Edit2,
  AlertCircle,
  UserCheck,
  GraduationCap,
} from 'lucide-react';
import {
  useField,
  validateName,
  validateProfessorEmail,
  validateLegajo,
  validateBirthDate,
  validateEnrollmentYear,
  maxBirthDate,
  minBirthDate,
  digitsOnly,
  professorSaveError,
} from '../lib/validation';

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

  // ==========================================
  // Diálogo Alta Docente
  // ==========================================
  const [isProfCreateModalOpen, setIsProfCreateModalOpen] = useState(false);
  const profCreateFirstName = useField('', validateName('nombre'));
  const profCreateLastName = useField('', validateName('apellido'));
  const profCreateEmail = useField('', validateProfessorEmail);
  const profCreateLegajo = useField('', validateLegajo);
  const profCreateBirthDate = useField('', (v) => validateBirthDate(v), { validateOnChange: true });
  const [profCreateIsSuperAdmin, setProfCreateIsSuperAdmin] = useState(false);
  const [profCreateError, setProfCreateError] = useState<string | null>(null);
  const [isSavingProfCreate, setIsSavingProfCreate] = useState(false);

  // ==========================================
  // Diálogo Modificar Docente
  // ==========================================
  const [isProfEditModalOpen, setIsProfEditModalOpen] = useState(false);
  const [editingProf, setEditingProf] = useState<UserListItem | null>(null);
  const profEditFirstName = useField('', validateName('nombre'));
  const profEditLastName = useField('', validateName('apellido'));
  const profEditEmail = useField('', validateProfessorEmail);
  const profEditLegajo = useField('', validateLegajo);
  const profEditBirthDate = useField('', (v) => validateBirthDate(v), { validateOnChange: true });
  const [profEditIsSuperAdmin, setProfEditIsSuperAdmin] = useState(false);
  const [profEditError, setProfEditError] = useState<string | null>(null);
  const [isSavingProfEdit, setIsSavingProfEdit] = useState(false);

  // ==========================================
  // Diálogo Modificar Alumno
  // ==========================================
  const [isStudentEditModalOpen, setIsStudentEditModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<UserListItem | null>(null);
  const studentEditFirstName = useField('', validateName('nombre'));
  const studentEditLastName = useField('', validateName('apellido'));
  const studentEditLegajo = useField('', validateLegajo);
  const studentEditBirthDate = useField('', (v) => validateBirthDate(v), { validateOnChange: true });
  // El año de ingreso se valida contra la fecha de nacimiento.
  const studentEditEnrollmentYear = useField('', (v) => validateEnrollmentYear(v, studentEditBirthDate.value));
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
    profCreateFirstName.reset('');
    profCreateLastName.reset('');
    profCreateEmail.reset('');
    profCreateLegajo.reset('');
    profCreateBirthDate.reset('');
    setProfCreateIsSuperAdmin(false);
    setProfCreateError(null);
    setIsProfCreateModalOpen(true);
  };

  const handleSaveProfCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfCreateError(null);

    // Se revisan todos (no se corta en el primero) para marcar cada campo con error a la vez
    const checks = [profCreateFirstName, profCreateLastName, profCreateEmail, profCreateLegajo, profCreateBirthDate].map((f) => f.check());
    if (checks.includes(false)) return;

    setIsSavingProfCreate(true);
    try {
      await api.createProfessor({
        first_name: profCreateFirstName.value.trim(),
        last_name: profCreateLastName.value.trim(),
        mail: profCreateEmail.value.trim().toLowerCase(),
        legajo: Number(profCreateLegajo.value),
        birth_date: profCreateBirthDate.value,
        is_super_admin: profCreateIsSuperAdmin,
      });
      success('Docente registrado. Recibirá un correo para crear su contraseña');
      setIsProfCreateModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      setProfCreateError(professorSaveError(err, 'Error al guardar docente'));
    } finally {
      setIsSavingProfCreate(false);
    }
  };

  // ==========================================
  // Handlers Modificar Docente
  // ==========================================
  const handleOpenEditProf = (u: UserListItem) => {
    setEditingProf(u);
    profEditFirstName.reset(u.first_name);
    profEditLastName.reset(u.last_name);
    profEditEmail.reset(u.email);
    profEditLegajo.reset(String(u.legajo));
    profEditBirthDate.reset(u.birth_date || '');
    setProfEditIsSuperAdmin(Boolean(u.is_super_admin));
    setProfEditError(null);
    setIsProfEditModalOpen(true);
  };

  const handleSaveProfEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProf) return;
    setProfEditError(null);

    const checks = [profEditFirstName, profEditLastName, profEditEmail, profEditLegajo, profEditBirthDate].map((f) => f.check());
    if (checks.includes(false)) return;

    if (
      currentUser &&
      editingProf.id_user === currentUser.id_user &&
      !profEditIsSuperAdmin &&
      currentUser.is_super_admin
    ) {
      setProfEditError('No puede quitarse a sí mismo el rol de super administrador');
      return;
    }

    // PATCH: solo lo que cambió. Cambiar el mail cierra las sesiones del docente, así que
    // no se reenvía si quedó igual. Sin cambios no se llama al backend (rechaza el body vacío).
    const mailLower = profEditEmail.value.trim().toLowerCase();
    const changes = {
      ...(profEditFirstName.value.trim() !== editingProf.first_name && { first_name: profEditFirstName.value.trim() }),
      ...(profEditLastName.value.trim() !== editingProf.last_name && { last_name: profEditLastName.value.trim() }),
      ...(mailLower !== editingProf.email.toLowerCase() && { mail: mailLower }),
      ...(Number(profEditLegajo.value) !== editingProf.legajo && { legajo: Number(profEditLegajo.value) }),
      ...(profEditBirthDate.value !== (editingProf.birth_date || '') && { birth_date: profEditBirthDate.value }),
      ...(profEditIsSuperAdmin !== Boolean(editingProf.is_super_admin) && { is_super_admin: profEditIsSuperAdmin }),
    };
    if (Object.keys(changes).length === 0) {
      setIsProfEditModalOpen(false);
      return;
    }

    setIsSavingProfEdit(true);
    try {
      await api.updateProfessor(editingProf.id_user, changes);
      success('Docente actualizado');
      setIsProfEditModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      setProfEditError(professorSaveError(err, 'Error al actualizar docente'));
    } finally {
      setIsSavingProfEdit(false);
    }
  };

  // ==========================================
  // Handlers Modificar Alumno
  // ==========================================
  const handleOpenEditStudent = (u: UserListItem) => {
    setEditingStudent(u);
    studentEditFirstName.reset(u.first_name);
    studentEditLastName.reset(u.last_name);
    studentEditLegajo.reset(String(u.legajo));
    studentEditEnrollmentYear.reset(u.enrollment_year ? String(u.enrollment_year) : '');
    studentEditBirthDate.reset(u.birth_date || '');
    setStudentEditError(null);
    setIsStudentEditModalOpen(true);
  };

  const handleSaveStudentEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    setStudentEditError(null);

    const checks = [
      studentEditLegajo,
      studentEditFirstName,
      studentEditLastName,
      studentEditBirthDate,
      studentEditEnrollmentYear,
    ].map((f) => f.check());
    if (checks.includes(false)) return;

    const enrollmentYear = Number(studentEditEnrollmentYear.value);
    const changes = {
      ...(studentEditFirstName.value.trim() !== editingStudent.first_name && { first_name: studentEditFirstName.value.trim() }),
      ...(studentEditLastName.value.trim() !== editingStudent.last_name && { last_name: studentEditLastName.value.trim() }),
      ...(Number(studentEditLegajo.value) !== editingStudent.legajo && { legajo: Number(studentEditLegajo.value) }),
      ...(enrollmentYear !== editingStudent.enrollment_year && { enrollment_year: enrollmentYear }),
      ...(studentEditBirthDate.value !== (editingStudent.birth_date || '') && { birth_date: studentEditBirthDate.value }),
    };
    if (Object.keys(changes).length === 0) {
      setIsStudentEditModalOpen(false);
      return;
    }

    setIsSavingStudentEdit(true);
    try {
      await api.updateStudent(editingStudent.id_user, changes);
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
    editingProf && profEditEmail.value.trim().toLowerCase() !== editingProf.email.toLowerCase();
  const studentLegajoChanged =
    editingStudent && studentEditLegajo.value !== '' && studentEditLegajo.value !== String(editingStudent.legajo);

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
                {/* Fija a la derecha: con la tabla más ancha que la pantalla, las acciones siguen a la vista */}
                <TableHead className="w-20 text-right sticky right-0 bg-[#EFF6FF]">Acciones</TableHead>
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
                  <TableCell className="text-right sticky right-0 bg-white border-b border-[#D6E4F7]">
                    <button
                      type="button"
                      onClick={() =>
                        u.role === 'professor' ? handleOpenEditProf(u) : handleOpenEditStudent(u)
                      }
                      className="p-1.5 rounded text-[#1D4ED8] hover:bg-[#EFF6FF] cursor-pointer"
                      aria-label={`Modificar a ${u.first_name} ${u.last_name}`}
                      title="Modificar"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
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

        <form onSubmit={handleSaveProfCreate} className="space-y-4" noValidate>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Nombre"
              {...profCreateFirstName.inputProps}
              disabled={isSavingProfCreate}
            />
            <Input
              label="Apellido"
              {...profCreateLastName.inputProps}
              disabled={isSavingProfCreate}
            />
          </div>

          <div>
            <Input
              label="Correo electrónico"
              type="email"
              {...profCreateEmail.inputProps}
              disabled={isSavingProfCreate}
              placeholder="docente@ejemplo.com"
            />
          </div>

          <div>
            <Input
              label="Legajo"
              inputMode="numeric"
              {...profCreateLegajo.inputProps}
              onChange={(e) => profCreateLegajo.setValue(digitsOnly(e.target.value))}
              disabled={isSavingProfCreate}
              placeholder="Ej. 10423"
            />
          </div>

          <div>
            <Input
              label="Fecha de nacimiento"
              type="date"
              min={minBirthDate()}
              max={maxBirthDate()}
              {...profCreateBirthDate.inputProps}
              disabled={isSavingProfCreate}
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

        <form onSubmit={handleSaveProfEdit} className="space-y-4" noValidate>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Nombre"
              {...profEditFirstName.inputProps}
              disabled={isSavingProfEdit}
            />
            <Input
              label="Apellido"
              {...profEditLastName.inputProps}
              disabled={isSavingProfEdit}
            />
          </div>

          <div>
            <Input
              label="Correo electrónico"
              type="email"
              {...profEditEmail.inputProps}
              disabled={isSavingProfEdit}
            />
          </div>

          <div>
            <Input
              label="Legajo"
              inputMode="numeric"
              {...profEditLegajo.inputProps}
              onChange={(e) => profEditLegajo.setValue(digitsOnly(e.target.value))}
              disabled={isSavingProfEdit}
            />
          </div>

          <div>
            <Input
              label="Fecha de nacimiento"
              type="date"
              min={minBirthDate()}
              max={maxBirthDate()}
              {...profEditBirthDate.inputProps}
              disabled={isSavingProfEdit}
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
              {studentEditLegajo.value}@sistemas.frc.utn.edu.ar
            </span>
          </div>
        )}

        <form onSubmit={handleSaveStudentEdit} className="space-y-4" noValidate>
          <div>
            <Input
              label="Legajo"
              inputMode="numeric"
              {...studentEditLegajo.inputProps}
              onChange={(e) => studentEditLegajo.setValue(digitsOnly(e.target.value))}
              disabled={isSavingStudentEdit}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Nombre"
              {...studentEditFirstName.inputProps}
              disabled={isSavingStudentEdit}
            />
            <Input
              label="Apellido"
              {...studentEditLastName.inputProps}
              disabled={isSavingStudentEdit}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Fecha de nacimiento"
              type="date"
              min={minBirthDate()}
              max={maxBirthDate()}
              {...studentEditBirthDate.inputProps}
              disabled={isSavingStudentEdit}
            />
            <Input
              label="Año de ingreso"
              inputMode="numeric"
              maxLength={4}
              {...studentEditEnrollmentYear.inputProps}
              onChange={(e) => studentEditEnrollmentYear.setValue(digitsOnly(e.target.value))}
              disabled={isSavingStudentEdit}
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
