import React, { useState } from 'react';

// Reglas de los formularios de usuarios. Cada validador devuelve el mensaje de error o null.

export const STUDENT_DOMAIN = 'sistemas.frc.utn.edu.ar';
export const MIN_AGE = 18;
const MAX_AGE = 100;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Letras (con tildes, diéresis y ñ), espacios y apóstrofo: "María José", "D'Angelo".
const NAME_RE = /^[\p{L}]+(?:[ '][\p{L}]+)*$/u;

const pad = (n: number) => String(n).padStart(2, '0');
const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const yearsAgo = (years: number) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return isoDate(d);
};

// Edad mínima, igual que en el backend: 18 años cumplidos al día de hoy, docentes y estudiantes.
// Fecha de nacimiento más reciente permitida (límite del selector de fecha).
export const maxBirthDate = () => yearsAgo(MIN_AGE);
export const minBirthDate = () => yearsAgo(MAX_AGE);

export const validateEmail = (value: string): string | null => {
  const v = value.trim();
  if (!v) return 'Ingrese el correo';
  if (!EMAIL_RE.test(v)) return 'Ingrese un correo válido, por ejemplo nombre@correo.com';
  return null;
};

export const validateProfessorEmail = (value: string): string | null =>
  validateEmail(value) ??
  (value.trim().toLowerCase().endsWith(`@${STUDENT_DOMAIN}`)
    ? `Los correos @${STUDENT_DOMAIN} son de alumnos. Use el correo del docente`
    : null);

export const validateName = (label: 'nombre' | 'apellido') => (value: string): string | null => {
  const v = value.trim();
  if (!v) return `Ingrese el ${label}`;
  if (!NAME_RE.test(v)) return `El ${label} solo puede tener letras, espacios y apóstrofos`;
  return null;
};

export const validateLegajo = (value: string): string | null => {
  if (!value) return 'Ingrese el legajo';
  if (!/^\d+$/.test(value) || Number(value) <= 0) return 'El legajo es un número mayor a cero';
  return null;
};

export const validateBirthDate = (value: string, { required = true } = {}): string | null => {
  if (!value) return required ? 'Ingrese la fecha de nacimiento' : null;
  if (value > isoDate(new Date())) return 'La fecha no puede ser posterior a hoy';
  if (value > maxBirthDate()) return `Debe tener al menos ${MIN_AGE} años`;
  if (value < minBirthDate()) return 'Revise la fecha: indica más de 100 años';
  return null;
};

// Rango de años de ingreso posibles: desde el año en que cumplió 18 hasta el actual.
export const enrollmentYearRange = (birthDate: string): { min: number; max: number } | null => {
  if (!birthDate || validateBirthDate(birthDate)) return null;
  return { min: Number(birthDate.slice(0, 4)) + MIN_AGE, max: new Date().getFullYear() };
};

export const validateEnrollmentYear = (value: string, birthDate: string): string | null => {
  const range = enrollmentYearRange(birthDate);
  // Sin fecha válida el campo queda bloqueado con su leyenda, y el error lo marca la fecha.
  if (!range) return null;
  if (!value) return 'Ingrese el año de ingreso';
  const year = Number(value);
  if (!/^\d{4}$/.test(value) || year < range.min || year > range.max) {
    return range.min === range.max
      ? `Ingrese ${range.max}`
      : `Ingrese un año entre ${range.min} y ${range.max}`;
  }
  return null;
};

export const digitsOnly = (value: string) => value.replace(/\D/g, '');

// El backend responde 409 tanto por correo como por legajo repetido; el detalle dice cuál.
export const professorSaveError = (err: any, fallback: string): string => {
  const detail = String(err.message || '').toLowerCase();
  if (err.status === 409 && detail.includes('legajo')) return 'Ya existe un docente con ese legajo';
  if (err.status === 409 && detail.includes('mail')) return 'Ya existe un docente con ese correo';
  if (err.status === 422 && detail.includes('reserved for students')) return 'Los correos de alumnos no se pueden usar para un docente';
  return err.message || fallback;
};

/**
 * Estado y error de un campo. El error aparece al salir de un campo con algo escrito o al
 * enviar el formulario; una vez visible, se recalcula con cada tecla para que desaparezca
 * apenas el valor es válido.
 */
export function useField(
  initial: string,
  validate: (value: string) => string | null,
  // Para fechas: el navegador solo entrega un valor cuando está completo, así que se valida
  // apenas cambia, sin esperar a que se salga del campo.
  { validateOnChange = false } = {}
) {
  const [value, setRawValue] = useState(initial);
  const [touched, setTouched] = useState(false);
  const error = touched ? validate(value) : null;

  const setValue = (next: string) => {
    setRawValue(next);
    if (validateOnChange && next) setTouched(true);
  };

  return {
    value,
    error,
    setValue,
    reset: (next = initial) => {
      setRawValue(next);
      setTouched(false);
    },
    /** Marca el campo como revisado y dice si es válido; se usa al enviar. */
    check: () => {
      setTouched(true);
      return validate(value) === null;
    },
    inputProps: {
      value,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => setValue(e.target.value),
      onBlur: () => {
        if (value.trim()) setTouched(true);
      },
      error: error ?? undefined,
    },
  };
}
