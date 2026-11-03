import readXlsxFile from 'read-excel-file/browser';
import type { ActivityCreate, CalendarClassCreate, ClassModality } from '../types/api';

// Lectura de la planilla del calendario para la carga en lote (POST /section-years/{id}/calendar/bulk).
// La planilla tiene una hoja "Clases" y una "Entregas"; las columnas se buscan por título, así el
// orden no importa. Puede faltar una de las dos hojas, pero no las dos.
export const TEMPLATE_URL = '/plantilla-calendario.xlsx';
// Límites del backend por carga
export const MAX_CLASSES = 1000;
export const MAX_ACTIVITIES = 200;

const CLASS_SHEET = 'Clases';
const ACTIVITY_SHEET = 'Entregas';

const CLASS_COLUMNS = {
  date: 'Fecha',
  start: 'Hora de inicio',
  end: 'Hora de fin',
  modality: 'Modalidad',
  title: 'Título',
  location: 'Aula',
  meeting_url: 'Link',
} as const;
type ClassColumn = keyof typeof CLASS_COLUMNS;
const CLASS_REQUIRED: ClassColumn[] = ['date', 'start', 'end'];

const ACTIVITY_COLUMNS = {
  date: 'Fecha',
  time: 'Hora límite',
  title: 'Título',
  description: 'Descripción',
} as const;
type ActivityColumn = keyof typeof ACTIVITY_COLUMNS;
const ACTIVITY_REQUIRED: ActivityColumn[] = ['date', 'title'];

export interface ClassRow {
  kind: 'class';
  row: number; // número de fila en la hoja (la de títulos es la 1)
  display: Record<ClassColumn, string>;
  data: CalendarClassCreate | null; // null si la fila tiene errores de formato
  errors: string[];
}

export interface ActivityRow {
  kind: 'activity';
  row: number;
  display: Record<ActivityColumn, string>;
  data: ActivityCreate | null;
  errors: string[];
}

export type CalendarExcelRow = ClassRow | ActivityRow;

export interface CalendarExcel {
  classes: ClassRow[];
  activities: ActivityRow[];
}

export class ExcelFileError extends Error {}

type Cell = string | number | boolean | Date | null | undefined;

const normalize = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

const pad = (n: number) => String(n).padStart(2, '0');

// Las celdas de hora que Excel guarda como fecha llegan como el 30/12/1899 a esa hora (UTC)
const isTimeOnly = (d: Date) => d.getUTCFullYear() < 1900;

const cellText = (v: Cell): string => {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) {
    if (isTimeOnly(v)) return `${pad(v.getUTCHours())}:${pad(v.getUTCMinutes())}`;
    // Las fechas de Excel no tienen zona horaria: la librería las devuelve a medianoche UTC
    return `${pad(v.getUTCDate())}/${pad(v.getUTCMonth() + 1)}/${v.getUTCFullYear()}`;
  }
  return String(v).trim();
};

// Acepta una celda de tipo fecha o un texto dd/mm/aaaa (o aaaa-mm-dd); devuelve aaaa-mm-dd o el error
const toIsoDate = (v: Cell): { value: string } | { error: string } => {
  let y: number, m: number, d: number;
  if (v instanceof Date && !isTimeOnly(v)) {
    [y, m, d] = [v.getUTCFullYear(), v.getUTCMonth() + 1, v.getUTCDate()];
  } else {
    const s = cellText(v);
    const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    const ymd = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (dmy) [d, m, y] = dmy.slice(1).map(Number);
    else if (ymd) [y, m, d] = ymd.slice(1).map(Number);
    else return { error: 'La fecha debe tener el formato dd/mm/aaaa' };
  }
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) {
    return { error: 'La fecha no existe' };
  }
  return { value: `${y}-${pad(m)}-${pad(d)}` };
};

// Acepta una celda de tipo hora, la fracción de día con la que Excel guarda las horas o un texto
// hh:mm (con "hs" opcional, y entonces también solo la hora: "18 hs"); devuelve HH:MM o null si no
// se reconoce
const toTime = (v: Cell): string | null => {
  let h: number, m: number;
  if (v instanceof Date) {
    [h, m] = [v.getUTCHours(), v.getUTCMinutes()];
  } else if (typeof v === 'number' && v >= 0 && v < 1) {
    const minutes = Math.round(v * 24 * 60);
    [h, m] = [Math.floor(minutes / 60), minutes % 60];
  } else {
    const text = cellText(v).toLowerCase();
    const bare = text.replace(/\s*(hs|h)\.?$/, '');
    const match = bare.match(/^(\d{1,2})[:.](\d{2})(?::\d{2})?$/);
    const hourOnly = bare !== text ? bare.match(/^(\d{1,2})$/) : null;
    if (match) [h, m] = [Number(match[1]), Number(match[2])];
    else if (hourOnly) [h, m] = [Number(hourOnly[1]), 0];
    else return null;
  }
  if (h > 23 || m > 59) return null;
  return `${pad(h)}:${pad(m)}`;
};

