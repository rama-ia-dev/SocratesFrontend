import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { UserListItem, UserPublic } from '../types/api';
import { useAuth } from '../context/AuthContext';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
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
import { Search, MoreVertical, Plus, Edit2, AlertCircle } from 'lucide-react';
import { validateName, professorSaveError } from '../lib/validation';

export const Professors: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { success, error: toastError } = useToast();

  const [professors, setProfessors] = useState<UserListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProf, setEditingProf] = useState<UserListItem | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [originalEmail, setOriginalEmail] = useState('');
  const [legajo, setLegajo] = useState<number | ''>('');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Menú contextual
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  const fetchProfessors = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.getUsers({
        role: 'professor',
        q: searchQuery || null,
        limit: 10,
        offset,
      });
      setProfessors(res.items);
      setTotal(res.total);
    } catch {
      toastError('Error al cargar la lista de docentes');
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, offset, toastError]);

  useEffect(() => {
    fetchProfessors();
  }, [fetchProfessors]);

  const handleOpenCreate = () => {
    setEditingProf(null);
    setFirstName('');
    setLastName('');
    setEmail('');
    setOriginalEmail('');
    setLegajo('');
    setIsSuperAdmin(false);
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (prof: UserListItem) => {
    setEditingProf(prof);
    setFirstName(prof.first_name);
    setLastName(prof.last_name);
    setEmail(prof.email);
    setOriginalEmail(prof.email);
    setLegajo(prof.legajo);
    setIsSuperAdmin(Boolean(prof.is_super_admin));
    setModalError(null);
    setOpenMenuId(null);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    const nameError = validateName('nombre')(firstName) ?? validateName('apellido')(lastName);
    if (nameError) {
      setModalError(nameError);
      return;
    }

    const mailLower = email.trim().toLowerCase();
    if (!mailLower) {
      setModalError('Ingrese un correo electrónico');
      return;
    }

    if (mailLower.endsWith('@sistemas.frc.utn.edu.ar')) {
      setModalError('No puede usar el dominio de los alumnos');
      return;
    }

    if (!legajo || legajo <= 0) {
      setModalError('El legajo debe ser un número positivo');
      return;
    }

    // Comprobar si el superadmin se quita el rol a sí mismo
    if (
      editingProf &&
      currentUser &&
      editingProf.id_user === currentUser.id_user &&
      !isSuperAdmin &&
      currentUser.is_super_admin
    ) {
      setModalError('No puede quitarse a sí mismo el rol de super administrador');
      return;
    }

    setIsSaving(true);
    try {
      if (editingProf) {
        await api.updateProfessor(editingProf.id_user, {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          mail: mailLower,
          legajo: Number(legajo),
          is_super_admin: isSuperAdmin,
        });
        success('Docente actualizado');
      } else {
        await api.createProfessor({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          mail: mailLower,
          legajo: Number(legajo),
          birth_date: '1980-01-01',
          is_super_admin: isSuperAdmin,
        });
        success('Docente registrado. Recibirá un correo para crear su contraseña');
      }

      setIsModalOpen(false);
      fetchProfessors();
    } catch (err: any) {
      setModalError(professorSaveError(err, 'Error al guardar docente'));
    } finally {
      setIsSaving(false);
    }
  };

  const isEditingSelf = Boolean(
    editingProf && currentUser && editingProf.id_user === currentUser.id_user
  );

  const emailHasChanged = editingProf && email.trim().toLowerCase() !== originalEmail.toLowerCase();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Docentes"
        action={
          <Button variant="primary" onClick={handleOpenCreate}>
            <Plus className="w-4 h-4 mr-1.5" />
            Registrar docente
          </Button>
        }
      />

      {/* Buscador */}
      <div className="max-w-md">
        <Input
          type="text"
          placeholder="Buscar por apellido, nombre o correo"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setOffset(0);
          }}
          leftIcon={<Search className="w-4 h-4" />}
        />
      </div>

      {isLoading ? (
        <TableSkeleton rows={4} cols={5} />
      ) : professors.length === 0 ? (
        <EmptyState message="No se encontraron docentes registrados." />
      ) : (
        <>
          <Table>
            <TableHeader>
              <tr>
                <TableHead>Apellido y nombre</TableHead>
                <TableHead>Correo electrónico</TableHead>
                <TableHead>Legajo</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead className="w-20 text-right">Acciones</TableHead>
              </tr>
            </TableHeader>
            <tbody>
              {professors.map((prof) => (
                <TableRow key={prof.id_user}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <InitialsAvatar
                        name={`${prof.last_name} ${prof.first_name}`}
                        size="sm"
                      />
                      <span className="font-medium text-ink">
                        {prof.last_name}, {prof.first_name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-ink-muted">{prof.email}</TableCell>
                  <TableCell className="font-mono text-ink-muted">
                    {prof.legajo}
                  </TableCell>
                  <TableCell>
                    {prof.is_super_admin ? (
                      <Badge variant="superadmin">Super administrador</Badge>
                    ) : (
                      <Badge variant="professor">Docente</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right relative">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenMenuId(
                          openMenuId === prof.id_user ? null : prof.id_user
                        )
                      }
                      className="p-1 rounded text-ink-muted hover:text-ink hover:bg-tint cursor-pointer"
                      aria-label="Abrir menú de opciones"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {openMenuId === prof.id_user && (
                      <div className="absolute right-4 top-10 w-36 bg-white border border-line rounded-lg shadow-lg py-1 z-20 text-left">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(prof)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-ink hover:bg-tint cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-primary" />
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

      {/* Diálogo Registrar / Modificar Docente */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingProf ? 'Modificar docente' : 'Registrar docente'}
      >
        {modalError && (
          <div
            role="alert"
            className="mb-4 p-3 rounded-lg bg-danger-soft border border-danger-line text-danger text-sm flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{modalError}</span>
          </div>
        )}

        {emailHasChanged && (
          <div className="mb-4 p-3 rounded-lg bg-warning-soft border border-warning-line text-warning text-xs">
            Al cambiar el correo se cerrará la sesión del docente.
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Nombre"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              disabled={isSaving}
              required
            />
            <Input
              label="Apellido"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              disabled={isSaving}
              required
            />
          </div>

          <div>
            <Input
              label="Correo electrónico"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSaving}
              placeholder="docente@ejemplo.com"
              helperText="Se guarda en minúsculas. No puede usar el dominio de alumnos."
              required
            />
          </div>

          <div>
            <Input
              label="Legajo"
              type="number"
              min={1}
              value={legajo}
              onChange={(e) => setLegajo(Number(e.target.value))}
              disabled={isSaving}
              placeholder="Ej. 10423"
              required
            />
          </div>

          <div className="pt-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isSuperAdmin}
                onChange={(e) => setIsSuperAdmin(e.target.checked)}
                disabled={isEditingSelf || isSaving}
                className="w-4 h-4 rounded border-line text-primary focus:ring-accent-light"
              />
              <span className="text-sm font-medium text-ink">
                Super administrador
              </span>
            </label>
            {isEditingSelf && (
              <p className="text-xs text-warning mt-1 pl-7">
                No puede quitarse a sí mismo el rol de super administrador
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-line">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isSaving}
            >
              Guardar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
