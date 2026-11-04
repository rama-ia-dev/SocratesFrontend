import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { ClassModality, SectionYearPublic } from '../types/api';
import { Modal } from './ui/Modal';
import { Alert } from './ui/Alert';
import { Button } from './ui/Button';
import { Input, FieldLabel, fieldClasses } from './ui/Input';
import { Select } from './ui/Select';
import { DateField } from './ui/DateField';
import { TimeField } from './ui/TimeField';
import { SegmentedControl } from './ui/SegmentedControl';
import { useToast } from './ui/Toast';
import { useHolidays } from '../lib/holidays';

type Course = Pick<SectionYearPublic, 'id_section_year' | 'year' | 'section_name'>;

// Tipos que hoy permite el backend: una clase del calendario o una actividad (entrega)
type Kind = 'class' | 'delivery';

const KIND_OPTIONS: { value: Kind; label: string }[] = [
  { value: 'class', label: 'Clase' },
  { value: 'delivery', label: 'Entrega' },
];

const MODALITY_OPTIONS: { value: ClassModality; label: string }[] = [
  { value: 'in_person', label: 'Presencial' },
  { value: 'virtual', label: 'Virtual' },
];

// Días en ISO (1 = lunes ... 7 = domingo), como los pide el backend. El domingo no se ofrece para
// las clases que se repiten.
const WEEKDAYS = [
  { value: 1, short: 'Lu', name: 'lunes' },
  { value: 2, short: 'Ma', name: 'martes' },
  { value: 3, short: 'Mi', name: 'miércoles' },
  { value: 4, short: 'Ju', name: 'jueves' },
  { value: 5, short: 'Vi', name: 'viernes' },
  { value: 6, short: 'Sá', name: 'sábado' },
];
const SUNDAY = 7;

const isoToDate = (iso: string) =>
  new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
const isoWeekday = (iso: string) => ((isoToDate(iso).getDay() + 6) % 7) + 1;
const dayMonth = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

