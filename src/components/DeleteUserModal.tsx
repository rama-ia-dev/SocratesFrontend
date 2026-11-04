import React, { useState } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Alert } from './ui/Alert';

export interface DeletableUser {
  id: number;
  first_name: string;
  last_name: string;
  legajo: number;
  role: 'student' | 'professor';
  is_super_admin?: boolean | null;
}

// Rechazo del backend al eliminar, en palabras del usuario
const deleteError = (err: any): string => {
  const detail = String(err.message || '');
  if (err.status === 409) {
    if (detail.includes('super admin')) return 'Tiene el rol de administrador: primero quítele ese rol desde Modificar.';
    if (detail.includes('assigned to a section year'))
      return 'Tiene cursos lectivos asignados: primero debe desasignarlo desde Comisiones, en "Docentes asignados" de cada curso.';
    if (detail.includes('membership'))
      return 'Es integrante de un equipo de trabajo (aunque el equipo haya finalizado) o tiene una solicitud pendiente: no se puede eliminar.';
    if (detail.includes('in use')) return 'Ya tiene registros en el sistema (por ejemplo, asistencias): no se puede eliminar.';
  }
  if (err.status === 404) return 'Ya no existe: puede que otra persona lo haya eliminado.';
  if (err.status === 403) return 'Solo el administrador puede eliminar usuarios.';
  return detail || 'No se pudo eliminar';
};

/**
 * Confirmación para eliminar a un usuario cargado por error (SCRUM-111 y SCRUM-101). Solo lo hace
 * el administrador. Un administrador no se puede eliminar hasta quitarle el rol, así que para él
 * el diálogo solo lo explica. `remove` es la llamada al backend: DELETE /users o DELETE /students.
 */
export const DeleteUserModal: React.FC<{
  person: DeletableUser;
  remove: (id: number) => Promise<void>;
  onClose: () => void;
  onDeleted: (name: string) => void;
}> = ({ person, remove, onClose, onDeleted }) => {
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  // El backend lo rechazó por sus datos (409): ya no se ofrece eliminar, queda solo el motivo
  const [blocked, setBlocked] = useState(false);
  const name = `${person.first_name} ${person.last_name}`;
  const isAdmin = Boolean(person.is_super_admin);

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      await remove(person.id);
      onDeleted(name);
    } catch (err: any) {
      setError(deleteError(err));
      if (err?.status === 409) setBlocked(true);
      setIsDeleting(false);
    }
  };

  return (
    <Modal isOpen onClose={() => !isDeleting && onClose()} title={`Eliminar a ${name}`}>
      {error && <Alert className="mb-4">{error}</Alert>}
      <div className="space-y-2 text-sm text-ink">
        {isAdmin ? (
          <p>Tiene el rol de administrador: para eliminar a esta persona, primero quítele ese rol desde Modificar.</p>
        ) : blocked ? null : (
          <p>
            Se borran sus datos y deja de tener acceso al sistema. Su legajo{' '}
            <span className="tabular-nums">{person.legajo}</span> queda libre para volver a cargarlo. No se
            puede deshacer.
          </p>
        )}
      </div>
      <div className="flex justify-end gap-3 pt-3 mt-4 border-t border-line">
        <Button type="button" variant="outline" onClick={onClose} disabled={isDeleting}>
          {isAdmin || blocked ? 'Cerrar' : 'Cancelar'}
        </Button>
        {!isAdmin && !blocked && (
          <Button type="button" variant="destructive" onClick={handleDelete} isLoading={isDeleting}>
            Eliminar
          </Button>
        )}
      </div>
    </Modal>
  );
};
