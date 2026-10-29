import React, { useState } from 'react';
import { api } from '../lib/api';
import type { ProjectOverview, ProjectPrivacy, ProjectPublic, ProjectUpdate } from '../types/api';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Alert } from './ui/Alert';
import { FieldLabel, Input, fieldClasses } from './ui/Input';
import { PRIVACY_HELP, PRIVACY_LABEL, teamLabel } from '../lib/projects';

const NAME_MAX = 200; // límite del backend

type TextField = 'description' | 'objective' | 'problem';
const TEXT_FIELDS: { key: TextField; label: string; placeholder: string }[] = [
  { key: 'description', label: 'Descripción', placeholder: 'De qué se trata el proyecto' },
  { key: 'objective', label: 'Objetivo', placeholder: 'Qué busca lograr' },
  { key: 'problem', label: 'Problemática', placeholder: 'Qué problema resuelve' },
];

// Error del backend al guardar los datos del equipo, en palabras del usuario
const saveError = (err: any): string => {
  if (err.status === 409) return 'El equipo ya está aprobado o cancelado: sus datos no se pueden cambiar';
  if (err.status === 403) return 'Lo modifican sus integrantes, los docentes del curso lectivo y el administrador';
  if (err.status === 404) return 'El equipo ya no existe: puede que lo hayan eliminado';
  return err.message || 'No se pudieron guardar los datos del equipo';
};

// Modificar los datos del equipo (SCRUM-103): PATCH /projects/{id} con lo que cambió. Lo pueden
// los integrantes, los docentes del curso lectivo y el administrador, salvo con el equipo
// aprobado o cancelado.
export const EditProjectModal: React.FC<{
  project: ProjectOverview;
  onClose: () => void;
  onSaved: (updated: ProjectPublic) => void;
}> = ({ project, onClose, onSaved }) => {
  const [values, setValues] = useState({
    name: project.name ?? '',
    description: project.description ?? '',
    objective: project.objective ?? '',
    problem: project.problem ?? '',
  });
  const [privacy, setPrivacy] = useState<ProjectPrivacy>(project.privacy);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Sin asegurar, el backend lo muestra siempre público y no informa la privacidad guardada:
  // elegirla a ciegas confundiría, así que se ofrece una vez asegurado.
  const canChoosePrivacy = project.status?.code !== 'uninsured';

  const set = (key: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    // Solo lo que cambió; un texto vacío se envía como null para borrarlo
    const changes: ProjectUpdate = {};
    const name = values.name.trim();
    if (name !== (project.name ?? '')) changes.name = name || null;
    for (const { key } of TEXT_FIELDS) {
      const value = values[key].trim();
      if (value !== (project[key] ?? '')) changes[key] = value || null;
    }
    if (canChoosePrivacy && privacy !== project.privacy) changes.privacy = privacy;
    if (Object.keys(changes).length === 0) {
      onClose();
      return;
    }
    setIsSaving(true);
    try {
      onSaved(await api.updateProject(project.id_project, changes));
    } catch (err: any) {
      setError(saveError(err));
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={() => !isSaving && onClose()} title={`Modificar el ${teamLabel(project)}`}>
      {error && <Alert className="mb-4">{error}</Alert>}
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Input
          id="project-name"
          label="Nombre del proyecto"
          optional
          maxLength={NAME_MAX}
          value={values.name}
          onChange={set('name')}
          disabled={isSaving}
        />
        {TEXT_FIELDS.map(({ key, label, placeholder }) => (
          <div key={key}>
            <FieldLabel htmlFor={`project-${key}`} optional>
              {label}
            </FieldLabel>
            <textarea
              id={`project-${key}`}
              rows={3}
              className={`${fieldClasses()} h-auto py-2 resize-y`}
              placeholder={placeholder}
              value={values[key]}
              onChange={set(key)}
              disabled={isSaving}
            />
          </div>
        ))}
        {canChoosePrivacy ? (
          <fieldset>
            <legend className="block text-sm font-medium text-ink mb-1.5">Privacidad</legend>
            <div className="space-y-2">
              {(Object.keys(PRIVACY_LABEL) as ProjectPrivacy[]).map((p) => (
                <label
                  key={p}
                  className={`flex items-start gap-2.5 rounded-lg border p-3 cursor-pointer transition-colors duration-150 ${
                    privacy === p ? 'border-primary bg-tint' : 'border-line hover:border-line-neutral-strong'
                  }`}
                >
                  <input
                    type="radio"
                    name="privacy"
                    value={p}
                    checked={privacy === p}
                    onChange={() => setPrivacy(p)}
                    disabled={isSaving}
                    className="mt-0.5 accent-primary"
                  />
                  <span>
                    <span className="block text-sm font-medium text-ink">{PRIVACY_LABEL[p]}</span>
                    <span className="block text-xs text-ink-muted">{PRIVACY_HELP[p]}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : (
          <p className="text-xs text-ink-muted">
            Mientras el equipo no está asegurado se ve como público. La privacidad se elige una vez asegurado.
          </p>
        )}
        <div className="flex justify-end gap-3 pt-3 border-t border-line">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button type="submit" isLoading={isSaving}>
            Guardar
          </Button>
        </div>
      </form>
    </Modal>
  );
};