// Fechas entre `from` y `to` que caen en los días elegidos
const datesBetween = (from: string, to: string, weekdays: number[]) => {
  const dates: string[] = [];
  const date = isoToDate(from);
  const end = isoToDate(to);
  while (date <= end) {
    if (weekdays.includes(((date.getDay() + 6) % 7) + 1)) {
      dates.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`);
    }
    date.setDate(date.getDate() + 1);
  }
  return dates;
};

// Máximo de clases por carga en lote que acepta el backend
const MAX_BULK_CLASSES = 1000;

const isHttpUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

const listText = (items: string[]) =>
  items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`;

// Error del backend → mensaje para el docente. `sentDates` son las fechas de una carga en lote, cuyos
// conflictos vienen por número de fila (desde 1).
const errorMessage = (err: any, course: Course | undefined, editing: boolean, sentDates: string[] = []): string => {
  if (err?.status === 409 && Array.isArray(err.detail)) {
    const dates: string[] = err.detail
      .map((c: { date?: string; row?: number }) => c.date ?? (c.row ? sentDates[c.row - 1] : undefined))
      .filter(Boolean)
      .map(dayMonth);
    const shown = dates.length > 8 ? [...dates.slice(0, 8), `${dates.length - 8} más`] : dates;
    return `Estas fechas ya tienen una clase que se superpone con ese horario: ${listText(shown)}. No se ${
      editing ? 'modificó' : 'registró'
    } ninguna clase.`;
  }
  if (err?.status === 409) return 'Ese día ya hay una clase que se superpone con ese horario.';
  if (err?.status === 403)
    return `Solo un docente del curso lectivo o el administrador puede ${editing ? 'modificar' : 'registrar'} eventos en él.`;
  if (err?.status === 404)
    return editing ? 'El evento ya no existe. Recargue la página.' : 'El curso lectivo ya no existe. Recargue la página.';
  if (err?.status === 422) {
    const text = String(err.message ?? '');
    if (text.includes('section year')) return `La fecha debe ser del año del curso lectivo${course ? ` (${course.year})` : ''}.`;
    if (text.includes('no matching dates')) return 'Ninguna fecha del período cae en los días elegidos.';
    if (text.includes('too long')) return 'El período no puede superar un año.';
    if (text.includes('meeting_url')) return 'El link debe empezar con http:// o https://.';
    return 'Revise los datos del formulario.';
  }
  return `No se pudo ${editing ? 'guardar' : 'registrar'} el evento. Intente de nuevo.`;
};

// Error que ya trae el mensaje para mostrar (por ejemplo, al cambiar el tipo de un evento)
class FormError extends Error {}

/** Evento que se modifica, con sus datos tal como están guardados. */
export interface EditableEvent {
  kind: Kind;
  id: number; // id_calendar_class o id_activity
  id_section_year: number;
  date: string;
  start: string | null; // HH:MM; en una entrega, la hora límite
  end: string | null;
  title: string | null;
  modality?: ClassModality;
  location?: string | null;
  meeting_url?: string | null;
  description?: string | null;
}

export interface EventFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Cursos lectivos en los que puede registrar: los asignados (docente) o todos (administrador), del
   * año en curso o posteriores.
   */
  courses: Course[];
  /** Curso lectivo elegido al abrir. */
  defaultCourseId: number | null;
  /** Fecha elegida al abrir (por ejemplo, el día tocado en el calendario). */
  defaultDate: string;
  /** Si viene, el formulario modifica este evento en lugar de registrar uno nuevo. */
  editing?: EditableEvent | null;
  /** Clases posteriores de la misma serie semanal (mismo día, horario y título) que la que se modifica. */
  followingIds?: number[];
  onSaved: () => void;
}

export const EventFormModal: React.FC<EventFormModalProps> = ({
  isOpen,
  onClose,
  courses,
  defaultCourseId,
  defaultDate,
  editing = null,
  followingIds = [],
  onSaved,
}) => {
  const { success } = useToast();
  const isEditing = editing !== null;

  const [kind, setKind] = useState<Kind>('class');
  const [courseId, setCourseId] = useState('');
  const [date, setDate] = useState('');
  const [title, setTitle] = useState('');
  // Clase
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [modality, setModality] = useState<ClassModality>('in_person');
  const [location, setLocation] = useState('');
  const [meetingUrl, setMeetingUrl] = useState('');
  const [repeat, setRepeat] = useState(false);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [until, setUntil] = useState('');
  // Entrega
  const [dueTime, setDueTime] = useState('');
  const [description, setDescription] = useState('');
  // Al modificar una clase semanal: solo esa o también las siguientes de la serie
  const [scope, setScope] = useState<'one' | 'following'>('one');

  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Cada vez que se abre, el formulario arranca vacío con la fecha y el curso lectivo sugeridos, o con
  // los datos del evento que se modifica
  useEffect(() => {
    if (!isOpen) return;
    const isClass = editing?.kind !== 'delivery';
    setKind(editing?.kind ?? 'class');
    setCourseId(editing ? String(editing.id_section_year) : defaultCourseId ? String(defaultCourseId) : '');
    setDate(editing?.date ?? defaultDate);
    setTitle(editing?.title ?? '');
    setStartTime(editing && isClass ? editing.start ?? '' : '');
    setEndTime(editing && isClass ? editing.end ?? '' : '');
    setModality(editing?.modality ?? 'in_person');
    setLocation(editing?.location ?? '');
    setMeetingUrl(editing?.meeting_url ?? '');
    setRepeat(false);
    setWeekdays([]);
    setUntil('');
    setDueTime(editing && !isClass ? editing.start ?? '' : '');
    setDescription(editing?.description ?? '');
    setScope('one');
    setSubmitted(false);
    setFormError(null);
  }, [isOpen, defaultCourseId, defaultDate, editing]);

  const typeChanged = isEditing && kind !== editing.kind;
  const dateChanged = isEditing && date !== editing.date;
  // "Esta y las siguientes" solo para una clase que sigue siendo clase y no cambia de fecha
  const canChooseScope = isEditing && editing.kind === 'class' && !typeChanged && followingIds.length > 0;

  const courseOptions = useMemo(
    () =>
      [...courses].sort((a, b) => b.year - a.year || a.section_name.localeCompare(b.section_name, 'es')),
    [courses]
  );
  const course = courses.find((c) => String(c.id_section_year) === courseId);
  const yearMin = course ? `${course.year}-01-01` : undefined;
  const yearMax = course ? `${course.year}-12-31` : undefined;

  // Feriados del año del curso lectivo (o de la fecha, si todavía no se eligió el curso)
  const holidayYear = course?.year ?? (date ? Number(date.slice(0, 4)) : null);
  const { holidays } = useHolidays(holidayYear ? [holidayYear] : []);

  const toggleRepeat = (checked: boolean) => {
    setRepeat(checked);
    // Al activar la repetición se propone el día de la semana de la fecha elegida (salvo el domingo)
    if (checked && weekdays.length === 0 && date && isoWeekday(date) !== SUNDAY) setWeekdays([isoWeekday(date)]);
  };

  const toggleWeekday = (value: number) =>
    setWeekdays((current) =>
      current.includes(value) ? current.filter((d) => d !== value) : [...current, value].sort()
    );

  // ===== Validación (se muestra después del primer intento de guardar) =====
  const errors: Record<string, string | undefined> = {};
  if (!course) errors.course = 'Elija el curso lectivo';
  if (!date) errors.date = 'Ingrese la fecha';
  else if (course && date.slice(0, 4) !== String(course.year))
    errors.date = `Debe ser del año del curso lectivo (${course.year})`;
  // El domingo y los feriados no son días hábiles. Un evento que ya estaba en esa fecha se puede
  // modificar sin moverlo.
  else if (isoWeekday(date) === SUNDAY && (!isEditing || dateChanged)) errors.date = 'Es domingo: elija un día hábil';
  else if (holidays[date] && (!isEditing || dateChanged)) errors.date = `Es feriado: ${holidays[date]}`;
  if (kind === 'class') {
    if (!startTime) errors.startTime = 'Ingrese la hora';
    if (!endTime) errors.endTime = 'Ingrese la hora';
    else if (startTime && endTime <= startTime) errors.endTime = 'Debe ser posterior al inicio';
    if (modality === 'virtual' && meetingUrl.trim() && !isHttpUrl(meetingUrl.trim()))
      errors.meetingUrl = 'Debe empezar con http:// o https://';
    if (repeat) {
      if (weekdays.length === 0) errors.weekdays = 'Elija al menos un día';
      if (!until) errors.until = 'Ingrese hasta cuándo se repite';
      else if (date && until < date) errors.until = 'Debe ser igual o posterior a la fecha de la primera clase';
      else if (course && until.slice(0, 4) !== String(course.year))
        errors.until = `Debe ser del año del curso lectivo (${course.year})`;
    }
  } else if (!title.trim()) {
    errors.title = 'Ingrese el título';
  }
  // Clases que se van a crear al repetir: las fechas de los días elegidos, sin los feriados
  const repeatPlan = useMemo(() => {
    if (kind !== 'class' || !repeat || !date || !until || until < date || weekdays.length === 0) return null;
    const all = datesBetween(date, until, weekdays);
    return { dates: all.filter((d) => !holidays[d]), skipped: all.filter((d) => holidays[d]) };
  }, [kind, repeat, date, until, weekdays, holidays]);

  if (repeatPlan && repeatPlan.dates.length > MAX_BULK_CLASSES)
    errors.until = `Son más de ${MAX_BULK_CLASSES} clases: acorte el período`;

  const isValid = Object.values(errors).every((e) => !e);
  const show = (field: string) => (submitted ? errors[field] : undefined);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setFormError(null);
    if (!isValid || !course) return;

    setSaving(true);
    let sentDates: string[] = [];
    try {
      const id = course.id_section_year;
      const classFields = {
        start_time: startTime,
        end_time: endTime,
        modality,
        title: title.trim() || null,
        // Se manda solo el lugar de la modalidad elegida; el de la otra queda vacío
        location: modality === 'in_person' ? location.trim() || null : null,
        meeting_url: modality === 'virtual' ? meetingUrl.trim() || null : null,
      };
      const deliveryFields = {
        title: title.trim(),
        description: description.trim() || null,
        due_date: date,
        due_time: dueTime || null,
      };

      if (editing && !typeChanged) {
        if (kind === 'delivery') {
          await api.updateActivity(editing.id, deliveryFields);
          success('Entrega modificada');
        } else if (canChooseScope && scope === 'following' && !dateChanged) {
          const ids = [editing.id, ...followingIds];
          await api.updateCalendarClasses(id, { ids, changes: classFields });
          success(`Se modificaron ${ids.length} clases`);
        } else {
          await api.updateCalendarClass(editing.id, { ...classFields, date });
          success('Clase modificada');
        }
        onSaved();
        onClose();
        return;
      }

      if (editing && typeChanged) {
        // Cambiar el tipo es registrar el evento nuevo y eliminar el anterior. Si no se puede eliminar,
        // se deshace el alta para no dejar el evento repetido.
        if (editing.kind === 'class') {
          const attendance = await api.getClassAttendance(editing.id);
          if (attendance.items.some((s) => s.present)) {
            throw new FormError('La clase ya tiene asistencia tomada: no se puede cambiar a entrega.');
          }
          const created = await api.createActivity(id, deliveryFields);
          try {
            await api.deleteCalendarClass(editing.id);
          } catch (err) {
            await api.deleteActivity(created.id_activity).catch(() => undefined);
            throw err;
          }
          success('El evento ahora es una entrega');
        } else {
          const created = await api.createCalendarClass(id, { ...classFields, date });
          try {
            await api.deleteActivity(editing.id);
          } catch (err: any) {
            await api.deleteCalendarClass(created.id_calendar_class).catch(() => undefined);
            if (err?.status === 409)
              throw new FormError('Los equipos ya cargaron datos en esta entrega: no se puede cambiar a clase.');
            throw err;
          }
          success('El evento ahora es una clase');
        }
        onSaved();
        onClose();
        return;
      }

      if (kind === 'delivery') {
        await api.createActivity(id, deliveryFields);
        success('Entrega registrada');
      } else {
        const fields = classFields;
        if (repeat) {
          const dates = repeatPlan?.dates ?? [];
          if (dates.length === 0) {
            setFormError('Ninguna fecha del período cae en los días elegidos fuera de los feriados.');
            return;
          }
          sentDates = dates;
          const report = await api.bulkLoadCalendar(id, { classes: dates.map((d) => ({ ...fields, date: d })) });
          const n = report.classes_created;
          success(n === 1 ? 'Se registró 1 clase' : `Se registraron ${n} clases`);
        } else {
          await api.createCalendarClass(id, { ...fields, date });
          success('Clase registrada');
        }
      }
      onSaved();
      onClose();
    } catch (err) {
      setFormError(err instanceof FormError ? err.message : errorMessage(err, course, isEditing, sentDates));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !saving && onClose()}
      title={isEditing ? 'Modificar evento' : 'Registrar evento'}
      maxWidth="lg"
    >
      {formError && <Alert className="mb-4">{formError}</Alert>}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <FieldLabel>Tipo de evento</FieldLabel>
          <SegmentedControl label="Tipo de evento" options={KIND_OPTIONS} value={kind} onChange={setKind} />
          {typeChanged && (
            <p className="mt-2 rounded-lg border border-warning-line bg-warning-soft px-3 py-2 text-xs text-warning">
              {editing.kind === 'class'
                ? 'Se va a registrar como entrega y se elimina la clase. Si la clase ya tiene asistencia tomada, no se puede cambiar.'
                : 'Se va a registrar como clase y se elimina la entrega. Si los equipos ya cargaron datos en la entrega, no se puede cambiar.'}
            </p>
          )}
        </div>

        <Select
          id="evento-curso"
          label="Curso lectivo"
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          error={show('course')}
          helperText={isEditing ? 'El curso lectivo de un evento no se cambia.' : undefined}
          disabled={saving || isEditing}
        >
          <option value="" disabled>
            Seleccione un curso lectivo
          </option>
          {courseOptions.map((c) => (
            <option key={c.id_section_year} value={c.id_section_year}>
              {c.section_name} · {c.year}
            </option>
          ))}
        </Select>

        <Input
          id="evento-titulo"
          label="Título"
          optional={kind === 'class'}
          placeholder={kind === 'class' ? 'Clase' : 'Por ejemplo, Entrega del anteproyecto'}
          maxLength={kind === 'class' ? 100 : 200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          error={show('title')}
          disabled={saving}
        />

        {kind === 'class' ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <DateField
                id="evento-fecha"
                label={repeat ? 'Primera clase' : 'Fecha'}
                value={date}
                min={yearMin}
                max={yearMax}
                onChange={(e) => setDate(e.target.value)}
                error={show('date')}
                disabled={saving}
              />
              <TimeField
                id="evento-inicio"
                label="Desde"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                error={show('startTime')}
                disabled={saving}
              />
              <TimeField
                id="evento-fin"
                label="Hasta"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                error={show('endTime')}
                disabled={saving}
              />
            </div>

            <div>
              <FieldLabel>Modalidad</FieldLabel>
              <SegmentedControl
                label="Modalidad"
                options={MODALITY_OPTIONS}
                value={modality}
                onChange={setModality}
              />
            </div>

            {modality === 'in_person' ? (
              <Input
                id="evento-aula"
                label="Aula"
                optional
                maxLength={200}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                disabled={saving}
              />
            ) : (
              <Input
                id="evento-link"
                label="Link de la videollamada"
                optional
                type="url"
                placeholder="https://"
                maxLength={500}
                value={meetingUrl}
                onChange={(e) => setMeetingUrl(e.target.value)}
                error={show('meetingUrl')}
                disabled={saving}
              />
            )}

            {canChooseScope && (
              <fieldset className="rounded-lg border border-line p-3">
                <legend className="px-1 text-sm font-medium text-ink">¿Qué clases se modifican?</legend>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
                    <input
                      type="radio"
                      name="evento-alcance"
                      className="w-4 h-4 accent-primary"
                      checked={scope === 'one' || dateChanged}
                      onChange={() => setScope('one')}
                      disabled={saving}
                    />
                    Solo esta clase
                  </label>
                  <label
                    className={`flex items-center gap-2 text-sm ${dateChanged ? 'text-ink-faint' : 'text-ink cursor-pointer'}`}
                  >
                    <input
                      type="radio"
                      name="evento-alcance"
                      className="w-4 h-4 accent-primary"
                      checked={scope === 'following' && !dateChanged}
                      onChange={() => setScope('following')}
                      disabled={saving || dateChanged}
                    />
                    Esta y las {followingIds.length} siguientes del mismo día y horario
                  </label>
                </div>
                {dateChanged && (
                  <p className="mt-2 text-xs text-ink-muted">Al cambiar la fecha se modifica solo esta clase.</p>
                )}
              </fieldset>
            )}

            {!isEditing && (
            <div className="rounded-lg border border-line p-3 space-y-3">
              <label className="flex items-center gap-2 text-sm font-medium text-ink cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-primary"
                  checked={repeat}
                  onChange={(e) => toggleRepeat(e.target.checked)}
                  disabled={saving}
                />
                Se repite cada semana
              </label>

              {repeat && (
                <>
                  <fieldset>
                    <legend className="block text-sm font-medium text-ink mb-1.5">Días</legend>
                    <div className="flex flex-wrap gap-1.5">
                      {WEEKDAYS.map((d) => {
                        const selected = weekdays.includes(d.value);
                        return (
                          <button
                            key={d.value}
                            type="button"
                            aria-pressed={selected}
                            aria-label={d.name}
                            onClick={() => toggleWeekday(d.value)}
                            disabled={saving}
                            className={`w-10 h-9 rounded-md border text-sm transition-colors ${
                              selected
                                ? 'bg-primary border-primary text-white font-medium'
                                : 'bg-white border-line text-ink-muted hover:text-ink'
                            }`}
                          >
                            {d.short}
                          </button>
                        );
                      })}
                    </div>
                    {show('weekdays') && (
                      <p className="mt-1.5 text-xs font-medium text-danger">{show('weekdays')}</p>
                    )}
                  </fieldset>

                  <DateField
                    id="evento-hasta"
                    label="Se repite hasta"
                    value={until}
                    min={date || yearMin}
                    max={yearMax}
                    onChange={(e) => setUntil(e.target.value)}
                    error={show('until')}
                    disabled={saving}
                  />

                  {repeatPlan && (
                    <p className="text-xs text-ink-muted">
                      {repeatPlan.dates.length === 0
                        ? 'Ninguna fecha del período cae en los días elegidos fuera de los feriados.'
                        : `Se van a registrar ${repeatPlan.dates.length} ${repeatPlan.dates.length === 1 ? 'clase' : 'clases'}.`}
                      {repeatPlan.skipped.length > 0 &&
                        ` Se saltean ${repeatPlan.skipped.length === 1 ? 'el feriado' : 'los feriados'} del ${listText(
                          repeatPlan.skipped.map(dayMonth)
                        )}.`}
                    </p>
                  )}
                </>
              )}
            </div>
            )}
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DateField
                id="evento-fecha"
                label="Fecha de entrega"
                value={date}
                min={yearMin}
                max={yearMax}
                onChange={(e) => setDate(e.target.value)}
                error={show('date')}
                disabled={saving}
              />
              <TimeField
                id="evento-hora"
                label="Hora límite"
                optional
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                disabled={saving}
              />
            </div>

            <div>
              <FieldLabel htmlFor="evento-descripcion" optional>
                Descripción
              </FieldLabel>
              <textarea
                id="evento-descripcion"
                rows={3}
                className={`${fieldClasses()} h-auto py-2 resize-y`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={saving}
              />
            </div>
          </>
        )}

        <div className="flex justify-end gap-3 pt-3 border-t border-line">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" isLoading={saving}>
            {isEditing ? 'Guardar' : 'Registrar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