const MODALITIES: Record<string, ClassModality> = {
  presencial: 'in_person',
  virtual: 'virtual',
};

const isHttpUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

// Busca la fila de títulos y devuelve las filas con datos debajo de ella
const readTable = <C extends string>(
  data: Cell[][],
  columns: Record<C, string>,
  required: C[],
  sheet: string
) => {
  const headerIndex = data.findIndex((r) => r.some((c) => cellText(c)));
  if (headerIndex === -1) return { index: null, rows: [] };

  const headers = data[headerIndex].map((c) => normalize(cellText(c)));
  const index = {} as Record<C, number>;
  for (const [col, title] of Object.entries(columns) as [C, string][]) {
    index[col] = headers.indexOf(normalize(title));
  }
  const missing = required.filter((c) => index[c] === -1).map((c) => columns[c]);
  if (missing.length) {
    throw new ExcelFileError(
      `En la hoja ${sheet} faltan columnas: ${missing.join(', ')}. Descargue la plantilla para ver el formato`
    );
  }

  const rows = data
    .map((cells, i) => ({ cells, row: i + 1 }))
    .slice(headerIndex + 1)
    .filter(({ cells }) => cells.some((c) => cellText(c)));
  return { index, rows };
};

const parseClass = (cells: Cell[], index: Record<ClassColumn, number>, row: number): ClassRow => {
  const get = (c: ClassColumn) => (index[c] === -1 ? null : cells[index[c]]);
  const display = Object.fromEntries(
    (Object.keys(CLASS_COLUMNS) as ClassColumn[]).map((c) => [c, cellText(get(c))])
  ) as Record<ClassColumn, string>;
  const errors: string[] = [];

  let date: string | null = null;
  if (!display.date) errors.push('Falta la fecha');
  else {
    const parsed = toIsoDate(get('date'));
    if ('error' in parsed) errors.push(parsed.error);
    else date = parsed.value;
  }

  const start = display.start ? toTime(get('start')) : null;
  const end = display.end ? toTime(get('end')) : null;
  if (!display.start) errors.push('Falta la hora de inicio');
  else if (!start) errors.push('La hora de inicio debe tener el formato hh:mm');
  if (!display.end) errors.push('Falta la hora de fin');
  else if (!end) errors.push('La hora de fin debe tener el formato hh:mm');
  if (start && end && end <= start) errors.push('La hora de fin debe ser posterior a la de inicio');
  if (start) display.start = start;
  if (end) display.end = end;

  // Sin modalidad, la clase es presencial (como en el formulario)
  let modality: ClassModality = 'in_person';
  if (display.modality) {
    const value = MODALITIES[normalize(display.modality)];
    if (value) modality = value;
    else errors.push('La modalidad debe ser Presencial o Virtual');
  }

  if (display.title.length > 100) errors.push('El título supera los 100 caracteres');
  if (display.location.length > 200) errors.push('El aula supera los 200 caracteres');
  if (display.meeting_url) {
    if (display.meeting_url.length > 500) errors.push('El link supera los 500 caracteres');
    else if (!isHttpUrl(display.meeting_url)) errors.push('El link debe empezar con http:// o https://');
  }

  const data: CalendarClassCreate | null =
    errors.length === 0
      ? {
          date: date!,
          start_time: start!,
          end_time: end!,
          modality,
          title: display.title || null,
          location: display.location || null,
          meeting_url: display.meeting_url || null,
        }
      : null;
  return { kind: 'class', row, display, data, errors };
};

const parseActivity = (cells: Cell[], index: Record<ActivityColumn, number>, row: number): ActivityRow => {
  const get = (c: ActivityColumn) => (index[c] === -1 ? null : cells[index[c]]);
  const display = Object.fromEntries(
    (Object.keys(ACTIVITY_COLUMNS) as ActivityColumn[]).map((c) => [c, cellText(get(c))])
  ) as Record<ActivityColumn, string>;
  const errors: string[] = [];

  let date: string | null = null;
  if (!display.date) errors.push('Falta la fecha');
  else {
    const parsed = toIsoDate(get('date'));
    if ('error' in parsed) errors.push(parsed.error);
    else date = parsed.value;
  }

  // La hora límite es opcional: sin ella, la entrega vence al final del día
  let time: string | null = null;
  if (display.time) {
    time = toTime(get('time'));
    if (!time) errors.push('La hora límite debe tener el formato hh:mm');
    else display.time = time;
  }

  if (!display.title) errors.push('Falta el título');
  else if (display.title.length > 200) errors.push('El título supera los 200 caracteres');

  const data: ActivityCreate | null =
    errors.length === 0
      ? { title: display.title, description: display.description || null, due_date: date!, due_time: time }
      : null;
  return { kind: 'activity', row, display, data, errors };
};

