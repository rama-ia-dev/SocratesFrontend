import { useEffect, useState } from 'react';

// Feriados nacionales de Argentina. El backend no los guarda (un feriado es un día sin clases), así
// que se consultan en ArgentinaDatos, un proyecto abierto que recopila los feriados y días no
// laborables que publica el Gobierno nacional en sus decretos. Si no responde, se calculan por la
// Ley 27.399, que no incluye los días puente que se decretan cada año.

export interface Holiday {
  date: string; // ISO
  name: string;
}

export type HolidaySource = 'argentinadatos' | 'law';

export interface HolidayYear {
  holidays: Holiday[];
  source: HolidaySource;
}

const API_URL = 'https://api.argentinadatos.com/v1/feriados';

const pad = (n: number) => String(n).padStart(2, '0');
const isoOf = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

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

/** Feriados de la Ley 27.399 (sin días puente). */
export const lawHolidaysOf = (year: number): Holiday[] => {
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
  return list
    .map(([date, name]) => ({ date: isoOf(date), name }))
    .sort((a, b) => a.date.localeCompare(b.date));
};

// Para no consultar ArgentinaDatos en cada recarga, lo que responde se guarda en el navegador por
// una semana (los feriados de un año casi no cambian). Los de la ley no se guardan: si la API no
// respondió, se vuelve a intentar en la próxima carga.
const STORAGE_PREFIX = 'socrates:feriados:';
const STORAGE_DAYS = 7;

const readStored = (year: number): Holiday[] | null => {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${year}`);
    if (!raw) return null;
    const { savedAt, holidays } = JSON.parse(raw) as { savedAt: number; holidays: Holiday[] };
    if (Date.now() - savedAt > STORAGE_DAYS * 24 * 60 * 60 * 1000 || !Array.isArray(holidays)) return null;
    return holidays;
  } catch {
    return null;
  }
};

const store = (year: number, holidays: Holiday[]) => {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${year}`, JSON.stringify({ savedAt: Date.now(), holidays }));
  } catch {
    // Sin almacenamiento (modo privado, espacio lleno): se consulta en cada carga
  }
};

// Una consulta por año mientras dure la página, y entre recargas lo guardado en el navegador
const cache = new Map<number, Promise<HolidayYear>>();

export const fetchHolidays = (year: number): Promise<HolidayYear> => {
  let pending = cache.get(year);
  if (!pending) {
    const stored = readStored(year);
    if (stored) {
      pending = Promise.resolve({ holidays: stored, source: 'argentinadatos' as const });
      cache.set(year, pending);
      return pending;
    }
    pending = fetch(`${API_URL}/${year}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((rows: { fecha: string; nombre: string }[]) => {
        if (!Array.isArray(rows) || rows.length === 0) throw new Error('Sin datos');
        // Puede haber dos filas el mismo día: se queda la primera
        const byDate = new Map<string, Holiday>();
        for (const r of rows) if (!byDate.has(r.fecha)) byDate.set(r.fecha, { date: r.fecha, name: r.nombre });
        const holidays = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
        store(year, holidays);
        return { holidays, source: 'argentinadatos' as const };
      })
      .catch(() => ({ holidays: lawHolidaysOf(year), source: 'law' as const }));
    cache.set(year, pending);
  }
  return pending;
};

export const SOURCE_TEXT: Record<HolidaySource, string> = {
  argentinadatos:
    'Fuente: ArgentinaDatos, que recopila los feriados y días no laborables publicados por el Gobierno nacional.',
  law: 'No se pudo consultar ArgentinaDatos: se calcularon por la Ley 27.399 y pueden faltar los días puente del año.',
};

/** Feriados de varios años como fecha → nombre. Mientras cargan, el mapa está vacío. */
export const useHolidays = (years: number[]) => {
  const key = [...new Set(years)].sort().join(',');
  const [map, setMap] = useState<Record<string, string>>({});
  const [source, setSource] = useState<HolidaySource | null>(null);

  useEffect(() => {
    let alive = true;
    const list = key ? key.split(',').map(Number) : [];
    Promise.all(list.map(fetchHolidays)).then((results) => {
      if (!alive) return;
      const next: Record<string, string> = {};
      for (const r of results) for (const h of r.holidays) next[h.date] = h.name;
      setMap(next);
      setSource(results.some((r) => r.source === 'law') ? 'law' : results.length ? 'argentinadatos' : null);
    });
    return () => {
      alive = false;
    };
  }, [key]);

  return { holidays: map, source };
};
