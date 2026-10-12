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

export const Profile: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const { success } = useToast();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setFirstName(user.first_name || '');
      setLastName(user.last_name || '');
      setBirthDate(user.birth_date || '1995-05-15');
    }
  }, [user]);

  if (!user) return null;

  // Comprobar si hay cambios
  const isDirty =
    firstName.trim() !== user.first_name ||
    lastName.trim() !== user.last_name ||
    (birthDate !== (user.birth_date || '1995-05-15'));

  const handleCancel = () => {
    setFirstName(user.first_name);
    setLastName(user.last_name);
    setBirthDate(user.birth_date || '1995-05-15');
    setErrorMessage(null);
    navigate(-1);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!firstName.trim()) {
      setErrorMessage('El nombre no puede estar vacío');
      return;
    }
    if (!lastName.trim()) {
      setErrorMessage('El apellido no puede estar vacío');
      return;
    }

    if (birthDate) {
      const selected = new Date(birthDate);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (selected > today) {
        setErrorMessage('La fecha no puede ser posterior a hoy');
        return;
      }
    }

    setIsLoading(true);
    try {
      await api.updateMe({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        birth_date: birthDate,
      });
      await refreshUser();
      success('Datos actualizados');
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al actualizar los datos');
    } finally {
      setIsLoading(false);
    }
  };

  const roleText = user.role === 'professor' ? 'Profesor' : 'Alumno';

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

        <form onSubmit={handleSave} className="space-y-6" noValidate>
          {/* Campos editables */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Nombre"
              requiredAsterisk
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              disabled={isLoading}
              required
            />
            <Input
              label="Apellido"
              requiredAsterisk
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>

          <div>
            <Input
              label="Fecha de nacimiento"
              requiredAsterisk
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>

          <div className="border-t border-[#D6E4F7] pt-5 space-y-4">
            {/* Campos de solo lectura (fondo #F1F5F9) */}
            <div>
              <label className="block text-sm font-medium text-[#0F1F3D] mb-1.5">
                Correo electrónico
              </label>
              <div className="w-full rounded-lg border border-[#D6E4F7] bg-[#F1F5F9] px-3 py-2 text-sm text-[#51607A] select-none">
                {user.email}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#0F1F3D] mb-1.5">
                  Legajo
                </label>
                <div className="w-full rounded-lg border border-[#D6E4F7] bg-[#F1F5F9] px-3 py-2 text-sm text-[#51607A] select-none font-mono">
                  {user.legajo}
                </div>
              </div>

              {user.role === 'student' && (
                <div>
                  <label className="block text-sm font-medium text-[#0F1F3D] mb-1.5">
                    Año de ingreso
                  </label>
                  <div className="w-full rounded-lg border border-[#D6E4F7] bg-[#F1F5F9] px-3 py-2 text-sm text-[#51607A] select-none">
                    {user.enrollment_year || 2022}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-[#0F1F3D] mb-1.5">
                  Rol
                </label>
                <div className="w-full rounded-lg border border-[#D6E4F7] bg-[#F1F5F9] px-3 py-2 text-sm text-[#51607A] flex items-center gap-2 select-none">
                  <span>{roleText}</span>
                  {user.is_super_admin && (
                    <Badge variant="superadmin">Super administrador</Badge>
                  )}
                </div>
              </div>
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
