// Feriados nacionales de Argentina (Ley 27.399), calculados en el navegador mientras no exista
// un calendario en el backend. Los días puente se decretan cada año: solo están los de 2026.

const pad = (n: number) => String(n).padStart(2, '0');
export const toIso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

const addDays = (date: Date, days: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

const isoOf = (date: Date) => toIso(date.getFullYear(), date.getMonth(), date.getDate());

// Domingo de Pascua (algoritmo de Meeus/Jones/Butcher, calendario gregoriano)
const easterOf = (year: number): Date => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
};

// Feriado trasladable: martes y miércoles pasan al lunes anterior; jueves y viernes, al siguiente
const movable = (year: number, month: number, day: number): Date => {
  const date = new Date(year, month, day);
  const weekday = date.getDay();
  if (weekday === 2 || weekday === 3) return addDays(date, 1 - weekday);
  if (weekday === 4 || weekday === 5) return addDays(date, 8 - weekday);
  return date;
};

const BRIDGE_DAYS: Record<number, string[]> = {
  2026: ['2026-03-23', '2026-07-10', '2026-12-07'],
};

/** Feriados del año: fecha ISO → nombre. */
export const holidaysOf = (year: number): Record<string, string> => {
  const easter = easterOf(year);
  const list: [Date, string][] = [
    [new Date(year, 0, 1), 'Año Nuevo'],
    [addDays(easter, -48), 'Carnaval'],
    [addDays(easter, -47), 'Carnaval'],
    [new Date(year, 2, 24), 'Día de la Memoria por la Verdad y la Justicia'],
    [new Date(year, 3, 2), 'Día del Veterano y de los Caídos en Malvinas'],
    [addDays(easter, -2), 'Viernes Santo'],
    [new Date(year, 4, 1), 'Día del Trabajador'],
    [new Date(year, 4, 25), 'Revolución de Mayo'],
    [movable(year, 5, 17), 'Paso a la Inmortalidad de Güemes'],
    [new Date(year, 5, 20), 'Paso a la Inmortalidad de Belgrano'],
    [new Date(year, 6, 9), 'Día de la Independencia'],
    [movable(year, 7, 17), 'Paso a la Inmortalidad de San Martín'],
    [movable(year, 9, 12), 'Día del Respeto a la Diversidad Cultural'],
    [movable(year, 10, 20), 'Día de la Soberanía Nacional'],
    [new Date(year, 11, 8), 'Inmaculada Concepción de María'],
    [new Date(year, 11, 25), 'Navidad'],
  ];
  const holidays: Record<string, string> = {};
  for (const [date, name] of list) holidays[isoOf(date)] = name;
  for (const iso of BRIDGE_DAYS[year] ?? []) holidays[iso] = 'Día no laborable con fines turísticos';
  return holidays;
};
