import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { ClassModality, SectionYearPublic } from '../types/api';
import { Modal } from './ui/Modal';
import { Alert } from './ui/Alert';
import { Button } from './ui/Button';
import { Input, FieldLabel, fieldClasses } from './ui/Input';
import { Select } from './ui/Select';
import { DateField } from './ui/DateField';
import { SegmentedControl } from './ui/SegmentedControl';
import { useToast } from './ui/Toast';

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
const countDates = (from: string, to: string, weekdays: number[]) => {
  let count = 0;
  const date = isoToDate(from);
  const end = isoToDate(to);
  while (date <= end) {
    if (weekdays.includes(((date.getDay() + 6) % 7) + 1)) count++;
    date.setDate(date.getDate() + 1);
  }
  return count;
};

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

// Error del backend → mensaje para el docente
const errorMessage = (err: any, course: Course | undefined): string => {
  if (err?.status === 409 && Array.isArray(err.detail)) {
    const dates: string[] = err.detail.map((c: { date: string }) => dayMonth(c.date));
    const shown = dates.length > 8 ? [...dates.slice(0, 8), `${dates.length - 8} más`] : dates;
    return `Estas fechas ya tienen una clase que se superpone con ese horario: ${listText(shown)}. No se registró ninguna clase.`;
  }
  if (err?.status === 409) return 'Ese día ya hay una clase que se superpone con ese horario.';
  if (err?.status === 403) return 'Solo un docente del curso lectivo o el administrador puede registrar eventos en él.';
  if (err?.status === 404) return 'El curso lectivo ya no existe. Recargue la página.';
  if (err?.status === 422) {
    const text = String(err.message ?? '');
    if (text.includes('section year')) return `La fecha debe ser del año del curso lectivo${course ? ` (${course.year})` : ''}.`;
    if (text.includes('no matching dates')) return 'Ninguna fecha del período cae en los días elegidos.';
    if (text.includes('too long')) return 'El período no puede superar un año.';
    if (text.includes('meeting_url')) return 'El link debe empezar con http:// o https://.';
    return 'Revise los datos del formulario.';
  }
  return 'No se pudo registrar el evento. Intente de nuevo.';
};

export interface RegisterEventModalProps {
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
  onCreated: () => void;
}

export const RegisterEventModal: React.FC<RegisterEventModalProps> = ({
  isOpen,
  onClose,
  courses,
  defaultCourseId,
  defaultDate,
  onCreated,
}) => {
  const { success } = useToast();

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

  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Cada vez que se abre, el formulario arranca vacío con la fecha y el curso lectivo sugeridos
  useEffect(() => {
    if (!isOpen) return;
    setKind('class');
    setCourseId(defaultCourseId ? String(defaultCourseId) : '');
    setDate(defaultDate);
    setTitle('');
    setStartTime('');
    setEndTime('');
    setModality('in_person');
    setLocation('');
    setMeetingUrl('');
    setRepeat(false);
    setWeekdays([]);
    setUntil('');
    setDueTime('');
    setDescription('');
    setSubmitted(false);
    setFormError(null);
  }, [isOpen, defaultCourseId, defaultDate]);

  const courseOptions = useMemo(
    () =>
      [...courses].sort((a, b) => b.year - a.year || a.section_name.localeCompare(b.section_name, 'es')),
    [courses]
  );
  const course = courses.find((c) => String(c.id_section_year) === courseId);
  const yearMin = course ? `${course.year}-01-01` : undefined;
  const yearMax = course ? `${course.year}-12-31` : undefined;

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
  const isValid = Object.values(errors).every((e) => !e);
  const show = (field: string) => (submitted ? errors[field] : undefined);

  const repeatCount =
    kind === 'class' && repeat && date && until && until >= date && weekdays.length > 0
      ? countDates(date, until, weekdays)
      : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setFormError(null);
    if (!isValid || !course) return;

    setSaving(true);
    try {
      const id = course.id_section_year;
      if (kind === 'delivery') {
        await api.createActivity(id, {
          title: title.trim(),
          description: description.trim() || null,
          due_date: date,
          due_time: dueTime || null,
        });
        success('Entrega registrada');
      } else {
        const fields = {
          start_time: startTime,
          end_time: endTime,
          modality,
          title: title.trim() || null,
          // Se manda solo el lugar de la modalidad elegida
          location: modality === 'in_person' ? location.trim() || null : null,
          meeting_url: modality === 'virtual' ? meetingUrl.trim() || null : null,
        };
        if (repeat) {
          const created = await api.createCalendarClassesBulk(id, {
            ...fields,
            weekdays,
            from_date: date,
            to_date: until,
          });
          success(created.length === 1 ? 'Se registró 1 clase' : `Se registraron ${created.length} clases`);
        } else {
          await api.createCalendarClass(id, { ...fields, date });
          success('Clase registrada');
        }
      }
      onCreated();
      onClose();
    } catch (err) {
      setFormError(errorMessage(err, course));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={() => !saving && onClose()} title="Registrar evento" maxWidth="lg">
      {formError && <Alert className="mb-4">{formError}</Alert>}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <FieldLabel>Tipo de evento</FieldLabel>
          <SegmentedControl label="Tipo de evento" options={KIND_OPTIONS} value={kind} onChange={setKind} />
        </div>

        <Select
          id="evento-curso"
          label="Curso lectivo"
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          error={show('course')}
          disabled={saving}
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
              <Input
                id="evento-inicio"
                label="Desde"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                error={show('startTime')}
                disabled={saving}
              />
              <Input
                id="evento-fin"
                label="Hasta"
                type="time"
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

                  {repeatCount !== null && (
                    <p className="text-xs text-ink-muted">
                      {repeatCount === 0
                        ? 'Ninguna fecha del período cae en los días elegidos.'
                        : `Se van a registrar ${repeatCount} ${repeatCount === 1 ? 'clase' : 'clases'}.`}
                    </p>
                  )}
                </>
              )}
            </div>
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
              <Input
                id="evento-hora"
                label="Hora límite"
                optional
                type="time"
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
            Registrar
          </Button>
        </div>
      </form>
    </Modal>
  );
};
