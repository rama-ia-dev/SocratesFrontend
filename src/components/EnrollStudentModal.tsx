import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { SectionYearPublic, StudentSectionYearPublic } from '../types/api';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Alert } from './ui/Alert';
import { Select } from './ui/Select';

const courseLabel = (c: { section_name: string; year: number }) => `${c.section_name} (${c.year})`;

const enrollError = (err: any, target: SectionYearPublic): string => {
  const detail = String(err?.message ?? '');
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

// El backend guarda la inscripción (registered) y la cursada (attending, finished_*) como filas
// separadas del mismo curso lectivo. Se muestra un renglón por curso, con la cursada si la hay.
const byCourse = (rows: StudentSectionYearPublic[]): StudentSectionYearPublic[] => {
  const map = new Map<number, StudentSectionYearPublic>();
  for (const r of rows) {
    const prev = map.get(r.id_section_year);
    if (!prev || prev.state === 'registered') map.set(r.id_section_year, r);
  }
  return [...map.values()].sort(
    (a, b) => b.year - a.year || a.section_name.localeCompare(b.section_name, 'es')
  );
};

// Inscribir a un estudiante ya registrado en otro curso lectivo (SCRUM-610). La inscripción se
// agrega a las que tiene: sigue figurando en sus cursos lectivos anteriores y sus cursadas no
// cambian. El backend admite una inscripción por año.
export const EnrollStudentModal: React.FC<{
  student: { id_student: number; first_name: string; last_name: string; legajo: number };
  onClose: () => void;
  onEnrolled: (message: string) => void;
}> = ({ student, onClose, onEnrolled }) => {
  const [courses, setCourses] = useState<StudentSectionYearPublic[] | null>(null);
  const [options, setOptions] = useState<SectionYearPublic[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const name = `${student.first_name} ${student.last_name}`;

  const load = useCallback(async () => {
    const [mine, all] = await Promise.all([
      api.getStudentEnrollments(student.id_student),
      api.getSectionYears({ limit: 100 }),
    ]);
    const takenYears = new Set(mine.items.filter((e) => e.state === 'registered').map((e) => e.year));
    const own = new Set(mine.items.map((e) => e.id_section_year));
    setCourses(byCourse(mine.items));
    setOptions(
      all.items
        .filter((sy) => !takenYears.has(sy.year) && !own.has(sy.id_section_year))
        .sort((a, b) => b.year - a.year || a.section_name.localeCompare(b.section_name, 'es'))
    );
  }, [student.id_student]);

  useEffect(() => {
    load().catch(() => setLoadError(true));
  }, [load]);

  const handleEnroll = async () => {
    const target = options.find((sy) => String(sy.id_section_year) === selected);
    if (!target) {
      setError('Seleccione un curso lectivo.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await api.enrollStudent({ id_student: student.id_student, id_section_year: target.id_section_year });
      onEnrolled(`Se inscribió a ${name} en ${courseLabel(target)}`);
    } catch (err: any) {
      setError(enrollError(err, target));
      // Otra persona pudo haberlo inscripto mientras el diálogo estaba abierto: se actualizan
      // sus cursos lectivos y las opciones disponibles
      if (err?.status === 409) {
        setSelected('');
        await load().catch(() => setLoadError(true));
      }
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={() => !isSaving && onClose()} title={`Inscribir a ${name} en otro curso lectivo`}>
      {error && <Alert className="mb-4">{error}</Alert>}
      {loadError ? (
        <Alert>No se pudieron cargar los cursos lectivos. Cierre el diálogo y vuelva a intentarlo.</Alert>
      ) : courses === null ? (
        <div className="h-24 rounded-lg bg-fill-neutral animate-pulse" aria-busy="true" />
      ) : (
        <div className="space-y-4 text-sm text-ink">
          <div>
            <p className="text-xs font-medium text-ink-muted mb-1.5">Cursos lectivos del estudiante</p>
            {courses.length === 0 ? (
              <p className="text-ink-muted">No registra cursos lectivos.</p>
            ) : (
              <ul className="space-y-1">
                {courses.map((c) => (
                  <li key={c.id_section_year} className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-medium">{courseLabel(c)}</span>
                    <span className="text-xs text-ink-muted">{c.status.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {options.length === 0 ? (
            <p>No hay cursos lectivos disponibles para esta inscripción.</p>
          ) : (
            <Select
              id="enroll-target"
              label="Nuevo curso lectivo"
              value={selected}
              onChange={(e) => {
                setSelected(e.target.value);
                setError(null);
              }}
              disabled={isSaving}
              options={[
                { value: '', label: 'Seleccione un curso lectivo' },
                ...options.map((sy) => ({ value: sy.id_section_year, label: courseLabel(sy) })),
              ]}
              helperText="Se listan los cursos lectivos de los años en los que no tiene inscripción. Las inscripciones anteriores se conservan."
            />
          )}
        </div>
      )}
      <div className="flex justify-end gap-3 pt-3 mt-4 border-t border-line">
        <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
          Cancelar
        </Button>
        {courses && options.length > 0 && (
          <Button type="button" onClick={handleEnroll} isLoading={isSaving}>
            Inscribir
          </Button>
        )}
      </div>
    </Modal>
  );
};
