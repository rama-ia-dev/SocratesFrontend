import React, { useState } from 'react';
import { ExternalLink, FolderOpen } from 'lucide-react';
import { api } from '../lib/api';
import type { ProjectOverview, ProjectPublic } from '../types/api';
import { Alert } from './ui/Alert';
import { Button } from './ui/Button';
import { Input } from './ui/Input';

const isHttpUrl = (value: string) => {
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && Boolean(url.host);
  } catch {
    return false;
  }
};

// Error del backend al guardar el enlace, en palabras del usuario
const saveError = (err: any): string => {
  if (err?.status === 409) return 'El equipo ya está aprobado o cancelado: el enlace no se puede cambiar.';
  if (err?.status === 403) return 'Lo registran los docentes del curso lectivo y el administrador.';
  if (err?.status === 404) return 'El equipo ya no existe: puede que lo hayan eliminado.';
  if (err?.status === 422) return 'Ingrese una dirección que empiece con http:// o https://';
  return err?.message || 'No se pudo guardar el enlace. Intente nuevamente.';
};

/**
 * Carpeta de Drive del equipo (SCRUM-49): la que contiene la documentación de todas sus entregas.
 * La ve quien ve el detalle del equipo; la registran, cambian o quitan los docentes del curso
 * lectivo y el administrador, salvo con el equipo aprobado o cancelado.
 */
export const DriveFolder: React.FC<{
  project: ProjectOverview;
  canEdit: boolean;
  onSaved: (updated: ProjectPublic, removed: boolean) => void;
}> = ({ project, canEdit, onSaved }) => {
  const current = project.drive_folder_url ?? null;
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(current ?? '');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<'save' | 'remove' | null>(null);

  const open = () => {
    setValue(current ?? '');
    setFieldError(null);
    setError(null);
    setEditing(true);
  };

  const save = async (next: string | null) => {
    setError(null);
    setSaving(next === null ? 'remove' : 'save');
    try {
      const updated = await api.updateProject(project.id_project, { drive_folder_url: next });
      setEditing(false);
      onSaved(updated, next === null);
    } catch (err: any) {
      if (err?.status === 422) setFieldError(saveError(err));
      else setError(saveError(err));
    } finally {
      setSaving(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const next = value.trim();
    if (!next) {
      setFieldError('Ingrese el enlace a la carpeta');
      return;
    }
    if (!isHttpUrl(next)) {
      setFieldError('Ingrese una dirección que empiece con http:// o https://');
      return;
    }
    setFieldError(null);
    if (next === current) {
      setEditing(false);
      return;
    }
    save(next);
  };

  return (
    <section className="rounded-xl border border-line bg-white px-5 py-4 sm:px-6">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold text-ink">Carpeta de Drive</h2>
          <p className="mt-0.5 text-sm text-ink-muted">La documentación de todas las entregas del equipo.</p>
        </div>
        {canEdit && !editing && (
          <Button size="sm" variant="outline" onClick={open}>
            {current ? 'Modificar enlace' : 'Registrar enlace'}
          </Button>
        )}
      </div>

      {editing ? (
        <form onSubmit={handleSubmit} className="mt-3 space-y-3" noValidate>
          {error && <Alert>{error}</Alert>}
          <Input
            id="drive-folder-url"
            label="Enlace a la carpeta"
            type="url"
            inputMode="url"
            placeholder="https://drive.google.com/drive/folders/…"
            maxLength={1000}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            error={fieldError ?? undefined}
            disabled={saving !== null}
            autoFocus
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" size="sm" isLoading={saving === 'save'} disabled={saving !== null}>
              Guardar
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)} disabled={saving !== null}>
              Cancelar
            </Button>
            {current && (
              <Button
                type="button"
                size="sm"
                variant="ghostDanger"
                className="sm:ml-auto"
                onClick={() => save(null)}
                isLoading={saving === 'remove'}
                disabled={saving !== null}
              >
                Quitar enlace
              </Button>
            )}
          </div>
        </form>
      ) : current ? (
        <a
          href={current}
          target="_blank"
          rel="noreferrer"
          className="mt-3 flex items-center gap-3 rounded-lg border border-line px-3 py-2.5 hover:bg-canvas transition-colors group"
        >
          <span className="w-9 h-9 rounded-lg bg-tint text-navy flex items-center justify-center shrink-0">
            <FolderOpen className="w-[18px] h-[18px]" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-primary group-hover:underline">Abrir la carpeta de Drive</span>
            <span className="block truncate text-xs text-ink-muted">{current}</span>
          </span>
          <ExternalLink className="w-4 h-4 text-ink-faint shrink-0" aria-hidden="true" />
        </a>
      ) : (
        <p className="mt-3 text-sm italic text-ink-subtle">Todavía no se registró la carpeta del equipo</p>
      )}
    </section>
  );
};
