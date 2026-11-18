import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { SectionYearPublic, StudentSectionYearPublic } from '../types/api';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Alert } from './ui/Alert';
import { Select } from './ui/Select';
import { byCourse, courseLabel } from '../lib/courses';

const enrollError = (err: any, target: SectionYearPublic): string => {
  const detail = String(err?.message ?? '');
  if (err?.status === 409 && detail.includes('approved cursada')) {
    return 'El estudiante ya aprobó la cursada: no puede inscribirse en otro curso lectivo.';
  }
  if (err?.status === 409 && detail.includes('already has a registration')) {
    return `Ya tiene una inscripción en un curso lectivo de ${target.year}. Se admite una inscripción por año.`;
  }
  if (err?.status === 404 && detail.includes('Student')) {
    return 'El estudiante ya no está registrado en el sistema.';
  }
  if (err?.status === 404) return `El curso lectivo ${courseLabel(target)} ya no existe.`;
  if (err?.status === 403) return 'Solo el administrador puede inscribir estudiantes en otro curso lectivo.';
  return detail || 'No se pudo realizar la inscripción.';
};

const changeError = (err: any, action: 'move' | 'delete'): string => {
  if (err?.status === 409) {
    return action === 'move'
      ? 'No se pudo cambiar la comisión: el estudiante ya tiene otra inscripción en ese año, o su cursada ya comenzó o terminó aprobada.'
      : 'No se pudo quitar la inscripción: el estudiante ya tiene una cursada en ese curso lectivo.';
  }
  if (err?.status === 404) return 'La inscripción ya no existe. Se actualizó la lista.';
  if (err?.status === 403) return 'Solo el administrador puede modificar las inscripciones.';
  return String(err?.message ?? '') || 'No se pudo completar la operación.';
};

/**
 * Cursos lectivos de un estudiante (SCRUM-610), solo el administrador:
 * - inscribirlo en otro año, desde su año de ingreso y posterior a su última cursada, siempre que
 *   no tenga una cursada abierta (para cursar otro año, primero tiene que terminar o abandonar la
 *   cursada anterior) ni una aprobada (el backend no lo admite);
 * - cambiar la comisión de una inscripción dentro del mismo año, mientras no tenga cursada en ese
 *   curso lectivo (la cursada empieza cuando se suma a un equipo);
 * - quitar una inscripción cargada por error, con la misma condición.
 */
