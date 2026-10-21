import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { PageHeader } from '../components/ui/PageHeader';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useToast } from '../components/ui/Toast';
import { AlertCircle } from 'lucide-react';
import {
  useField,
  validateName,
  validateBirthDate,
  validateProfessorEmail,
  validateLegajo,
  maxBirthDate,
  minBirthDate,
  digitsOnly,
  showProfessorSaveError,
} from '../lib/validation';

const ReadOnlyField: React.FC<{ label: string; children: React.ReactNode; mono?: boolean }> = ({
  label,
  children,
  mono,
}) => (
  <div>
    <label className="block text-sm font-medium text-[#0F1F3D] mb-1.5">{label}</label>
    <div
      className={`w-full rounded-lg border border-[#D6E4F7] bg-[#F1F5F9] px-3 py-2 text-sm text-[#51607A] flex items-center gap-2 select-none ${
        mono ? 'font-mono' : ''
      }`}
    >
      {children}
    </div>
  </div>
);

export const Profile: React.FC = () => {
  const { user, refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const { success } = useToast();

  // Correo y legajo los cambia un super administrador; si es uno, puede cambiar los suyos desde acá.
  const canEditAccount = Boolean(user?.role === 'professor' && user.is_super_admin);

  const firstName = useField('', validateName('nombre'));
  const lastName = useField('', validateName('apellido'));
  const birthDate = useField('', (v) => validateBirthDate(v, { required: false }), {
    validateOnChange: true,
  });
  const email = useField('', validateProfessorEmail);
  const legajo = useField('', validateLegajo);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Si un usuario no tiene fecha de nacimiento cargada, el campo queda vacío y solo se envía si
  // la completa.
  const resetFields = () => {
    if (!user) return;
    firstName.reset(user.first_name || '');
    lastName.reset(user.last_name || '');
    birthDate.reset(user.birth_date || '');
    email.reset(user.email || '');
    legajo.reset(String(user.legajo ?? ''));
  };
  useEffect(resetFields, [user]);

  if (!user) return null;

  const nameChanged = firstName.value.trim() !== user.first_name;
  const lastNameChanged = lastName.value.trim() !== user.last_name;
  const birthDateChanged = birthDate.value !== (user.birth_date || '');
  const emailChanged = canEditAccount && email.value.trim().toLowerCase() !== user.email.toLowerCase();
  const legajoChanged = canEditAccount && legajo.value !== String(user.legajo);
  const isDirty = nameChanged || lastNameChanged || birthDateChanged || emailChanged || legajoChanged;

  const handleCancel = () => {
    resetFields();
    setErrorMessage(null);
    navigate(-1);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const fields = canEditAccount
      ? [firstName, lastName, birthDate, email, legajo]
      : [firstName, lastName, birthDate];
    if (fields.map((f) => f.check()).includes(false)) return;

    setIsLoading(true);
    try {
      // PATCH: solo lo que cambió; lo no enviado el backend lo deja como está
      if (nameChanged || lastNameChanged || birthDateChanged) {
        await api.updateMe({
          ...(nameChanged && { first_name: firstName.value.trim() }),
          ...(lastNameChanged && { last_name: lastName.value.trim() }),
          ...(birthDateChanged && birthDate.value && { birth_date: birthDate.value }),
        });
      }
      // Va al final: cambiar el correo cierra todas las sesiones, incluida esta.
      if (emailChanged || legajoChanged) {
        await api.updateProfessor(user.id_user, {
          ...(legajoChanged && { legajo: Number(legajo.value) }),
          ...(emailChanged && { mail: email.value.trim().toLowerCase() }),
        });
      }
      if (emailChanged) {
        await logout().catch(() => undefined);
        success('Correo actualizado. Inicie sesión con el correo nuevo');
        navigate('/login', { replace: true });
        return;
      }
      await refreshUser();
      success('Datos actualizados');
    } catch (err: any) {
      showProfessorSaveError(err, 'Error al actualizar los datos', { legajo, mail: email }, setErrorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const roleText = user.role === 'professor' ? 'Docente' : 'Alumno';

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader title="Mi perfil" />

      <div className="w-full max-w-[640px] bg-white border border-[#D6E4F7] rounded-xl shadow-xs p-8">
        {errorMessage && (
          <div
            role="alert"
            className="mb-6 p-3 rounded-lg bg-[#FEE2E2] border border-[#FCA5A5] text-[#B91C1C] text-sm flex items-start gap-2.5"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {emailChanged && (
          <div className="mb-6 p-3 rounded-lg bg-[#FEF3C7] border border-[#FDE68A] text-[#B45309] text-xs">
            Al cambiar el correo se cerrará su sesión y deberá entrar con el correo nuevo. La
            contraseña no cambia.
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6" noValidate>
          {/* Campos editables */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Nombre"
              type="text"
              {...firstName.inputProps}
              disabled={isLoading}
            />
            <Input
              label="Apellido"
              type="text"
              {...lastName.inputProps}
              disabled={isLoading}
            />
          </div>

          <div>
            <Input
              label="Fecha de nacimiento"
              optional
              type="date"
              min={minBirthDate()}
              max={maxBirthDate()}
              {...birthDate.inputProps}
              disabled={isLoading}
              helperText={user.birth_date ? undefined : 'Completala solo si querés actualizarla'}
            />
          </div>

          {canEditAccount && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Correo electrónico"
                type="email"
                {...email.inputProps}
                disabled={isLoading}
              />
              <Input
                label="Legajo"
                inputMode="numeric"
                {...legajo.inputProps}
                onChange={(e) => legajo.setValue(digitsOnly(e.target.value))}
                disabled={isLoading}
              />
            </div>
          )}

          <div className="border-t border-[#D6E4F7] pt-5 space-y-4">
            {/* Campos de solo lectura (fondo #F1F5F9) */}
            {!canEditAccount && (
              <>
                <p className="text-xs text-[#51607A]">
                  Correo, legajo y rol los modifica un administrador.
                </p>
                <ReadOnlyField label="Correo electrónico">{user.email}</ReadOnlyField>
              </>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {!canEditAccount && (
                <ReadOnlyField label="Legajo" mono>
                  {user.legajo}
                </ReadOnlyField>
              )}

              {user.role === 'student' && (
                <ReadOnlyField label="Año de ingreso">{user.enrollment_year ?? '—'}</ReadOnlyField>
              )}

              <ReadOnlyField label="Rol">
                <span>{roleText}</span>
                {user.is_super_admin && <Badge variant="superadmin">Super administrador</Badge>}
              </ReadOnlyField>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#D6E4F7]">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={!isDirty || isLoading}
              isLoading={isLoading}
            >
              Guardar cambios
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
