import { readSheet } from 'read-excel-file/browser';
import type { StudentCreate } from '../types/api';
import {
  validateName,
  validateLegajo,
  validateBirthDate,
  validateEnrollmentYear,
  enrollmentYearRange,
} from './validation';

// Lectura de la planilla de alumnos para el registro masivo (POST /students/bulk).
// Las columnas se buscan por título, así el orden en la planilla no importa.
export const TEMPLATE_URL = '/plantilla-estudiantes.xlsx';
export const MAX_ROWS = 500; // límite del backend por lote

const COLUMNS = {
  legajo: 'Legajo',
  last_name: 'Apellido',
  first_name: 'Nombre',
  birth_date: 'Fecha de nacimiento',
  enrollment_year: 'Año de ingreso',
} as const;
type Column = keyof typeof COLUMNS;

export interface ExcelRow {
  row: number; // número de fila en la planilla (la 1 es la de títulos)
  display: Record<Column, string>;
  student: StudentCreate | null; // null si la fila tiene errores
  errors: string[];
}

export class ExcelFileError extends Error {}

type Cell = string | number | boolean | Date | null | undefined;

const normalize = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

const pad = (n: number) => String(n).padStart(2, '0');

const cellText = (v: Cell): string => {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) {
    // Las fechas de Excel no tienen zona horaria: la librería las devuelve a medianoche UTC
    return `${pad(v.getUTCDate())}/${pad(v.getUTCMonth() + 1)}/${v.getUTCFullYear()}`;
  }
  return String(v).trim();
};

// Acepta una celda de tipo fecha o un texto dd/mm/aaaa (o aaaa-mm-dd); devuelve aaaa-mm-dd,
// 'formato' si no se reconoce o 'inexistente' si no es una fecha real (p. ej. 31/02).
const toIsoDate = (v: Cell): string | 'formato' | 'inexistente' => {
  let y: number, m: number, d: number;
  if (v instanceof Date) {
    [y, m, d] = [v.getUTCFullYear(), v.getUTCMonth() + 1, v.getUTCDate()];
  } else {
    const s = cellText(v);
    const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    const ymd = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (dmy) [d, m, y] = dmy.slice(1).map(Number);
    else if (ymd) [y, m, d] = ymd.slice(1).map(Number);
    else return 'formato';
  }
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) {
    return 'inexistente';
  }
  return `${y}-${pad(m)}-${pad(d)}`;
};

// Una celda de Excel puede ser texto, número, fecha o verdadero/falso. Nombre y apellido
// tienen que ser texto; legajo y año de ingreso, número (o texto con dígitos).
const isText = (v: Cell) => typeof v === 'string';
const isNumeric = (v: Cell) => typeof v === 'number' || typeof v === 'string';

const parseRow = (cells: Cell[], index: Record<Column, number>, row: number): ExcelRow => {
  const get = (c: Column) => cells[index[c]];
  const display = Object.fromEntries(
    (Object.keys(COLUMNS) as Column[]).map((c) => [c, cellText(get(c))])
  ) as Record<Column, string>;
  const errors: string[] = [];

  const legajo = display.legajo;
  if (!legajo) errors.push('Falta el legajo');
  else if (!isNumeric(get('legajo'))) errors.push('El legajo tiene que ser un número');
  else {
    const e = validateLegajo(legajo);
    if (e) errors.push(e);
  }

  for (const [col, label] of [
    ['last_name', 'apellido'],
    ['first_name', 'nombre'],
  ] as const) {
    const value = display[col];
    if (!value) errors.push(`Falta el ${label}`);
    else if (!isText(get(col))) errors.push(`El ${label} tiene que ser texto, no un número ni una fecha`);
    else if (value.length > 100) errors.push(`El ${label} supera los 100 caracteres`);
    else {
      const e = validateName(label)(value);
      if (e) errors.push(e);
    }
  }

  let birthDate: string | null = null;
  if (!display.birth_date) errors.push('Falta la fecha de nacimiento');
  else {
    birthDate = toIsoDate(get('birth_date'));
    const e =
      birthDate === 'formato'
        ? 'La fecha de nacimiento debe tener el formato dd/mm/aaaa'
        : birthDate === 'inexistente'
        ? 'La fecha de nacimiento no existe'
        : validateBirthDate(birthDate);
    if (e) {
      errors.push(e);
      birthDate = null;
    }
  }

  const year = display.enrollment_year;
  if (!year) errors.push('Falta el año de ingreso');
  else if (!isNumeric(get('enrollment_year')) || !/^\d{4}$/.test(year)) {
    errors.push('El año de ingreso debe ser un número de 4 cifras, por ejemplo 2024');
  } else if (birthDate) {
    const range = enrollmentYearRange(birthDate);
    if (range && validateEnrollmentYear(year, birthDate)) {
      errors.push(`El año de ingreso debe estar entre ${range.min} y ${range.max}`);
    }
  }

  const student =
    errors.length === 0
      ? {
          legajo: Number(legajo),
          last_name: display.last_name,
          first_name: display.first_name,
          birth_date: birthDate!,
          enrollment_year: Number(year),
        }
      : null;
  return { row, display, student, errors };
};

export const readStudentsExcel = async (file: File): Promise<ExcelRow[]> => {
  let data: Cell[][];
  try {
    data = (await readSheet(file)) as Cell[][];
  } catch {
    throw new ExcelFileError('No se pudo leer el archivo. Verifique que sea un Excel (.xlsx) válido');
  }

  const headerIndex = data.findIndex((r) => r.some((c) => cellText(c)));
  if (headerIndex === -1) throw new ExcelFileError('El archivo está vacío');

  const headers = data[headerIndex].map((c) => normalize(cellText(c)));
  const index = {} as Record<Column, number>;
  const missing: string[] = [];
  for (const [col, title] of Object.entries(COLUMNS) as [Column, string][]) {
    const i = headers.indexOf(normalize(title));
    if (i === -1) missing.push(title);
    index[col] = i;
  }
  if (missing.length) {
    throw new ExcelFileError(
      `Faltan columnas: ${missing.join(', ')}. Descargue la plantilla para ver el formato`
    );
  }

  const rows = data
    .map((cells, i) => ({ cells, row: i + 1 }))
    .slice(headerIndex + 1)
    .filter(({ cells }) => cells.some((c) => cellText(c)));
  if (rows.length === 0) throw new ExcelFileError('La planilla no tiene alumnos debajo de los títulos');
  if (rows.length > MAX_ROWS) {
    throw new ExcelFileError(
      `La planilla tiene ${rows.length} alumnos; se pueden registrar hasta ${MAX_ROWS} por archivo`
    );
  }

  const parsed = rows.map(({ cells, row }) => parseRow(cells, index, row));

  // Legajo repetido dentro del mismo archivo
  const firstRow = new Map<number, number>();
  for (const r of parsed) {
    if (!r.student) continue;
    const seen = firstRow.get(r.student.legajo);
    if (seen === undefined) firstRow.set(r.student.legajo, r.row);
    else markError(r, `Legajo repetido en el archivo (ya está en la fila ${seen})`);
  }
  return parsed;
};

export const markError = (r: ExcelRow, message: string) => {
  r.errors.push(message);
  r.student = null;
};
