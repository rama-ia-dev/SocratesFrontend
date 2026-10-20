import React, { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { api } from '../lib/api';
import { Modal } from './ui/Modal';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { useToast } from './ui/Toast';
import {
  useField,
  validateName,
  validateLegajo,
  validateBirthDate,
  validateEnrollmentYear,
  enrollmentYearRange,
  maxBirthDate,
  minBirthDate,
  digitsOnly,
} from '../lib/validation';

export interface EditableStudent {
  id: number;
  first_name: string;
  last_name: string;
  legajo: number;
  enrollment_year?: number | null;
  /** `undefined` cuando el listado de origen no la trae (el de Estudiantes, que usa el docente). */
  birth_date?: string | null;
}

const MIN_ENROLLMENT_YEAR = 1950;

/**
 * Diálogo "Modificar estudiante" (SCRUM-98), compartido por Usuarios y Estudiantes.
 * Se monta con la clave del alumno, así cada apertura arranca con sus datos.
 *
 * Si se conoce la fecha de nacimiento (Usuarios, super administrador), viene cargada y es
 * obligatoria: el año de ingreso se valida contra ella y se bloquea si se borra. El backend no
 * le muestra la fecha al docente, así que desde Estudiantes el campo no aparece (no se puede
 * modificar un dato que no se ve) y el año se valida entre 1950 y el actual. La fecha la cambia
 * el alumno desde Mi perfil o el super administrador desde Usuarios.
 */
export const EditStudentModal: React.FC<{
  student: EditableStudent;
  onClose: () => void;
  onSaved: () => void;
}> = ({ student, onClose, onSaved }) => {
  const { success } = useToast();
  const birthDateKnown = student.birth_date !== undefined;
  const initialBirthDate = student.birth_date || '';

  const firstName = useField(student.first_name, validateName('nombre'));
  const lastName = useField(student.last_name, validateName('apellido'));
  const legajo = useField(String(student.legajo), validateLegajo);
  const birthDate = useField(initialBirthDate, (v) => (birthDateKnown ? validateBirthDate(v) : null), {
    validateOnChange: true,
  });
  const enrollmentYear = useField(student.enrollment_year ? String(student.enrollment_year) : '', (v) => {
    if (birthDateKnown) return validateEnrollmentYear(v, birthDate.value);
    const max = new Date().getFullYear();
    if (!v) return 'Ingrese el año de ingreso';
    return /^\d{4}$/.test(v) && Number(v) >= MIN_ENROLLMENT_YEAR && Number(v) <= max
      ? null
      : `Ingrese un año entre ${MIN_ENROLLMENT_YEAR} y ${max}`;
  });
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Se revisan todos (no se corta en el primero) para marcar cada campo con error a la vez
    const checks = [legajo, firstName, lastName, birthDate, enrollmentYear].map((f) => f.check());
    if (checks.includes(false)) return;

    // PATCH: solo lo que cambió. Sin cambios no se llama al backend (rechaza el body vacío).
    const year = Number(enrollmentYear.value);
    const changes = {
      ...(firstName.value.trim() !== student.first_name && { first_name: firstName.value.trim() }),
      ...(lastName.value.trim() !== student.last_name && { last_name: lastName.value.trim() }),
      ...(Number(legajo.value) !== student.legajo && { legajo: Number(legajo.value) }),
      ...(year !== student.enrollment_year && { enrollment_year: year }),
      ...(birthDateKnown && birthDate.value !== initialBirthDate && { birth_date: birthDate.value }),
    };
    if (Object.keys(changes).length === 0) {
      onClose();
      return;
    }

    setIsSaving(true);
    try {
      await api.updateStudent(student.id, changes);
      success('Datos del estudiante actualizados');
      onSaved();
      onClose();
    } catch (err: any) {
      // El único 409 de esta ruta es el legajo repetido: se marca en el campo
      if (err.status === 409) legajo.reject('Ya existe un alumno con ese legajo');
      else setError(err.message || 'Error al actualizar estudiante');
      setIsSaving(false);
    }
  };

  // El aviso del correo nuevo sale solo con un legajo válido
  const legajoChanged = legajo.value !== String(student.legajo) && !validateLegajo(legajo.value);
  // Con la fecha conocida, el año se bloquea si se borra (como al registrar).
  const yearLocked = birthDateKnown && !enrollmentYearRange(birthDate.value);

  return (
    <Modal isOpen onClose={onClose} title="Modificar estudiante">
      {error && (
        <div
          role="alert"
          className="mb-4 p-3 rounded-lg bg-[#FEE2E2] border border-[#FCA5A5] text-[#B91C1C] text-sm flex items-start gap-2"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {legajoChanged && (
        <div className="mb-4 p-3 rounded-lg bg-[#EFF6FF] border border-[#BAE6FD] text-[#1D4ED8] text-xs">
          El correo de ingreso pasará a ser{' '}
          <span className="font-mono font-semibold">{legajo.value}@sistemas.frc.utn.edu.ar</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Input
          label="Legajo"
          inputMode="numeric"
          {...legajo.inputProps}
          onChange={(e) => legajo.setValue(digitsOnly(e.target.value))}
          disabled={isSaving}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Nombre" {...firstName.inputProps} disabled={isSaving} />
          <Input label="Apellido" {...lastName.inputProps} disabled={isSaving} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {birthDateKnown && (
            <Input
              label="Fecha de nacimiento"
              type="date"
              min={minBirthDate()}
              max={maxBirthDate()}
              {...birthDate.inputProps}
              disabled={isSaving}
            />
          )}
          <Input
            label="Año de ingreso"
            inputMode="numeric"
            maxLength={4}
            {...enrollmentYear.inputProps}
            onChange={(e) => enrollmentYear.setValue(digitsOnly(e.target.value))}
            disabled={isSaving || yearLocked}
            helperText={yearLocked ? 'Ingrese una fecha de nacimiento para habilitar este campo' : undefined}
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-[#D6E4F7]">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" isLoading={isSaving}>
            Guardar
          </Button>
        </div>
      </form>
    </Modal>
  );
};
