import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { fetchHolidays, Holiday, HolidaySource, SOURCE_TEXT } from '../lib/holidays';
import { SectionYearPublic } from '../types/api';
import { Modal } from './ui/Modal';
import { Alert } from './ui/Alert';
import { Button } from './ui/Button';
import { Select } from './ui/Select';
import { useToast } from './ui/Toast';

type Course = Pick<SectionYearPublic, 'id_section_year' | 'year' | 'section_name'>;

// Clase de un curso lectivo que cae en una fecha
type DayClass = { id_calendar_class: number; id_section_year: number; section_name: string };

const pad = (n: number) => String(n).padStart(2, '0');
const now = new Date();
const todayIso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

const WEEKDAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const dateText = (iso: string) => {
  const date = new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
  return `${WEEKDAY_NAMES[date.getDay()]} ${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
};

export interface RegisterHolidaysModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Cursos lectivos del año en curso o posteriores. */
  courses: Course[];
  onDone: () => void;
}

/**
 * El backend no guarda feriados: un feriado es un día sin clases. Registrarlos es quitar las clases de
 * esas fechas en todos los cursos lectivos del año. Solo se tocan fechas posteriores a hoy, porque
 * quitar una clase borra también su asistencia.
 */
export const RegisterHolidaysModal: React.FC<RegisterHolidaysModalProps> = ({ isOpen, onClose, courses, onDone }) => {
  const { success } = useToast();

  const years = useMemo(() => [...new Set(courses.map((c) => c.year))].sort((a, b) => a - b), [courses]);
  const [year, setYear] = useState<number | null>(null);

  const [holidays, setHolidays] = useState<Holiday[] | null>(null);
  const [source, setSource] = useState<HolidaySource | null>(null);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [classesByDate, setClassesByDate] = useState<Record<string, DayClass[]> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    setYear(years[0] ?? null);
    setSaveError(null);
  }, [isOpen, years]);

  // Feriados del año y clases de los cursos lectivos de ese año a partir de mañana
  useEffect(() => {
    if (!isOpen || year === null) return;
    let alive = true;
    setHolidays(null);
    setClassesByDate(null);
    setLoadError(null);
    const ofYear = courses.filter((c) => c.year === year);
    const from = todayIso >= `${year}-01-01` ? todayIso : `${year}-01-01`;
    Promise.all([
      fetchHolidays(year),
      Promise.all(ofYear.map((c) => api.getSectionYearCalendar(c.id_section_year, { from, to: `${year}-12-31` }))),
    ])
      .then(([result, calendars]) => {
        if (!alive) return;
        setHolidays(result.holidays);
        setSource(result.source);
        const map: Record<string, DayClass[]> = {};
        calendars.forEach((cal, i) => {
          for (const c of cal.classes) {
            if (c.date <= todayIso) continue;
            (map[c.date] ??= []).push({
              id_calendar_class: c.id_calendar_class,
              id_section_year: ofYear[i].id_section_year,
              section_name: ofYear[i].section_name,
            });
          }
        });
        setClassesByDate(map);
        // Por defecto se eligen todos los feriados que todavía no pasaron
        setSelected(new Set(result.holidays.filter((h) => h.date > todayIso).map((h) => h.date)));
      })
      .catch(() => alive && setLoadError('No se pudieron cargar las clases de los cursos lectivos'));
    return () => {
      alive = false;
    };
  }, [isOpen, year, courses, reloadKey]);

  const days = holidays ?? [];

  const toggle = (iso: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(iso)) next.delete(iso);
      else next.add(iso);
      return next;
    });

  const toRemove = useMemo(
    () => [...selected].flatMap((iso) => classesByDate?.[iso] ?? []),
    [selected, classesByDate]
  );
  const coursesTouched = new Set(toRemove.map((c) => c.id_section_year)).size;

  const handleConfirm = async () => {
    setSaving(true);
    setSaveError(null);
    // Un pedido por curso lectivo; si alguno falla, los demás igual se aplican
    const byCourse = new Map<number, DayClass[]>();
    for (const c of toRemove) byCourse.set(c.id_section_year, [...(byCourse.get(c.id_section_year) ?? []), c]);
    const results = await Promise.allSettled(
      [...byCourse].map(([id, list]) => api.deleteCalendarClasses(id, list.map((c) => c.id_calendar_class)))
    );
    const failed = [...byCourse].filter((_, i) => results[i].status === 'rejected').map(([, list]) => list[0].section_name);
    const removed = [...byCourse].reduce((n, [, list], i) => n + (results[i].status === 'fulfilled' ? list.length : 0), 0);
    setSaving(false);
    onDone();
    if (removed > 0) success(removed === 1 ? 'Se quitó 1 clase' : `Se quitaron ${removed} clases`);
    if (failed.length > 0) {
      setSaveError(`No se pudieron quitar las clases de ${failed.join(', ')}. Intente de nuevo.`);
      // Se recargan las clases para mostrar lo que quedó
      setReloadKey((k) => k + 1);
      return;
    }
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={() => !saving && onClose()} title="Registrar feriados" maxWidth="xl">
      <p className="text-sm text-ink-muted">
        Se quitan las clases de los días elegidos en todos los cursos lectivos del año, con su asistencia si la
        tuvieran. Las fechas que ya pasaron no se modifican. Los feriados se muestran siempre en el calendario.
      </p>

      <div className="mt-4 w-40">
        <Select
          id="feriados-anio"
          label="Año"
          value={year ?? ''}
          onChange={(e) => setYear(Number(e.target.value))}
          options={years.map((y) => ({ value: y, label: String(y) }))}
          disabled={saving}
        />
      </div>

      {loadError && <Alert className="mt-4">{loadError}</Alert>}
      {saveError && <Alert className="mt-4">{saveError}</Alert>}

      {!loadError && (holidays === null || classesByDate === null) ? (
        <p className="mt-4 text-sm text-ink-muted">Buscando feriados y clases…</p>
      ) : (
        !loadError && (
          <>
            {source && <p className="mt-3 text-xs text-ink-muted">{SOURCE_TEXT[source]}</p>}

            <ul className="mt-3 max-h-80 overflow-y-auto divide-y divide-line rounded-lg border border-line">
              {days.map((d) => {
                const past = d.date <= todayIso;
                const dayClasses = classesByDate?.[d.date] ?? [];
                return (
                  <li key={d.date} className={`flex items-center gap-3 px-3 py-2.5 ${past ? 'opacity-60' : ''}`}>
                    <input
                      type="checkbox"
                      className="w-4 h-4 accent-primary"
                      aria-label={`${d.name}, ${dateText(d.date)}`}
                      checked={!past && selected.has(d.date)}
                      disabled={past || saving}
                      onChange={() => toggle(d.date)}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-ink">
                        <span className="tabular-nums">{dateText(d.date)}</span> · {d.name}
                      </p>
                      <p className="text-xs text-ink-muted">
                        {past
                          ? 'Ya pasó'
                          : dayClasses.length === 0
                            ? 'Sin clases cargadas'
                            : `${dayClasses.length} ${dayClasses.length === 1 ? 'clase' : 'clases'}: ${[
                                ...new Set(dayClasses.map((c) => c.section_name)),
                              ].join(', ')}`}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )
      )}

      <div className="mt-4 flex flex-wrap items-center justify-end gap-3 pt-3 border-t border-line">
        <p className="mr-auto text-sm text-ink-muted">
          {classesByDate === null
            ? ''
            : toRemove.length === 0
              ? 'Ningún día elegido tiene clases cargadas.'
              : `Se van a quitar ${toRemove.length} ${toRemove.length === 1 ? 'clase' : 'clases'} de ${coursesTouched} ${
                  coursesTouched === 1 ? 'curso lectivo' : 'cursos lectivos'
                }.`}
        </p>
        <Button variant="outline" onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button variant="destructive" onClick={handleConfirm} isLoading={saving} disabled={toRemove.length === 0}>
          Quitar clases
        </Button>
      </div>
    </Modal>
  );
};
