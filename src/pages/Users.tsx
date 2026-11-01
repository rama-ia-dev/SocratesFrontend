import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { UserListItem } from '../types/api';
import { useAuth } from '../context/AuthContext';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { DateField } from '../components/ui/DateField';
import { SegmentedControl } from '../components/ui/SegmentedControl';
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
import { ActionMenu } from '../components/ui/ActionMenu';
import { EditStudentModal } from '../components/EditStudentModal';
import {
  Search,
  Plus,
  Edit2,
  AlertCircle,
  UserCheck,
  GraduationCap,
  SearchX,
} from 'lucide-react';
import {
  useField,
  validateName,
  validateProfessorEmail,
  validateLegajo,
  validateBirthDate,
  maxBirthDate,
  minBirthDate,
  digitsOnly,
  showProfessorSaveError,
} from '../lib/validation';
import { Alert } from '../components/ui/Alert';

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
  const [editingStudent, setEditingStudent] = useState<UserListItem | null>(null);

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
      showProfessorSaveError(
        err,
        'Error al guardar docente',
        { legajo: profCreateLegajo, mail: profCreateEmail },
        setProfCreateError
      );
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
      setProfEditError('No puede quitarse a sí mismo el rol de administrador');
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
      showProfessorSaveError(
        err,
        'Error al actualizar docente',
        { legajo: profEditLegajo, mail: profEditEmail },
        setProfEditError
      );
    } finally {
      setIsSavingProfEdit(false);
    }
  };

  // ==========================================
  // Handlers Modificar Alumno
  // ==========================================
  const handleOpenEditStudent = (u: UserListItem) => setEditingStudent(u);

  const isEditingSelf = Boolean(
    editingProf && currentUser && editingProf.id_user === currentUser.id_user
  );
  const profEmailChanged =
    editingProf && profEditEmail.value.trim().toLowerCase() !== editingProf.email.toLowerCase();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuarios"
        subtitle="Docentes, administradores y estudiantes de la cátedra"
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
              // En celular van uno debajo del otro, a todo el ancho, para que el texto no se corte
              <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-2 w-full">
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => navigate('/estudiantes/nuevo')}
                >
                  <GraduationCap className="w-4 h-4 mr-1.5 text-primary" />
                  Registrar estudiantes
                </Button>
                <Button variant="primary" className="w-full sm:w-auto" onClick={handleOpenCreateProf}>
                  <UserCheck className="w-4 h-4 mr-1.5" />
                  Registrar docente
                </Button>
              </div>
            )}
          </div>
        }
      />

      {/* Barra de herramientas: buscador y filtro de rol */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="w-full sm:max-w-sm">
          <Input
            type="text"
            placeholder="Buscar por nombre, legajo o correo"
            aria-label="Buscar usuarios"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setOffset(0);
            }}
            leftIcon={<Search className="w-4 h-4" />}
          />
        </div>
        <SegmentedControl
          label="Filtrar por rol"
          value={roleFilter}
          onChange={(v) => {
            setRoleFilter(v);
            setOffset(0);
          }}
          options={[
            { value: '', label: 'Todos' },
            { value: 'student', label: 'Alumnos' },
            { value: 'professor', label: 'Docentes' },
          ]}
        />
      </div>

      {isLoading ? (
        <TableSkeleton rows={4} cols={6} />
      ) : users.length === 0 ? (
        searchQuery || roleFilter ? (
          <EmptyState
            icon={<SearchX className="w-5 h-5" />}
            message="Ningún usuario coincide con la búsqueda"
            description="Revise el nombre, legajo o correo, o muestre todos los roles."
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setRoleFilter('');
                  setOffset(0);
                }}
              >
                Limpiar filtros
              </Button>
            }
          />
        ) : (
          <EmptyState message="Todavía no hay usuarios registrados" />
        )
      ) : (
        <>
          {/* Anchos fijos por columna: al filtrar, la tabla no cambia de forma */}
          <Table className="table-fixed min-w-[880px]">
            <colgroup>
              <col className="w-[29%]" />
              <col className="w-[29%]" />
              <col className="w-[11%]" />
              <col className="w-[15%]" />
              <col className="w-[16%]" />
              <col className="w-16" />
            </colgroup>
            <TableHeader>
              <tr>
                <TableHead>Apellido y nombre</TableHead>
                <TableHead>Correo electrónico</TableHead>
                <TableHead>Legajo</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Año de ingreso</TableHead>
                {/* Fija a la derecha: con la tabla más ancha que la pantalla, las acciones siguen a la vista */}
                <TableHead className="sticky right-0 bg-canvas">
                  <span className="sr-only">Acciones</span>
                </TableHead>
              </tr>
            </TableHeader>
            <tbody>
              {users.map((u) => (
                <TableRow key={u.id_user}>
                  {/* Un nombre largo baja de línea en vez de ensanchar la tabla */}
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <InitialsAvatar
                        name={`${u.last_name} ${u.first_name}`}
                        size="sm"
                      />
                      <span className="min-w-0 font-medium text-ink [overflow-wrap:anywhere]">
                        {u.last_name}, {u.first_name}
                      </span>
                    </div>
                  </TableCell>
                  {/* El correo largo se corta con puntos suspensivos; completo, al pasar el mouse */}
                  <TableCell className="text-ink-muted">
                    <span className="block truncate" title={u.email}>{u.email}</span>
                  </TableCell>
                  <TableCell className="text-ink-muted tabular-nums">
                    {u.legajo}
                  </TableCell>
                  <TableCell>
                    {u.is_super_admin ? (
                      <Badge variant="superadmin">Administrador</Badge>
                    ) : u.role === 'professor' ? (
                      <Badge variant="professor">Docente</Badge>
                    ) : (
                      <Badge variant="student">Alumno</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-ink-muted tabular-nums">
                    {u.role === 'student' ? u.enrollment_year || '—' : '—'}
                  </TableCell>
                  <TableCell className="text-right sticky right-0 bg-white group-hover:bg-canvas transition-colors duration-150">
                    <ActionMenu
                      label={`Acciones de ${u.first_name} ${u.last_name}`}
                      items={[
                        {
                          label: 'Modificar',
                          icon: <Edit2 className="w-3.5 h-3.5 text-primary" />,
                          onClick: () =>
                            u.role === 'professor' ? handleOpenEditProf(u) : handleOpenEditStudent(u),
                        },
                      ]}
                    />
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
          <Alert className="mb-4">{profCreateError}</Alert>
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
            <DateField
              label="Fecha de nacimiento"
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
                className="w-4 h-4 rounded border-line text-primary focus:ring-accent-light"
              />
              <span className="text-sm font-medium text-ink">
                Administrador
              </span>
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-line">
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
          <Alert className="mb-4">{profEditError}</Alert>
        )}

        {profEmailChanged && (
          <Alert tone="warning" className="mb-4">
            Al cambiar el correo se cerrará la sesión del docente.
          </Alert>
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
            <DateField
              label="Fecha de nacimiento"
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
                className="w-4 h-4 rounded border-line text-primary focus:ring-accent-light"
              />
              <span className="text-sm font-medium text-ink">
                Administrador
              </span>
            </label>
            {isEditingSelf && (
              <p className="text-xs text-warning mt-1 pl-7">
                No puede quitarse a sí mismo el rol de administrador
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-line">
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

      {editingStudent && (
        <EditStudentModal
          key={editingStudent.id_user}
          student={{
            id: editingStudent.id_user,
            first_name: editingStudent.first_name,
            last_name: editingStudent.last_name,
            legajo: editingStudent.legajo,
            enrollment_year: editingStudent.enrollment_year,
            birth_date: editingStudent.birth_date ?? null,
          }}
          onClose={() => setEditingStudent(null)}
          onSaved={fetchUsers}
        />
      )}
    </div>
  );
};
