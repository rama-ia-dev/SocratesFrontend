import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { ProjectMember, ProjectOverview, ProjectPublic } from '../types/api';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Alert } from './ui/Alert';
import { Select } from './ui/Select';
import { teamLabel } from '../lib/projects';
import { addMemberError, allMembershipsOf, blocksAdding, projectsOfCourse } from '../lib/teamMembers';

// Mover a un integrante a otro equipo del mismo curso lectivo (SCRUM-103). El backend no tiene
// "mover": se lo saca de este equipo y se lo suma al otro. Antes se revisa que el otro equipo
// lo acepte, para no dejarlo sin equipo.
export const MoveMemberModal: React.FC<{
  project: ProjectOverview;
  member: ProjectMember;
  onClose: () => void;
  /** Hubo cambios (completos o a medias): recargar el equipo. */
  onChanged: () => void;
  onMoved: (message: string) => void;
}> = ({ project, member, onClose, onChanged, onMoved }) => {
  const [targets, setTargets] = useState<ProjectPublic[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const name = `${member.first_name} ${member.last_name}`;
  const othersActive = project.members.filter(
    (m) => m.status.code === 'active' && m.id_student_project !== member.id_student_project
  ).length;

  // Los equipos sin asegurar del mismo curso lectivo, salvo este y los que no lo aceptarían (ya
  // estuvo, pidió sumarse o salió de ellos)
  const [skipped, setSkipped] = useState(0);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const open = (await projectsOfCourse(project.id_section_year)).filter(
          (p) => p.id_project !== project.id_project && p.status?.code === 'uninsured'
        );
        const records = await Promise.all(open.map((p) => allMembershipsOf(p.id_project)));
        const ok = open.filter(
          (_, i) => !records[i].some((m) => m.id_student === member.id_student && blocksAdding(m))
        );
        if (!alive) return;
        setSkipped(open.length - ok.length);
        setTargets(ok.sort((a, b) => a.group_number - b.group_number));
      } catch {
        if (alive) setLoadError(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [project.id_project, project.id_section_year, member.id_student]);

  const handleMove = async () => {
    const target = targets?.find((p) => String(p.id_project) === selected);
    if (!target) {
      setError('Elija el equipo al que pasa');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      // Un registro previo en el otro equipo (salvo un rechazo) impediría sumarlo: se avisa antes de sacarlo
      const there = await allMembershipsOf(target.id_project);
      if (there.some((m) => m.id_student === member.id_student && blocksAdding(m))) {
        setError(`${name} ya tiene un registro en el ${teamLabel(target)} (una solicitud, o salió de él): no se puede mover ahí`);
        setIsSaving(false);
        return;
      }
    } catch {
      setError('No se pudo revisar el otro equipo. Pruebe de nuevo.');
      setIsSaving(false);
      return;
    }
    try {
      await api.expelMember(project.id_project, member.id_student_project);
    } catch (err: any) {
      setError(err.message || `No se pudo sacar a ${name} de este equipo`);
      setIsSaving(false);
      return;
    }
    try {
      await api.addMember(target.id_project, member.id_student);
      onMoved(`${name} pasó al ${teamLabel(target)}`);
    } catch (err: any) {
      // Ya salió de este equipo: queda sin equipo y hay que avisarlo
      setError(
        `${name} salió del ${teamLabel(project)}, pero no se pudo sumar al ${teamLabel(target)}: ${addMemberError(err)}. Quedó sin equipo.`
      );
      setIsSaving(false);
      onChanged();
    }
  };

  return (
    <Modal isOpen onClose={() => !isSaving && onClose()} title="Mover a otro equipo">
      {error && <Alert className="mb-4">{error}</Alert>}
      {loadError ? (
        <Alert>No se pudieron cargar los equipos del curso lectivo. Cierre y vuelva a intentar.</Alert>
      ) : targets === null ? (
        <div className="h-10 rounded-lg bg-fill-neutral animate-pulse" aria-busy="true" />
      ) : targets.length === 0 ? (
        <p className="text-sm text-ink">
          No hay otro equipo sin asegurar en {project.section_name} ({project.year}) al que mover a {name}
          {skipped > 0 && ': en los que quedan ya tuvo un registro (pidió sumarse o salió de ellos)'}.
        </p>
      ) : (
        <div className="space-y-3 text-sm text-ink">
          <p>
            <span className="font-semibold">{name}</span> sale del {teamLabel(project)} y pasa al equipo que elija.
          </p>
          {member.is_leader && (
            <p className="text-ink-muted">
              {othersActive > 0
                ? 'Es el jefe del grupo: aquí la jefatura pasa al integrante más antiguo.'
                : `Es el jefe del grupo y el único integrante: el ${teamLabel(project)} queda sin integrantes.`}{' '}
              Si el otro equipo no tiene integrantes, queda como jefe allá.
            </p>
          )}
          <Select
            id="move-target"
            label="Equipo de destino"
            value={selected}
            onChange={(e) => {
              setSelected(e.target.value);
              setError(null);
            }}
            disabled={isSaving}
            options={[
              { value: '', label: 'Elija un equipo' },
              ...targets.map((p) => ({ value: p.id_project, label: `${teamLabel(p)}${p.name ? ` · ${p.name}` : ''}` })),
            ]}
            helperText={`Equipos sin asegurar de ${project.section_name} (${project.year})${
              skipped > 0 ? `, salvo ${skipped === 1 ? 'uno' : skipped} en ${skipped === 1 ? 'el' : 'los'} que ya tuvo un registro` : ''
            }.`}
          />
        </div>
      )}
      <div className="flex justify-end gap-3 pt-3 mt-4 border-t border-line">
        <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
          Cancelar
        </Button>
        {targets && targets.length > 0 && (
          <Button type="button" onClick={handleMove} isLoading={isSaving}>
            Mover
          </Button>
        )}
      </div>
    </Modal>
  );
};
