import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { ProjectOverview, StudentSectionYearPublic } from '../types/api';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Alert } from './ui/Alert';
import { Select } from './ui/Select';
import { teamLabel } from '../lib/projects';
import { addMemberError, allMembershipsOf, blocksAdding, projectsOfCourse } from '../lib/teamMembers';

// Sumar un alumno al equipo (SCRUM-103). Lo pueden los docentes del curso lectivo y el super
// administrador mientras el equipo no está asegurado. Se ofrecen los inscriptos en el curso
// lectivo que no están en ningún equipo de ese curso ni tienen un registro en este.
export const AddMemberModal: React.FC<{
  project: ProjectOverview;
  onClose: () => void;
  onAdded: (name: string) => void;
}> = ({ project, onClose, onAdded }) => {
  const [candidates, setCandidates] = useState<StudentSectionYearPublic[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [enrolled, projects] = await Promise.all([
          api.getStudentSectionYears(project.id_section_year),
          projectsOfCourse(project.id_section_year),
        ]);
        const memberships = await Promise.all(projects.map((p) => allMembershipsOf(p.id_project)));
        // Ocupados: integrantes, solicitudes o finalizados en algún equipo del curso, y cualquier
        // registro que impida sumarlo a este
        const busy = new Set<number>();
        projects.forEach((p, i) =>
          memberships[i].forEach((m) => {
            const inThis = p.id_project === project.id_project;
            if (['active', 'pending_approval', 'finished'].includes(m.status.code) || (inThis && blocksAdding(m)))
              busy.add(m.id_student);
          })
        );
        const free = enrolled.items
          .filter((e) => !busy.has(e.id_student))
          .sort((a, b) => a.student_last_name.localeCompare(b.student_last_name, 'es'));
        if (alive) setCandidates(free);
      } catch {
        if (alive) setLoadError(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [project.id_project, project.id_section_year]);

  const handleAdd = async () => {
    const student = candidates?.find((c) => String(c.id_student) === selected);
    if (!student) {
      setError('Elija el alumno que se suma');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await api.addMember(project.id_project, student.id_student);
      onAdded(`${student.student_first_name} ${student.student_last_name}`);
    } catch (err: any) {
      setError(addMemberError(err));
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={() => !isSaving && onClose()} title={`Sumar un alumno al ${teamLabel(project)}`}>
      {error && <Alert className="mb-4">{error}</Alert>}
      {loadError ? (
        <Alert>No se pudieron cargar los alumnos del curso lectivo. Cierre y vuelva a intentar.</Alert>
      ) : candidates === null ? (
        <div className="h-10 rounded-lg bg-fill-neutral animate-pulse" aria-busy="true" />
      ) : candidates.length === 0 ? (
        <p className="text-sm text-ink">
          No hay alumnos libres en {project.section_name} ({project.year}): los inscriptos ya están en un equipo de
          este curso lectivo o pidieron sumarse a este.
        </p>
      ) : (
        <div className="space-y-2">
          <Select
            id="add-member"
            label="Alumno"
            value={selected}
            onChange={(e) => {
              setSelected(e.target.value);
              setError(null);
            }}
            disabled={isSaving}
            options={[
              { value: '', label: 'Elija un alumno' },
              ...candidates.map((c) => ({
                value: c.id_student,
                label: `${c.student_last_name}, ${c.student_first_name} · ${c.student_legajo}`,
              })),
            ]}
            helperText={`Inscriptos en ${project.section_name} (${project.year}) que todavía no están en un equipo de este curso lectivo.`}
          />
          {project.members.filter((m) => m.status.code === 'active').length === 0 && (
            <p className="text-xs text-ink-muted">El equipo no tiene integrantes: el alumno que se suma queda como jefe.</p>
          )}
        </div>
      )}
      <div className="flex justify-end gap-3 pt-3 mt-4 border-t border-line">
        <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
          Cancelar
        </Button>
        {candidates && candidates.length > 0 && (
          <Button type="button" onClick={handleAdd} isLoading={isSaving}>
            Sumar al equipo
          </Button>
        )}
      </div>
    </Modal>
  );
};
