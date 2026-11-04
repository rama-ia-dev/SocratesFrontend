import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { teamLabel } from '../lib/projects';
import type { ProjectOverview, ProjectStatusAction } from '../types/api';
import { Alert } from './ui/Alert';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { useToast } from './ui/Toast';

interface Option {
  action: ProjectStatusAction;
  label: string;
  /** Lo que pasa al confirmar, en una frase */
  effect: string;
  /** Aprobar y cancelar son estados finales: después no se puede modificar el equipo */
  final?: boolean;
}

const START: Option = {
  action: 'start',
  label: 'Pasar a En proceso',
  effect: 'El equipo ya definió la idea y empieza a desarrollar el proyecto.',
};
const SUBMIT: Option = {
  action: 'submit',
  label: 'Enviar a aprobación',
  effect: 'El proyecto queda Pendiente de aprobación hasta que un docente lo apruebe o lo rechace.',
};
const APPROVE: Option = {
  action: 'approve',
  label: 'Aprobar',
  effect:
    'Los integrantes terminan el proyecto y su cursada de este curso lectivo queda aprobada. Las solicitudes pendientes se rechazan.',
  final: true,
};
const REJECT: Option = {
  action: 'reject',
  label: 'Rechazar',
  effect: 'El equipo sigue con sus integrantes y puede corregir el proyecto para volver a enviarlo.',
};
const RETRY: Option = {
  action: 'retry',
  label: 'Volver a En proceso',
  effect: 'El equipo retoma el proyecto para corregirlo y volver a enviarlo a aprobación.',
};
const CANCEL: Option = {
  action: 'cancel',
  label: 'Cancelar el equipo',
  effect:
    'El equipo se disuelve: los integrantes quedan como abandono y su cursada de este curso lectivo queda desaprobada. Las solicitudes pendientes se rechazan.',
  final: true,
};

// Qué se puede hacer desde cada estado de un equipo asegurado (las transiciones del backend).
// Desasegurado no está: ahí el equipo se sigue armando y se asegura o se elimina.
const OPTIONS: Record<string, Option[]> = {
  in_idea: [START, CANCEL],
  in_progress: [SUBMIT, CANCEL],
  pending_approval: [APPROVE, REJECT, CANCEL],
  rejected: [RETRY, CANCEL],
};

export const statusOptions = (code?: string | null): Option[] => (code ? OPTIONS[code] ?? [] : []);

const DONE: Record<ProjectStatusAction, (team: string) => string> = {
  start: (t) => `El ${t} pasó a En proceso`,
  submit: (t) => `El ${t} se envió a aprobación`,
  approve: (t) => `Se aprobó el ${t}`,
  reject: (t) => `Se rechazó el ${t}`,
  retry: (t) => `El ${t} volvió a En proceso`,
  cancel: (t) => `Se canceló el ${t}`,
};

const statusError = (err: any): string => {
  if (err.status === 409)
    return 'El equipo cambió de estado mientras tanto. Ya se actualizó: revise el estado actual y elija de nuevo.';
  if (err.status === 403) return 'Solo los docentes del curso lectivo y los administradores cambian el estado del equipo';
  if (err.status === 404) return 'El equipo ya no existe';
  return err.message || 'No se pudo cambiar el estado. Pruebe de nuevo en unos segundos.';
};

export const ChangeProjectStatusModal: React.FC<{
  project: ProjectOverview;
  isOpen: boolean;
  onClose: () => void;
  /** Recarga el equipo; después de un 409 también, para mostrar el estado real */
  onChanged: () => void;
}> = ({ project, isOpen, onClose, onChanged }) => {
  const { success } = useToast();
  const options = statusOptions(project.status?.code);
  const [selected, setSelected] = useState<ProjectStatusAction | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  // Cada vez que se abre, o si el estado cambió, arranca sin nada elegido
  useEffect(() => {
    if (isOpen) {
      setSelected(null);
      setErrorText(null);
    }
  }, [isOpen, project.status?.code]);

  const option = options.find((o) => o.action === selected) ?? null;
  const team = teamLabel(project);

  const handleConfirm = async () => {
    if (!option) return;
    setIsSaving(true);
    setErrorText(null);
    try {
      await api.changeProjectStatus(project.id_project, option.action);
      success(DONE[option.action](team));
      onClose();
      onChanged();
    } catch (err: any) {
      setErrorText(statusError(err));
      if (err.status === 409) onChanged();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={() => !isSaving && onClose()} title={`Cambiar el estado del ${team}`}>
      {errorText && <Alert className="mb-4">{errorText}</Alert>}
      <p className="text-sm text-ink">
        Estado actual: <span className="font-semibold">{project.status?.name}</span>
      </p>
      <fieldset className="mt-3">
        <legend className="sr-only">Nuevo estado</legend>
        <div className="space-y-2">
          {options.map((o) => {
            const checked = selected === o.action;
            return (
              <label
                key={o.action}
                className={`flex gap-3 rounded-lg border px-3.5 py-3 cursor-pointer transition-colors duration-150 ${
                  checked ? 'border-primary bg-tint' : 'border-line hover:bg-fill-neutral-soft'
                }`}
              >
                <input
                  type="radio"
                  name="project-status"
                  value={o.action}
                  checked={checked}
                  onChange={() => setSelected(o.action)}
                  disabled={isSaving}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                />
                <span className="min-w-0">
                  <span className={`block text-sm font-medium ${o.action === 'cancel' ? 'text-danger' : 'text-ink'}`}>
                    {o.label}
                  </span>
                  <span className="block mt-0.5 text-sm text-ink-muted">{o.effect}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
      {option?.final && (
        <p className="mt-3 text-sm text-ink">
          No se puede deshacer: después ya no se pueden modificar los datos ni los integrantes del equipo.
        </p>
      )}
      <div className="flex justify-end gap-3 pt-3 mt-4 border-t border-line">
        <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
          Volver
        </Button>
        <Button
          type="button"
          variant={option?.action === 'cancel' ? 'destructive' : 'primary'}
          onClick={handleConfirm}
          disabled={!option}
          isLoading={isSaving}
        >
          {option ? option.label : 'Cambiar estado'}
        </Button>
      </div>
    </Modal>
  );
};
