import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { ProjectOverview, StudentSectionYearPublic } from '../types/api';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Alert } from './ui/Alert';
import { Select } from './ui/Select';
import { teamLabel } from '../lib/projects';
import { fetchAll } from '../lib/pagination';
import { addMemberError, allMembershipsOf, blocksAdding, projectsOfCourse } from '../lib/teamMembers';

// Sumar un alumno al equipo (SCRUM-103). Lo pueden los docentes del curso lectivo y el
// administrador mientras el equipo no está asegurado. Se ofrecen los alumnos del curso lectivo
// que no son parte de ningún equipo de ese curso. Una solicitud pendiente, haber salido o que lo
// hayan sacado no impide sumarlo: el backend lo reactiva como integrante (y rechaza sus
// solicitudes en otros equipos).
export const AddMemberModal: React.FC<{
  project: ProjectOverview;
  onClose: () => void;
  onAdded: (name: string) => void;
}> = ({ project, onClose, onAdded }) => {
  const [candidates, setCandidates] = useState<StudentSectionYearPublic[] | null>(null);
  const [enrolledCount, setEnrolledCount] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // Todas las páginas: el backend devuelve hasta 100 filas ordenadas por apellido, y con una
        // sola la lista se cortaba a mitad del abecedario
        const [enrolled, projects] = await Promise.all([
          fetchAll<StudentSectionYearPublic>((o) => api.getStudentSectionYears(project.id_section_year, o)),
          projectsOfCourse(project.id_section_year),
        ]);
        const memberships = await Promise.all(projects.map((p) => allMembershipsOf(p.id_project)));
        // Ocupados: integrantes o finalizados en algún equipo del curso
        const inTeam = new Set<number>();
        memberships.flat().forEach((m) => blocksAdding(m) && inTeam.add(m.id_student));
        // Un alumno puede tener más de una fila en el curso (la inscripción y la cursada): una por alumno
        const byStudent = new Map(enrolled.map((e) => [e.id_student, e]));
        const free = [...byStudent.values()]
          .filter((e) => !inTeam.has(e.id_student))
          .sort((a, b) => a.student_last_name.localeCompare(b.student_last_name, 'es'));
        if (alive) {
          setEnrolledCount(byStudent.size);
          setCandidates(free);
        }
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
          {enrolledCount === 0
            ? `Todavía no hay alumnos inscriptos en ${project.section_name} (${project.year}).`
            : `No hay alumnos para sumar en ${project.section_name} (${project.year}): todos ya están en un equipo.`}
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
