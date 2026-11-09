import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { SectionYearPublic, StudentSectionYearPublic } from '../types/api';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Alert } from './ui/Alert';
import { Select } from './ui/Select';

const courseLabel = (c: { section_name: string; year: number }) => `${c.section_name} (${c.year})`;

const enrollError = (err: any, name: string, target: SectionYearPublic): string => {
  const detail = String(err?.message ?? '');
  if (err?.status === 409 && detail.includes('already has a registration')) {
    return `${name} ya tiene una inscripción en ${target.year}. Se admite una por año.`;
  }
  if (err?.status === 404 && detail.includes('Student')) {
    return `${name} ya no está registrado. Cierre el diálogo y actualice la lista.`;
  }
  if (err?.status === 404) return `El curso lectivo ${courseLabel(target)} ya no existe. Elija otro.`;
  if (err?.status === 403) return 'Solo el administrador puede inscribir alumnos en otro curso lectivo.';
  return detail || 'No se pudo inscribir al alumno. Pruebe de nuevo en unos segundos.';
};

// Inscribir a un alumno ya registrado en otro curso lectivo (SCRUM-610), por ejemplo cuando se
// reinscribe en un ciclo nuevo. Suma una inscripción: el alumno sigue figurando en sus cursos
// lectivos anteriores y sus cursadas no cambian. El backend admite una inscripción por año.
export const EnrollStudentModal: React.FC<{
  student: { id_student: number; first_name: string; last_name: string; legajo: number };
  onClose: () => void;
  onEnrolled: (message: string) => void;
}> = ({ student, onClose, onEnrolled }) => {
  const [enrollments, setEnrollments] = useState<StudentSectionYearPublic[] | null>(null);
  const [options, setOptions] = useState<SectionYearPublic[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const name = `${student.first_name} ${student.last_name}`;

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [mine, all] = await Promise.all([
          api.getStudentEnrollments(student.id_student),
          api.getSectionYears({ limit: 100 }),
        ]);
        if (!alive) return;
        const takenYears = new Set(mine.items.filter((e) => e.state === 'registered').map((e) => e.year));
        const ownCourses = new Set(mine.items.map((e) => e.id_section_year));
        setEnrollments(mine.items);
        setOptions(
          all.items
            .filter((sy) => !takenYears.has(sy.year) && !ownCourses.has(sy.id_section_year))
            .sort((a, b) => b.year - a.year || a.section_name.localeCompare(b.section_name, 'es'))
        );
      } catch {
        if (alive) setLoadError(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [student.id_student]);

  const handleEnroll = async () => {
    const target = options.find((sy) => String(sy.id_section_year) === selected);
    if (!target) {
      setError('Elija el curso lectivo');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await api.enrollStudent({ id_student: student.id_student, id_section_year: target.id_section_year });
      onEnrolled(`Se inscribió a ${name} en ${courseLabel(target)}`);
    } catch (err: any) {
      setError(enrollError(err, name, target));
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={() => !isSaving && onClose()} title="Inscribir en otro curso lectivo">
      {error && <Alert className="mb-4">{error}</Alert>}
      {loadError ? (
        <Alert>No se pudieron cargar los cursos lectivos. Cierre y vuelva a intentar.</Alert>
      ) : enrollments === null ? (
        <div className="h-24 rounded-lg bg-fill-neutral animate-pulse" aria-busy="true" />
      ) : (
        <div className="space-y-4 text-sm text-ink">
          <p>
            <span className="font-semibold">{name}</span> (legajo {student.legajo}) se suma al curso lectivo que
            elija. Sigue figurando en los anteriores y sus cursadas no cambian.
          </p>

          <div>
            <p className="text-xs font-medium text-ink-muted mb-1.5">Cursos lectivos actuales</p>
            {enrollments.length === 0 ? (
              <p className="text-ink-muted italic">No tiene cursos lectivos.</p>
            ) : (
              <ul className="space-y-1">
                {enrollments.map((e) => (
                  <li key={e.id_student_section_year} className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-medium">{courseLabel(e)}</span>
                    <span className="text-xs text-ink-muted">{e.status.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {options.length === 0 ? (
            <p>No hay otro curso lectivo en el que se pueda inscribir a {name}.</p>
          ) : (
            <Select
              id="enroll-target"
              label="Curso lectivo"
              value={selected}
              onChange={(e) => {
                setSelected(e.target.value);
                setError(null);
              }}
              disabled={isSaving}
              options={[
                { value: '', label: 'Elija un curso lectivo' },
                ...options.map((sy) => ({ value: sy.id_section_year, label: courseLabel(sy) })),
              ]}
              helperText="No aparecen los años en los que ya está inscripto: se admite una inscripción por año."
            />
          )}
        </div>
      )}
      <div className="flex justify-end gap-3 pt-3 mt-4 border-t border-line">
        <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
          Cancelar
        </Button>
        {enrollments && options.length > 0 && (
          <Button type="button" onClick={handleEnroll} isLoading={isSaving}>
            Inscribir
          </Button>
        )}
      </div>
    </Modal>
  );
};
