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
  /** Qué ocurre al confirmar */
  effect: string;
  /** Aprobar y cancelar son estados finales: después no se puede modificar el equipo */
  final?: boolean;
}

const START: Option = {
  action: 'start',
  label: 'Pasar a En proceso',
  effect: 'El proyecto pasa al estado En proceso: el equipo comienza su desarrollo.',
};
const SUBMIT: Option = {
  action: 'submit',
  label: 'Enviar a aprobación',
  effect:
    'El proyecto pasa al estado Pendiente de aprobación hasta que un docente del curso lectivo lo apruebe o lo rechace.',
};
const APPROVE: Option = {
  action: 'approve',
  label: 'Aprobar el proyecto',
  effect:
    'El proyecto pasa al estado Aprobado. Los integrantes finalizan su participación en el equipo y su cursada del curso lectivo se registra como aprobada. Las solicitudes pendientes se rechazan.',
  final: true,
};
const REJECT: Option = {
  action: 'reject',
  label: 'Rechazar el proyecto',
  effect:
    'El proyecto pasa al estado Rechazado. El equipo conserva a sus integrantes y puede corregirlo para volver a enviarlo a aprobación.',
};
const RETRY: Option = {
  action: 'retry',
  label: 'Pasar a En proceso',
  effect:
    'El proyecto vuelve al estado En proceso para que el equipo lo corrija y lo envíe nuevamente a aprobación.',
};
const CANCEL: Option = {
  action: 'cancel',
  label: 'Cancelar el equipo de trabajo',
  effect:
    'El equipo pasa al estado Cancelado. Sus integrantes quedan registrados como abandono y su cursada del curso lectivo, como desaprobada. Las solicitudes pendientes se rechazan.',
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

// Estado al que llega el equipo con cada acción, para el aviso de confirmación
const TARGET: Record<ProjectStatusAction, string> = {
  start: 'En proceso',
  submit: 'Pendiente de aprobación',
  approve: 'Aprobado',
  reject: 'Rechazado',
  retry: 'En proceso',
  cancel: 'Cancelado',
};

const statusError = (err: any): string => {
  if (err.status === 409)
    return 'El estado del equipo cambió mientras se realizaba la operación. La información se actualizó: verifique el estado actual antes de continuar.';
  if (err.status === 403)
    return 'Solo los docentes del curso lectivo y los administradores pueden cambiar el estado del equipo.';
  if (err.status === 404) return 'El equipo de trabajo ya no existe.';
  return err.message || 'No se pudo cambiar el estado del equipo. Intente nuevamente en unos segundos.';
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
      success(`El estado del ${team} se cambió a ${TARGET[option.action]}`);
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
      <fieldset className="mt-4">
        <legend className="text-[13px] font-medium text-ink-muted">Seleccione la acción a realizar</legend>
        <div className="mt-2 space-y-2">
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
          Esta acción no se puede deshacer. Una vez confirmada, no se podrán modificar los datos ni los integrantes del equipo.
        </p>
      )}
      {/* En pantallas angostas los botones se apilan: la acción puede tener un nombre largo */}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3 pt-3 mt-4 border-t border-line">
        <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
          Cerrar
        </Button>
        <Button
          type="button"
          variant={option?.action === 'cancel' ? 'destructive' : 'primary'}
          onClick={handleConfirm}
          disabled={!option}
          isLoading={isSaving}
        >
          {option ? option.label : 'Confirmar'}
        </Button>
      </div>
    </Modal>
  );
};
