import React, { useState } from 'react';

// Reglas de los formularios de usuarios. Cada validador devuelve el mensaje de error o null.

export const STUDENT_DOMAIN = 'sistemas.frc.utn.edu.ar';
export const MIN_AGE = 18;
const MAX_AGE = 100;
// Límite del backend para nombre y apellido
const NAME_MAX_LENGTH = 100;

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
  if (!EMAIL_RE.test(v)) return 'Ingrese un correo válido, con @ y dominio';
  return null;
};

// Contraseña de alta seguridad. El backend solo exige 8 caracteres; el resto lo pide el frontend
// al crearla o cambiarla, así que no afecta a las contraseñas que ya existen.
export const PASSWORD_MAX_LENGTH = 128;
export const PASSWORD_RULES: { label: string; test: (v: string) => boolean }[] = [
  { label: 'Al menos 8 caracteres', test: (v) => v.length >= 8 },
  { label: 'Una letra mayúscula', test: (v) => /\p{Lu}/u.test(v) },
  { label: 'Una letra minúscula', test: (v) => /\p{Ll}/u.test(v) },
  { label: 'Un número', test: (v) => /\d/.test(v) },
  { label: 'Un símbolo, por ejemplo ! ? # $ . -', test: (v) => /[^\p{L}\d\s]/u.test(v) },
];
export const isStrongPassword = (value: string) => PASSWORD_RULES.every((rule) => rule.test(value));

// Ayuda del correo de los alumnos, en todas las pantallas donde se escribe el propio correo.
export const STUDENT_EMAIL_PLACEHOLDER = `123456@${STUDENT_DOMAIN}`;
export const STUDENT_EMAIL_HELP = `Alumnos: su legajo seguido de @${STUDENT_DOMAIN}`;

export const validateProfessorEmail = (value: string): string | null =>
  validateEmail(value) ??
  (value.trim().toLowerCase().endsWith(`@${STUDENT_DOMAIN}`)
    ? `Los correos @${STUDENT_DOMAIN} son de alumnos. Use el correo del docente`
    : null);

export const validateName = (label: 'nombre' | 'apellido') => (value: string): string | null => {
  const v = value.trim();
  if (!v) return `Ingrese el ${label}`;
  if (v.length > NAME_MAX_LENGTH) return `El ${label} puede tener hasta ${NAME_MAX_LENGTH} caracteres`;
  if (!NAME_RE.test(v)) return `El ${label} solo puede tener letras, espacios y apóstrofos`;
  return null;
};

export const validateLegajo = (value: string): string | null => {
  if (!value) return 'Ingrese el legajo';
  if (!/^\d+$/.test(value)) return 'El legajo solo puede tener números, sin letras, puntos ni espacios';
  if (Number(value) <= 0) return 'El legajo es un número mayor a cero';
  // La base lo guarda como entero de 32 bits (hasta 2.147.483.647)
  if (Number(value) > 999_999_999) return 'El legajo puede tener hasta 9 dígitos';
  return null;
};

export const validateBirthDate = (value: string, { required = true } = {}): string | null => {
  if (!value) return required ? 'Ingrese la fecha de nacimiento' : null;
  if (value > isoDate(new Date())) return 'La fecha no puede ser posterior a hoy';
  if (value > maxBirthDate()) return `Debe tener al menos ${MIN_AGE} años`;
  // Más de 100 años es casi siempre un año mal tipeado (0200 en vez de 2000)
  if (value < minBirthDate()) return 'Ingrese una fecha válida';
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
  // Un rechazo de validación llega como lista de campos: no se muestra crudo
  if (Array.isArray(err.detail)) return `${fallback}. Revise los datos e intente de nuevo`;
  return err.message || fallback;
};

/**
 * Muestra el error al guardar un docente: un 409 (legajo o correo repetido) va en su campo, que
 * lo saca apenas se corrige; el resto, en el aviso de arriba del formulario.
 */
export const showProfessorSaveError = (
  err: any,
  fallback: string,
  fields: { legajo: { reject: (message: string) => void }; mail: { reject: (message: string) => void } },
  setFormError: (message: string) => void
) => {
  const message = professorSaveError(err, fallback);
  const detail = String(err.message || '').toLowerCase();
  if (err.status === 409 && detail.includes('legajo')) fields.legajo.reject(message);
  else if (err.status === 409 && detail.includes('mail')) fields.mail.reject(message);
  else setFormError(message);
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
  // Rechazo del backend (por ejemplo, legajo repetido): vale para el valor que se envió, así
  // que se va apenas se cambia el campo y vuelve si se escribe el mismo valor.
  const [rejected, setRejected] = useState<{ value: string; message: string } | null>(null);
  const error = (touched ? validate(value) : null) ?? (rejected?.value === value ? rejected.message : null);

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
      setRejected(null);
    },
    /** Muestra en el campo un error que devolvió el backend para el valor actual. */
    reject: (message: string) => setRejected({ value, message }),
    /** Marca el campo como revisado y dice si es válido; se usa al enviar. */
    check: () => {
      setTouched(true);
      return error === null && validate(value) === null;
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
