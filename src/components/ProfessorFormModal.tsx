import React, { useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import type { ProfessorPublic, UserListItem } from '../types/api';
import { Modal } from './ui/Modal';
import { Input } from './ui/Input';
import { DateField } from './ui/DateField';
import { Button } from './ui/Button';
import { Alert } from './ui/Alert';
import { useToast } from './ui/Toast';
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

/**
 * Registrar o modificar un docente (SCRUM-6, SCRUM-7, SCRUM-609). Sin `professor` registra uno nuevo;
 * `onSaved` recibe el docente creado (para resaltarlo en la lista) o `null` después de modificar.
 */
export const ProfessorFormModal: React.FC<{
  professor?: UserListItem | null;
  onClose: () => void;
  onSaved: (created: ProfessorPublic | null) => void;
}> = ({ professor, onClose, onSaved }) => {
  const { user: currentUser } = useAuth();
  const { success } = useToast();
  const isEdit = Boolean(professor);

  const firstName = useField(professor?.first_name ?? '', validateName('nombre'));
  const lastName = useField(professor?.last_name ?? '', validateName('apellido'));
  const email = useField(professor?.email ?? '', validateProfessorEmail);
  const legajo = useField(professor ? String(professor.legajo) : '', validateLegajo);
  const birthDate = useField(professor?.birth_date ?? '', (v) => validateBirthDate(v), { validateOnChange: true });
  const [isSuperAdmin, setIsSuperAdmin] = useState(Boolean(professor?.is_super_admin));
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const isEditingSelf = Boolean(professor && currentUser && professor.id_user === currentUser.id_user);
  const emailChanged = professor && email.value.trim().toLowerCase() !== professor.email.toLowerCase();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    // Se revisan todos (no se corta en el primero) para marcar cada campo con error a la vez
    const checks = [firstName, lastName, email, legajo, birthDate].map((f) => f.check());
    if (checks.includes(false)) return;

    if (isEditingSelf && !isSuperAdmin && currentUser?.is_super_admin) {
      setFormError('No puede quitarse a sí mismo el rol de administrador');
      return;
    }

    const mailLower = email.value.trim().toLowerCase();
    setIsSaving(true);
    try {
      if (!professor) {
        const created = await api.createProfessor({
          first_name: firstName.value.trim(),
          last_name: lastName.value.trim(),
          mail: mailLower,
          legajo: Number(legajo.value),
          birth_date: birthDate.value,
          is_super_admin: isSuperAdmin,
        });
        success('Docente registrado. Recibirá un correo para crear su contraseña');
        onSaved(created);
        return;
      }
      // PATCH: solo lo que cambió. Cambiar el correo cierra las sesiones del docente, así que no se
      // reenvía si quedó igual. Sin cambios no se llama al backend (rechaza el cuerpo vacío).
      const changes = {
        ...(firstName.value.trim() !== professor.first_name && { first_name: firstName.value.trim() }),
        ...(lastName.value.trim() !== professor.last_name && { last_name: lastName.value.trim() }),
        ...(mailLower !== professor.email.toLowerCase() && { mail: mailLower }),
        ...(Number(legajo.value) !== professor.legajo && { legajo: Number(legajo.value) }),
        ...(birthDate.value !== (professor.birth_date || '') && { birth_date: birthDate.value }),
        ...(isSuperAdmin !== Boolean(professor.is_super_admin) && { is_super_admin: isSuperAdmin }),
      };
      if (Object.keys(changes).length === 0) {
        onClose();
        return;
      }
      await api.updateProfessor(professor.id_user, changes);
      success('Docente actualizado');
      onSaved(null);
    } catch (err: any) {
      showProfessorSaveError(
        err,
        isEdit ? 'No se pudo actualizar el docente' : 'No se pudo registrar el docente',
        { legajo, mail: email },
        setFormError
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={() => !isSaving && onClose()}
      title={isEdit ? 'Modificar docente' : 'Registrar docente'}
    >
      {formError && <Alert className="mb-4">{formError}</Alert>}
      {emailChanged && (
        <Alert tone="warning" className="mb-4">
          Al cambiar el correo se cerrará la sesión del docente.
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Nombre" {...firstName.inputProps} disabled={isSaving} />
          <Input label="Apellido" {...lastName.inputProps} disabled={isSaving} />
        </div>
        <Input
          label="Correo electrónico"
          type="email"
          {...email.inputProps}
          disabled={isSaving}
          placeholder={isEdit ? undefined : 'docente@ejemplo.com'}
        />
        <Input
          label="Legajo"
          inputMode="numeric"
          {...legajo.inputProps}
          onChange={(e) => legajo.setValue(digitsOnly(e.target.value))}
          disabled={isSaving}
          placeholder={isEdit ? undefined : 'Ej. 10423'}
        />
        <DateField
          label="Fecha de nacimiento"
          min={minBirthDate()}
          max={maxBirthDate()}
          {...birthDate.inputProps}
          disabled={isSaving}
        />
        <div className="pt-2">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isSuperAdmin}
              onChange={(e) => setIsSuperAdmin(e.target.checked)}
              disabled={isEditingSelf || isSaving}
              className="w-4 h-4 rounded border-line text-primary focus:ring-accent-light"
            />
            <span className="text-sm font-medium text-ink">Administrador</span>
          </label>
          {isEditingSelf && (
            <p className="text-xs text-warning mt-1 pl-7">No puede quitarse a sí mismo el rol de administrador</p>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3 pt-4 border-t border-line">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" isLoading={isSaving}>
            {isEdit ? 'Guardar cambios' : 'Registrar docente'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
