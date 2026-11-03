import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, UploadCloud, X } from 'lucide-react';
import { api } from '../lib/api';
import { useHolidays } from '../lib/holidays';
import {
  checkRows,
  ExcelFileError,
  isValidRow,
  readCalendarExcel,
  TEMPLATE_URL,
  MAX_ACTIVITIES,
  MAX_CLASSES,
  type CalendarExcel,
  type CalendarExcelRow,
} from '../lib/calendarExcel';
import { SectionYearPublic } from '../types/api';
import { Modal } from './ui/Modal';
import { Alert } from './ui/Alert';
import { Button } from './ui/Button';
import { Select } from './ui/Select';
import { useToast } from './ui/Toast';

type Course = Pick<SectionYearPublic, 'id_section_year' | 'year' | 'section_name'>;
type Kind = CalendarExcelRow['kind'];

// Errores que devuelve el backend para una fila de la carga (la fila es la posición en el arreglo enviado)
type ServerErrors = Record<string, string[]>;
const rowKey = (kind: Kind, index: number) => `${kind}-${index}`;

const translate = (detail: string): string => {
  const existing = detail.match(/existing class.*\((\d{2}:\d{2})(?::\d{2})?-(\d{2}:\d{2})/);
  if (existing) return `Se superpone con una clase ya cargada (${existing[1]} a ${existing[2]})`;
  if (detail.includes('existing class')) return 'Se superpone con una clase ya cargada';
  if (detail.includes('another class')) return 'Se superpone con otra clase de la planilla';
  if (detail.includes('section year')) return 'La fecha debe ser del año del curso lectivo';
  if (detail.includes('meeting_url')) return 'El link debe empezar con http:// o https://';
  if (detail.includes('end_time')) return 'La hora de fin debe ser posterior a la de inicio';
  return 'Revise los datos de esta fila';
};

// Errores por fila del backend: los propios de la carga ({kind, row, detail}) o los de validación de
// FastAPI ({loc: ['body', 'classes', i, campo], msg}). Si no son por fila, devuelve null.
const serverRowErrors = (err: any): ServerErrors | null => {
  if (!Array.isArray(err?.detail)) return null;
  const errors: ServerErrors = {};
  const add = (kind: Kind, index: number, message: string) => {
    const key = rowKey(kind, index);
    if (!(errors[key] ??= []).includes(message)) errors[key].push(message);
  };
  for (const item of err.detail) {
    if ((item?.kind === 'class' || item?.kind === 'activity') && Number.isInteger(item.row)) {
      add(item.kind, item.row - 1, translate(String(item.detail ?? '')));
    } else if (Array.isArray(item?.loc) && Number.isInteger(item.loc[2])) {
      const kind: Kind | null = item.loc[1] === 'classes' ? 'class' : item.loc[1] === 'activities' ? 'activity' : null;
      if (kind) add(kind, item.loc[2], translate(String(item.msg ?? '')));
    }
  }
  return Object.keys(errors).length ? errors : null;
};

const generalError = (err: any): string => {
  if (err?.status === 403) return 'Solo un docente del curso lectivo o el administrador puede cargar eventos en él.';
  if (err?.status === 404) return 'El curso lectivo ya no existe. Recargue la página.';
  if (err?.status === 409) return 'El calendario cambió mientras se cargaba. Intente de nuevo.';
  return 'No se pudo cargar el calendario. Intente de nuevo.';
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export interface CalendarExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Cursos lectivos en los que puede registrar eventos (del año en curso o posteriores). */
  courses: Course[];
  /** Curso lectivo elegido al abrir. */
  defaultCourseId: number | null;
  onDone: () => void;
}

/**
 * Carga del calendario de un curso lectivo desde una planilla de Excel, con una hoja de clases y otra
 * de entregas. Se valida primero en el navegador y después con el backend sin guardar (`dry_run`), así
 * la vista previa ya muestra los choques con lo cargado. La carga es todo o nada y se suma a lo que
 * ya tiene el calendario.
 */
export const CalendarExcelModal: React.FC<CalendarExcelModalProps> = ({
  isOpen,
  onClose,
  courses,
  defaultCourseId,
  onDone,
}) => {
  const { success } = useToast();

  const [courseId, setCourseId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [excel, setExcel] = useState<CalendarExcel | null>(null);
  const [reading, setReading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const uploadId = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const [serverErrors, setServerErrors] = useState<ServerErrors>({});
  const [verify, setVerify] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const sortedCourses = useMemo(
    () => [...courses].sort((a, b) => a.year - b.year || a.section_name.localeCompare(b.section_name, 'es')),
    [courses]
  );
  const course = courses.find((c) => c.id_section_year === Number(courseId));

  // Al abrir se empieza de cero, con el curso sugerido (o el único que hay)
  useEffect(() => {
    if (!isOpen) return;
    uploadId.current++;
    const initial = defaultCourseId ?? (courses.length === 1 ? courses[0].id_section_year : null);
    setCourseId(initial ? String(initial) : '');
    setFile(null);
    setExcel(null);
    setReading(false);
    setFileError(null);
    setServerErrors({});
    setVerify('idle');
    setSaveError(null);
  }, [isOpen, defaultCourseId, courses]);

  const { holidays, source } = useHolidays(course ? [course.year] : []);
  const holidaysReady = source !== null;

  // Reglas del curso lectivo (año, domingos, feriados y choques dentro de la planilla)
  const checked = useMemo(
    () => (excel && course && holidaysReady ? checkRows(excel, course.year, holidays) : null),
    [excel, course, holidays, holidaysReady]
  );
  const locallyValid = Boolean(checked && [...checked.classes, ...checked.activities].every(isValidRow));

  const payload = useMemo(
    () =>
      checked && locallyValid
        ? {
            classes: checked.classes.map((r) => r.data!),
            activities: checked.activities.map((r) => r.data!),
          }
        : null,
    [checked, locallyValid]
  );

  // Con la planilla sin errores, el backend la valida sin guardar: así aparecen antes de cargar las
  // clases que chocan con las que ya están en el calendario. Una respuesta vieja se descarta.
  const verifyId = useRef(0);
  useEffect(() => {
    const id = ++verifyId.current;
    setServerErrors({});
    setSaveError(null);
    if (!payload || !course) {
      setVerify('idle');
      return;
    }
    setVerify('checking');
    api
      .bulkLoadCalendar(course.id_section_year, payload, { dryRun: true })
      .then(() => {
        if (id === verifyId.current) setVerify('ok');
      })
      .catch((err) => {
        if (id !== verifyId.current) return;
        const rows = serverRowErrors(err);
        if (rows) setServerErrors(rows);
        else setSaveError(generalError(err));
        setVerify('error');
      });
  }, [payload, course]);

  const rowsOf = <R extends CalendarExcelRow>(list: R[]): R[] =>
    list.map((r, i) => {
      const extra = serverErrors[rowKey(r.kind, i)];
      return extra ? { ...r, errors: [...r.errors, ...extra] } : r;
    });
  const classes = checked ? rowsOf(checked.classes) : (excel?.classes ?? []);
  const activities = checked ? rowsOf(checked.activities) : (excel?.activities ?? []);
  const errorCount = [...classes, ...activities].filter((r) => !isValidRow(r)).length;
  const canSave = verify === 'ok' && errorCount === 0 && !saving;

  const processFile = async (picked: File) => {
    const upload = ++uploadId.current;
    setFileError(null);
    setExcel(null);
    if (!picked.name.toLowerCase().endsWith('.xlsx')) {
      setFile(null);
      setFileError('Solo se admiten archivos Excel (.xlsx)');
      return;
    }
    setFile(picked);
    setReading(true);
    try {
      const result = await readCalendarExcel(picked);
      if (upload !== uploadId.current) return;
      setExcel(result);
    } catch (err) {
      if (upload !== uploadId.current) return;
      setFile(null);
      setFileError(err instanceof ExcelFileError ? err.message : 'No se pudo leer el archivo');
    } finally {
      if (upload === uploadId.current) setReading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    // Se limpia para poder volver a elegir el mismo archivo después de corregirlo
    e.target.value = '';
    if (picked) processFile(picked);
  };

  const removeFile = () => {
    uploadId.current++;
    setFile(null);
    setExcel(null);
    setReading(false);
    setFileError(null);
  };

  const handleSave = async () => {
    if (!canSave || !payload || !course) return;
    setSaving(true);
    setSaveError(null);
    try {
      const report = await api.bulkLoadCalendar(course.id_section_year, payload);
      const parts = [
        report.classes_created && plural(report.classes_created, 'clase', 'clases'),
        report.activities_created && plural(report.activities_created, 'entrega', 'entregas'),
      ].filter(Boolean);
      success(`Se cargaron ${parts.join(' y ')} en ${course.section_name} (${course.year})`);
      onDone();
      onClose();
    } catch (err) {
      // Alguien cargó una clase entre la verificación y la carga: se marcan las filas como en la vista previa
      const rows = serverRowErrors(err);
      if (rows) {
        setServerErrors(rows);
        setVerify('error');
      } else setSaveError(generalError(err));
    } finally {
      setSaving(false);
    }
  };

  const total = classes.length + activities.length;

  return (
    <Modal isOpen={isOpen} onClose={saving ? () => {} : onClose} title="Cargar calendario desde Excel" maxWidth="xl">
      <div className="space-y-4">
        <Select
          id="excel-course"
          label="Curso lectivo"
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          disabled={saving}
          options={[
            { value: '', label: 'Elija un curso lectivo' },
            ...sortedCourses.map((c) => ({ value: c.id_section_year, label: `${c.section_name} (${c.year})` })),
          ]}
        />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-line p-3">
          <p className="text-sm text-ink-muted">
            Complete la hoja Clases (fecha, horario, modalidad, título, aula y link) y la hoja Entregas
            (fecha, hora límite, título y descripción). Hasta {MAX_CLASSES} clases y {MAX_ACTIVITIES} entregas.
          </p>
          <a
            href={TEMPLATE_URL}
            download
            className="shrink-0 inline-flex items-center justify-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-primary hover:bg-tint"
          >
            <Download className="w-4 h-4" aria-hidden />
            Descargar plantilla
          </a>
        </div>

        {/* Archivo */}
        {file && !reading ? (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-lg border border-line p-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 rounded-lg bg-success-soft text-success">
                <FileSpreadsheet className="w-5 h-5" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink truncate">{file.name}</p>
                <p className="text-xs text-ink-muted">
                  {plural(classes.length, 'clase', 'clases')} · {plural(activities.length, 'entrega', 'entregas')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => inputRef.current?.click()} disabled={saving}>
                Reemplazar
              </Button>
              <Button variant="ghostDanger" size="sm" onClick={removeFile} disabled={saving}>
                <X className="w-4 h-4" aria-hidden />
                Quitar
              </Button>
            </div>
          </div>
        ) : (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const dropped = e.dataTransfer.files?.[0];
              if (dropped) processFile(dropped);
            }}
            className={`rounded-xl p-6 text-center transition-colors border-2 ${
              fileError
                ? 'border-danger bg-danger-soft/20'
                : isDragging
                  ? 'border-primary bg-tint'
                  : 'border-dashed border-accent bg-tint-soft'
            }`}
          >
            {reading ? (
              <div className="py-2 max-w-xs mx-auto space-y-3">
                <p className="text-sm font-medium text-ink">Leyendo archivo Excel...</p>
                <div className="w-full bg-accent-light h-2 rounded-full overflow-hidden">
                  <div className="bg-primary h-full w-2/3 animate-pulse" />
                </div>
                <Button variant="outline" size="sm" onClick={removeFile}>
                  Cancelar
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-white shadow-xs border border-accent-light flex items-center justify-center text-primary">
                  <UploadCloud className="w-5 h-5" aria-hidden />
                </div>
                <div>
                  <p className="text-sm font-medium text-ink">Arrastre el archivo aquí o selecciónelo</p>
                  <p className="text-xs text-ink-muted mt-0.5">Archivo Excel (.xlsx)</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
                  Seleccionar archivo
                </Button>
              </div>
            )}
          </div>
        )}
        <input ref={inputRef} type="file" accept=".xlsx" className="hidden" onChange={handleFileChange} />

        {fileError && <Alert>{fileError}</Alert>}

        {/* Vista previa */}
        {excel && (
          <>
            {!course ? (
              <Alert tone="info">Elija el curso lectivo para revisar las fechas de la planilla.</Alert>
            ) : errorCount > 0 ? (
              <Alert>
                {plural(errorCount, 'fila tiene', 'filas tienen')} errores. La carga es de todo o nada: corrija el
                archivo y vuelva a subirlo.
              </Alert>
            ) : verify === 'checking' || !checked ? (
              <Alert tone="info">Revisando la planilla con el calendario del curso lectivo...</Alert>
            ) : verify === 'ok' ? (
              <Alert tone="success">
                Todo listo: se van a sumar {plural(total, 'evento', 'eventos')} al calendario de {course.section_name} (
                {course.year}). Lo que ya está cargado no se modifica.
              </Alert>
            ) : null}

            {classes.length > 0 && (
              <PreviewTable
                title={`Clases (${classes.length})`}
                headers={['Fecha', 'Horario', 'Título', 'Modalidad']}
                rows={classes.map((r) => ({
                  row: r.row,
                  valid: isValidRow(r),
                  errors: r.errors,
                  cells: [
                    r.display.date || '—',
                    r.display.start || r.display.end ? `${r.display.start || '—'} a ${r.display.end || '—'}` : '—',
                    r.display.title || 'Clase',
                    [r.display.modality || 'Presencial', r.display.location].filter(Boolean).join(' · '),
                  ],
                }))}
                showStatus={Boolean(checked)}
              />
            )}
            {activities.length > 0 && (
              <PreviewTable
                title={`Entregas (${activities.length})`}
                headers={['Fecha', 'Hora límite', 'Título']}
                rows={activities.map((r) => ({
                  row: r.row,
                  valid: isValidRow(r),
                  errors: r.errors,
                  cells: [r.display.date || '—', r.display.time || 'Fin del día', r.display.title || '—'],
                }))}
                showStatus={Boolean(checked)}
              />
            )}
          </>
        )}

        {saveError && <Alert>{saveError}</Alert>}

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!canSave} isLoading={saving}>
            {total > 0 ? `Cargar ${plural(total, 'evento', 'eventos')}` : 'Cargar eventos'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

// Tabla de la vista previa: una fila de la planilla por fila, con sus errores debajo de los datos
const PreviewTable: React.FC<{
  title: string;
  headers: string[];
  rows: { row: number; valid: boolean; errors: string[]; cells: string[] }[];
  showStatus: boolean;
}> = ({ title, headers, rows, showStatus }) => (
  <section>
    <h4 className="text-sm font-semibold text-ink mb-2">{title}</h4>
    <div className="max-h-64 overflow-auto rounded-lg border border-line">
      <table className="w-full text-left text-sm text-ink">
        <thead className="sticky top-0 bg-tint border-b border-line text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
          <tr>
            <th className="px-3 py-2 w-12">Fila</th>
            {headers.map((h) => (
              <th key={h} className="px-3 py-2 whitespace-nowrap">
                {h}
              </th>
            ))}
            <th className="px-3 py-2 w-8">
              <span className="sr-only">Estado</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <React.Fragment key={r.row}>
              <tr className={r.valid ? '' : 'bg-danger-soft/30'}>
                <td className="px-3 py-2 font-mono text-xs text-ink-muted align-top">{r.row}</td>
                {r.cells.map((cell, i) => (
                  <td key={i} className={`px-3 py-2 align-top ${i === 0 || i === 1 ? 'whitespace-nowrap tabular-nums' : ''}`}>
                    {cell}
                  </td>
                ))}
                <td className="px-3 py-2 align-top">
                  {r.valid
                    ? showStatus && <CheckCircle2 className="w-4 h-4 text-success" aria-label="Válida" />
                    : <AlertCircle className="w-4 h-4 text-danger" aria-label="Con error" />}
                </td>
              </tr>
              {!r.valid && (
                <tr className="bg-danger-soft/30">
                  <td />
                  <td colSpan={headers.length + 1} className="px-3 pb-2 pt-0">
                    <ul className="space-y-0.5">
                      {r.errors.map((msg) => (
                        <li key={msg} className="text-xs font-semibold text-danger">
                          {msg}
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  </section>
);
