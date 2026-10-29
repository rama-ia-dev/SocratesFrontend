import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { PageHeader } from '../components/ui/PageHeader';
import { Input } from '../components/ui/Input';
import { DateField } from '../components/ui/DateField';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { InitialsAvatar } from '../components/ui/Table';
import { useToast } from '../components/ui/Toast';
import { Modal } from '../components/ui/Modal';
import { PasswordCodeForm } from '../components/PasswordCodeForm';
import { KeyRound } from 'lucide-react';
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
import { Alert } from '../components/ui/Alert';

const ReadOnlyField: React.FC<{ label: string; children: React.ReactNode; mono?: boolean }> = ({
  label,
  children,
  mono,
}) => (
  // Dato que no se puede cambiar desde acá: se lee como texto, no como un campo deshabilitado
  <div>
    <dt className="text-[13px] text-ink-muted">{label}</dt>
    <dd className={`mt-0.5 text-sm text-ink flex items-center gap-2 ${mono ? 'tabular-nums' : ''}`}>
      {children}
    </dd>
  </div>
);

const Section: React.FC<{ title: string; description?: string; children: React.ReactNode }> = ({
  title,
  description,
  children,
}) => (
  <section className="bg-white border border-line rounded-xl">
    <header className="px-6 pt-5">
      <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
      {description && <p className="mt-0.5 text-[13px] text-ink-muted">{description}</p>}
    </header>
    <div className="px-6 pt-4 pb-6">{children}</div>
  </section>
);

export const Profile: React.FC = () => {
  const { user, refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const { success } = useToast();

  // Correo y legajo los cambia un administrador; si es uno, puede cambiar los suyos desde acá.
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
  const [passwordOpen, setPasswordOpen] = useState(false);

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
    <div className="max-w-2xl space-y-5">
      <PageHeader title="Mi perfil" className="mb-2" />

      {/* Quién es: nombre, rol y correo, como en el pie del menú */}
      <div className="flex items-center gap-4">
        <InitialsAvatar
          name={`${user.first_name} ${user.last_name}`}
          size="lg"
          colors="bg-navy text-white border-navy"
        />
        <div className="min-w-0">
          <p className="text-lg font-semibold text-ink truncate">
            {user.first_name} {user.last_name}
          </p>
          <p className="text-sm text-ink-muted flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{user.is_super_admin ? 'Administrador' : roleText}</span>
            <span aria-hidden="true">·</span>
            <span className="truncate">{user.email}</span>
          </p>
        </div>
      </div>

      <Section title="Datos personales">
        {errorMessage && (
          <Alert className="mb-5">{errorMessage}</Alert>
        )}

        {emailChanged && (
          <Alert tone="warning" className="mb-5">
            Al cambiar el correo se cerrará su sesión y deberá entrar con el correo nuevo. La
            contraseña no cambia.
          </Alert>
        )}

        <form onSubmit={handleSave} className="space-y-5" noValidate>
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
            <DateField
              label="Fecha de nacimiento"
              optional
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

          {/* Datos de la cuenta que no se editan acá */}
          <div className="border-t border-line pt-5 space-y-3">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {!canEditAccount && <ReadOnlyField label="Correo electrónico">{user.email}</ReadOnlyField>}
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
                {user.is_super_admin && <Badge variant="superadmin">Administrador</Badge>}
              </ReadOnlyField>
            </dl>
            {!canEditAccount && (
              <p className="text-xs text-ink-muted">
                Correo, legajo y rol los modifica un administrador.
              </p>
            )}
          </div>

          {/* Botones de acción */}
          <div className="flex items-center justify-end gap-3 pt-5 border-t border-line">
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
      </Section>

      <section className="bg-white border border-line rounded-xl px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-4 sm:justify-between">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">Contraseña</h2>
          <p className="text-[13px] text-ink-muted mt-0.5">
            Se confirma con un código que le llega al correo. Al cambiarla se cierra la sesión en
            todos los dispositivos.
          </p>
        </div>
        <Button type="button" variant="outline" className="shrink-0" onClick={() => setPasswordOpen(true)}>
          <KeyRound className="w-4 h-4" />
          Cambiar contraseña
        </Button>
      </section>

      <Modal isOpen={passwordOpen} onClose={() => setPasswordOpen(false)} title="Cambiar contraseña">
        <PasswordCodeForm
          fixedEmail={user.email}
          onSaved={async () => {
            // El backend cerró todas las sesiones, incluida esta
            await logout().catch(() => undefined);
            success('Contraseña cambiada. Inicie sesión con la nueva');
            navigate('/login', { replace: true });
          }}
        />
      </Modal>
    </div>
  );
};