export const EnrollStudentModal: React.FC<{
  student: { id_student: number; first_name: string; last_name: string; legajo: number; enrollment_year: number };
  onClose: () => void;
  onEnrolled: (message: string) => void;
  onChanged: (message: string) => void;
}> = ({ student, onClose, onEnrolled, onChanged }) => {
  const [rows, setRows] = useState<StudentSectionYearPublic[] | null>(null);
  const [allCourses, setAllCourses] = useState<SectionYearPublic[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // Inscripción que se está modificando: cambiar la comisión o confirmar que se quita
  const [editing, setEditing] = useState<{ id: number; mode: 'move' | 'delete'; target: string } | null>(null);
  const name = `${student.first_name} ${student.last_name}`;

  const load = useCallback(async () => {
    const [mine, all] = await Promise.all([
      api.getStudentEnrollments(student.id_student),
      api.getSectionYears({ limit: 100 }),
    ]);
    setRows(mine.items);
    setAllCourses(all.items);
  }, [student.id_student]);

  useEffect(() => {
    load().catch(() => setLoadError(true));
  }, [load]);

  const courses = rows ? byCourse(rows) : [];
  // Cursada abierta: impide inscribirlo en otro año
  const openCursada = rows?.find((r) => r.state === 'attending') ?? null;
  // Una inscripción se puede modificar si en ese curso lectivo no tiene cursada (ni abierta ni terminada)
  const withCursada = new Set((rows ?? []).filter((r) => r.state !== 'registered').map((r) => r.id_section_year));
  const registrationOf = (id_section_year: number) =>
    (rows ?? []).find((r) => r.id_section_year === id_section_year && r.state === 'registered');
  // Cursada aprobada: el estudiante ya no se inscribe en otro curso lectivo
  const approvedCursada = rows?.find((r) => r.state === 'finished_approved') ?? null;
  // Una nueva inscripción es de un año posterior a su última cursada (y desde su año de ingreso)
  const lastCursadaYear = Math.max(0, ...(rows ?? []).filter((r) => r.state !== 'registered').map((r) => r.year));
  const fromYear = Math.max(student.enrollment_year, lastCursadaYear + 1);
  const takenYears = new Set((rows ?? []).filter((r) => r.state === 'registered').map((r) => r.year));
  const own = new Set((rows ?? []).map((r) => r.id_section_year));
  const options = allCourses
    .filter((sy) => sy.year >= fromYear && !takenYears.has(sy.year) && !own.has(sy.id_section_year))
    .sort((a, b) => b.year - a.year || a.section_name.localeCompare(b.section_name, 'es'));
  const sameYearOptions = (year: number, current: number) =>
    allCourses
      .filter((sy) => sy.year === year && sy.id_section_year !== current)
      .sort((a, b) => a.section_name.localeCompare(b.section_name, 'es'));

  const handleEnroll = async () => {
    const target = options.find((sy) => String(sy.id_section_year) === selected);
    if (!target) {
      setError('Seleccione un curso lectivo.');
      return;
    }
    setBusy('enroll');
    setError(null);
    try {
      await api.enrollStudent({ id_student: student.id_student, id_section_year: target.id_section_year });
      onEnrolled(`Se inscribió a ${name} en ${courseLabel(target)}`);
    } catch (err: any) {
      setError(enrollError(err, target));
      // Otra persona pudo haberlo inscripto mientras el diálogo estaba abierto
      if (err?.status === 409) {
        setSelected('');
        await load().catch(() => setLoadError(true));
      }
      setBusy(null);
    }
  };

  const handleChange = async () => {
    if (!editing) return;
    const row = (rows ?? []).find((r) => r.id_student_section_year === editing.id);
    if (!row) return;
    let target: SectionYearPublic | undefined;
    if (editing.mode === 'move') {
      target = allCourses.find((sy) => String(sy.id_section_year) === editing.target);
      if (!target) {
        setError('Seleccione la nueva comisión.');
        return;
      }
    }
    setBusy(`${editing.mode}-${editing.id}`);
    setError(null);
    try {
      if (editing.mode === 'move' && target) {
        await api.moveEnrollment(row.id_student_section_year, target.id_section_year);
        onChanged(`Se cambió la inscripción de ${name} de ${courseLabel(row)} a ${courseLabel(target)}`);
      } else {
        await api.deleteEnrollment(row.id_student_section_year);
        onChanged(`Se quitó la inscripción de ${name} en ${courseLabel(row)}`);
      }
      setEditing(null);
    } catch (err: any) {
      setError(changeError(err, editing.mode));
    } finally {
      await load().catch(() => setLoadError(true));
      setBusy(null);
    }
  };

  return (
    <Modal isOpen onClose={() => !busy && onClose()} title={`Cursos lectivos de ${name}`}>
      {error && <Alert className="mb-4">{error}</Alert>}
      {loadError ? (
        <Alert>No se pudieron cargar los cursos lectivos. Cierre el diálogo y vuelva a intentarlo.</Alert>
      ) : rows === null ? (
        <div className="h-24 rounded-lg bg-fill-neutral animate-pulse" aria-busy="true" />
      ) : (
        <div className="space-y-5 text-sm text-ink">
          <div>
            <p className="text-xs font-medium text-ink-muted mb-1.5">Cursos lectivos del estudiante</p>
            {courses.length === 0 ? (
              <p className="text-ink-muted">No registra cursos lectivos.</p>
            ) : (
              <ul className="divide-y divide-line rounded-lg border border-line">
                {courses.map((c) => {
                  const registration = registrationOf(c.id_section_year);
                  const editable = Boolean(registration) && !withCursada.has(c.id_section_year);
                  const isEditing = registration && editing?.id === registration.id_student_section_year;
                  const moves = sameYearOptions(c.year, c.id_section_year);
                  return (
                    <li key={c.id_section_year} className="px-3 py-2.5 space-y-2">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-medium">{courseLabel(c)}</span>
                        <span className="text-xs text-ink-muted">{c.status.name}</span>
                        {editable && registration && !isEditing && (
                          <span className="ml-auto flex gap-3 text-xs font-medium">
                            {moves.length > 0 && (
                              <button
                                type="button"
                                className="text-primary hover:underline cursor-pointer disabled:opacity-60"
                                disabled={busy !== null}
                                onClick={() => {
                                  setError(null);
                                  setEditing({ id: registration.id_student_section_year, mode: 'move', target: '' });
                                }}
                              >
                                Cambiar comisión
                              </button>
                            )}
                            <button
                              type="button"
                              className="text-danger hover:underline cursor-pointer disabled:opacity-60"
                              disabled={busy !== null}
                              onClick={() => {
                                setError(null);
                                setEditing({ id: registration.id_student_section_year, mode: 'delete', target: '' });
                              }}
                            >
                              Quitar
                            </button>
                          </span>
                        )}
                      </div>
                      {isEditing && editing && (
                        <div className="rounded-lg bg-canvas border border-line p-3 space-y-2.5">
                          {editing.mode === 'move' ? (
                            <Select
                              id={`move-${editing.id}`}
                              label={`Nueva comisión en ${c.year}`}
                              value={editing.target}
                              disabled={busy !== null}
                              onChange={(e) => setEditing({ ...editing, target: e.target.value })}
                              options={[
                                { value: '', label: 'Seleccione una comisión' },
                                ...moves.map((sy) => ({ value: sy.id_section_year, label: courseLabel(sy) })),
                              ]}
                              helperText="La inscripción pasa a la comisión elegida."
                            />
                          ) : (
                            <p>
                              Se quitará la inscripción del estudiante en {courseLabel(c)}. La acción no puede
                              deshacerse.
                            </p>
                          )}
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant={editing.mode === 'delete' ? 'destructive' : 'primary'}
                              onClick={handleChange}
                              isLoading={busy === `${editing.mode}-${editing.id}`}
                            >
                              {editing.mode === 'move' ? 'Cambiar comisión' : 'Quitar inscripción'}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditing(null)} disabled={busy !== null}>
                              Volver
                            </Button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="mt-1.5 text-xs text-ink-muted">
              Una inscripción solo puede cambiarse de comisión o quitarse mientras el estudiante no tenga una cursada en
              ese curso lectivo.
            </p>
          </div>

          <div className="border-t border-line pt-4">
            {approvedCursada ? (
              <p className="text-ink-muted">
                El estudiante aprobó la cursada en {courseLabel(approvedCursada)}: no puede inscribirse en otro curso
                lectivo.
              </p>
            ) : openCursada ? (
              <p className="text-ink-muted">
                El estudiante tiene una cursada abierta en {courseLabel(openCursada)}. Para inscribirlo en otro año, esa
                cursada debe finalizar o el estudiante debe dejar su equipo de trabajo.
              </p>
            ) : options.length === 0 ? (
              <p className="text-ink-muted">No hay cursos lectivos disponibles para una nueva inscripción.</p>
            ) : (
              <Select
                id="enroll-target"
                label="Inscribir en otro curso lectivo"
                value={selected}
                onChange={(e) => {
                  setSelected(e.target.value);
                  setError(null);
                }}
                disabled={busy !== null}
                options={[
                  { value: '', label: 'Seleccione un curso lectivo' },
                  ...options.map((sy) => ({ value: sy.id_section_year, label: courseLabel(sy) })),
                ]}
                helperText={`Se listan los cursos lectivos desde ${fromYear} (${
                  lastCursadaYear >= student.enrollment_year ? 'posteriores a su última cursada' : 'año de ingreso'
                }) de los años en los que no tiene inscripción. Las inscripciones anteriores se conservan.`}
              />
            )}
          </div>
        </div>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3 pt-3 mt-4 border-t border-line">
        <Button type="button" variant="outline" onClick={onClose} disabled={busy !== null}>
          Cerrar
        </Button>
        {rows && !approvedCursada && !openCursada && options.length > 0 && (
          <Button type="button" onClick={handleEnroll} isLoading={busy === 'enroll'} disabled={busy !== null && busy !== 'enroll'}>
            Inscribir
          </Button>
        )}
      </div>
    </Modal>
  );
};