export const readCalendarExcel = async (file: File): Promise<CalendarExcel> => {
  let sheets: { sheet: string; data: Cell[][] }[];
  try {
    sheets = (await readXlsxFile(file)) as unknown as { sheet: string; data: Cell[][] }[];
  } catch {
    throw new ExcelFileError('No se pudo leer el archivo. Verifique que sea un Excel (.xlsx) válido');
  }

  const find = (name: string) => sheets.find((s) => normalize(s.sheet) === normalize(name));
  const classSheet = find(CLASS_SHEET);
  const activitySheet = find(ACTIVITY_SHEET);
  if (!classSheet && !activitySheet) {
    throw new ExcelFileError(
      'El archivo no tiene las hojas Clases ni Entregas. Descargue la plantilla para ver el formato'
    );
  }

  const classTable = classSheet
    ? readTable(classSheet.data, CLASS_COLUMNS, CLASS_REQUIRED, CLASS_SHEET)
    : { index: null, rows: [] };
  const activityTable = activitySheet
    ? readTable(activitySheet.data, ACTIVITY_COLUMNS, ACTIVITY_REQUIRED, ACTIVITY_SHEET)
    : { index: null, rows: [] };

  if (classTable.rows.length === 0 && activityTable.rows.length === 0) {
    throw new ExcelFileError('La planilla no tiene clases ni entregas debajo de los títulos');
  }
  if (classTable.rows.length > MAX_CLASSES) {
    throw new ExcelFileError(
      `La planilla tiene ${classTable.rows.length} clases; se pueden cargar hasta ${MAX_CLASSES} por archivo`
    );
  }
  if (activityTable.rows.length > MAX_ACTIVITIES) {
    throw new ExcelFileError(
      `La planilla tiene ${activityTable.rows.length} entregas; se pueden cargar hasta ${MAX_ACTIVITIES} por archivo`
    );
  }

  return {
    classes: classTable.rows.map(({ cells, row }) => parseClass(cells, classTable.index!, row)),
    activities: activityTable.rows.map(({ cells, row }) => parseActivity(cells, activityTable.index!, row)),
  };
};

const isoWeekday = (iso: string) =>
  ((new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))).getDay() + 6) % 7) + 1;

const dateOf = (r: CalendarExcelRow) => (r.kind === 'class' ? r.data?.date : r.data?.due_date);

/**
 * Reglas que dependen del curso lectivo elegido: la fecha tiene que ser de su año y no puede caer en
 * domingo ni en feriado. Además, dos clases de la planilla no pueden superponerse. Devuelve copias:
 * los errores de formato quedan y se suman estos.
 */
export const checkRows = (excel: CalendarExcel, year: number, holidays: Record<string, string>): CalendarExcel => {
  const check = <R extends CalendarExcelRow>(r: R): R => {
    const errors = [...r.errors];
    const date = dateOf(r);
    if (date) {
      if (Number(date.slice(0, 4)) !== year) errors.push(`La fecha debe ser del año del curso lectivo (${year})`);
      else if (isoWeekday(date) === 7) errors.push('Es domingo: elija un día hábil');
      else if (holidays[date]) errors.push(`Es feriado: ${holidays[date]}`);
    }
    return { ...r, errors };
  };
  const classes = excel.classes.map(check);
  const activities = excel.activities.map(check);

  // Clases de la planilla que se superponen entre sí (el mismo día, con horarios que se cruzan)
  const byDate = new Map<string, ClassRow[]>();
  for (const r of classes) if (r.data && r.errors.length === 0) {
    const list = byDate.get(r.data.date) ?? [];
    list.push(r);
    byDate.set(r.data.date, list);
  }
  for (const list of byDate.values()) {
    for (const r of list) {
      const other = list.find(
        (o) => o !== r && o.data!.start_time < r.data!.end_time && r.data!.start_time < o.data!.end_time
      );
      if (other) r.errors.push(`Se superpone con la clase de la fila ${other.row}`);
    }
  }
  return { classes, activities };
};

export const isValidRow = (r: CalendarExcelRow) => r.data !== null && r.errors.length === 0;
