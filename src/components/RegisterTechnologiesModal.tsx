import React, { useEffect, useMemo, useState } from 'react';
import { Check, Plus, Search } from 'lucide-react';
import { api } from '../lib/api';
import { teamLabel } from '../lib/projects';
import type { ProjectOverview, TechnologyPublic } from '../types/api';
import { Alert } from './ui/Alert';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Modal } from './ui/Modal';

interface Props {
  project: ProjectOverview;
  /** Las que el proyecto ya tiene registradas: se muestran marcadas y no se pueden elegir de nuevo */
  registered: TechnologyPublic[];
  onClose: () => void;
  /** Se registraron (o algo cambió en el backend y hay que recargar el detalle) */
  onChanged: () => void;
  onRegistered: (names: string[]) => void;
}

const sameName = (a: string, b: string) => a.trim().toLocaleLowerCase('es') === b.trim().toLocaleLowerCase('es');

// Error del backend al registrar, en palabras del docente
const registerError = (err: any): string => {
  const detail = String(err.message || '');
  if (err.status === 409) {
    if (detail.includes('final state'))
      return 'El equipo está aprobado o cancelado: sus tecnologías ya no se pueden modificar.';
    return 'Las tecnologías del proyecto cambiaron mientras se registraban. Se actualizó la lista: revise la selección e intente nuevamente.';
  }
  if (err.status === 422)
    return 'Alguna de las tecnologías elegidas ya estaba registrada o se eliminó del catálogo. Se actualizó la lista: revise la selección e intente nuevamente.';
  if (err.status === 403)
    return 'Solo los docentes del curso lectivo y los administradores pueden registrar tecnologías.';
  if (err.status === 404) return 'El equipo de trabajo ya no existe.';
  return detail || 'No se pudieron registrar las tecnologías.';
};

// Registrar tecnologías utilizadas en el proyecto (SCRUM-42): se eligen del catálogo, y la que no
// está se agrega al catálogo desde acá
export const RegisterTechnologiesModal: React.FC<Props> = ({
  project,
  registered,
  onClose,
  onChanged,
  onRegistered,
}) => {
  const [catalog, setCatalog] = useState<TechnologyPublic[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  // El equipo pasó a un estado final: solo queda el motivo y Cerrar
  const [isLocked, setIsLocked] = useState(false);

  const loadCatalog = () => {
    setLoadError(null);
    return api
      .getAllTechnologies()
      .then((items) => {
        setCatalog(items);
        return items;
      })
      .catch(() => {
        setLoadError('No se pudo cargar el catálogo de tecnologías.');
        return null;
      });
  };

  useEffect(() => {
    loadCatalog();
  }, []);

  const registeredIds = useMemo(() => new Set(registered.map((t) => t.id_technology)), [registered]);
  const term = query.trim();
  const visible = useMemo(
    () =>
      (catalog ?? []).filter((t) => t.name.toLocaleLowerCase('es').includes(term.toLocaleLowerCase('es'))),
    [catalog, term]
  );
  const exactMatch = term !== '' && (catalog ?? []).some((t) => sameName(t.name, term));
  const busy = isCreating || isSaving;

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Agrega al catálogo la tecnología buscada y la deja elegida
  const handleCreate = async () => {
    if (!term) return;
    setIsCreating(true);
    setErrorText(null);
    try {
      const created = await api.createTechnology(term);
      setCatalog((prev) =>
        [...(prev ?? []), created].sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }))
      );
      setSelected((prev) => new Set(prev).add(created.id_technology));
      setQuery('');
    } catch (err: any) {
      if (err.status === 409) {
        // Otro usuario la agregó mientras tanto: se recarga el catálogo y se elige la existente
        const items = await loadCatalog();
        const existing = items?.find((t) => sameName(t.name, term));
        if (existing && !registeredIds.has(existing.id_technology)) {
          setSelected((prev) => new Set(prev).add(existing.id_technology));
          setQuery('');
        } else {
          setErrorText(`«${term}» ya existe en el catálogo.`);
        }
      } else if (err.status === 403) {
        setErrorText('Solo los docentes y los administradores pueden agregar tecnologías al catálogo.');
      } else if (err.status === 422) {
        setErrorText('El nombre de la tecnología puede tener hasta 100 caracteres.');
      } else {
        setErrorText(err.message || 'No se pudo agregar la tecnología al catálogo.');
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleSave = async () => {
    if (selected.size === 0) return;
    setIsSaving(true);
    setErrorText(null);
    try {
      const ids = [...selected];
      await api.addProjectTechnologies(project.id_project, ids);
      const names = (catalog ?? []).filter((t) => selected.has(t.id_technology)).map((t) => t.name);
      onRegistered(names);
    } catch (err: any) {
      setErrorText(registerError(err));
      if (err.status === 409 && String(err.message || '').includes('final state')) {
        setIsLocked(true);
        onChanged();
      } else if (err.status === 409 || err.status === 422) {
        setSelected(new Set());
        loadCatalog();
        onChanged();
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={() => !busy && onClose()} title="Registrar tecnologías" maxWidth="lg">
      <p className="text-sm text-ink-muted">
        Seleccione las tecnologías utilizadas en el proyecto del {teamLabel(project)}. Si una tecnología no figura
        en el catálogo, búsquela por su nombre y agréguela.
      </p>

      {errorText && <Alert className="mt-4">{errorText}</Alert>}

      {isLocked ? (
        <div className="flex justify-end pt-3 mt-4 border-t border-line">
          <Button type="button" variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      ) : (
        <>
          <div className="mt-4">
            <Input
              aria-label="Buscar tecnología"
              placeholder="Buscar tecnología"
              value={query}
              maxLength={100}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (term && !exactMatch && !busy) handleCreate();
                }
              }}
              leftIcon={<Search className="w-4 h-4" />}
              disabled={catalog === null}
            />
          </div>

          <div className="mt-3 rounded-lg border border-line max-h-72 overflow-y-auto">
            {loadError ? (
              <div className="p-4 text-sm text-ink-muted space-y-2">
                <p>{loadError}</p>
                <Button size="sm" variant="outline" onClick={() => loadCatalog()}>
                  Reintentar
                </Button>
              </div>
            ) : catalog === null ? (
              <div className="p-4 space-y-2" aria-busy="true">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-5 rounded bg-fill-neutral animate-pulse" />
                ))}
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {term && !exactMatch && (
                  <li>
                    <button
                      type="button"
                      onClick={handleCreate}
                      disabled={busy}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm text-primary font-medium hover:bg-tint disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
                    >
                      <Plus className="w-4 h-4 shrink-0" />
                      <span className="[overflow-wrap:anywhere]">
                        {isCreating ? 'Agregando…' : `Agregar «${term}» al catálogo`}
                      </span>
                    </button>
                  </li>
                )}
                {visible.length === 0 && !term && (
                  <li className="px-3 py-3 text-sm italic text-ink-subtle">El catálogo todavía no tiene tecnologías</li>
                )}
                {visible.map((t) => {
                  const isRegistered = registeredIds.has(t.id_technology);
                  const checked = isRegistered || selected.has(t.id_technology);
                  return (
                    <li key={t.id_technology}>
                      <label
                        className={`flex items-center gap-3 px-3 py-2.5 text-sm ${
                          isRegistered ? 'text-ink-muted cursor-default' : 'text-ink hover:bg-canvas cursor-pointer'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="w-4 h-4 accent-primary shrink-0"
                          checked={checked}
                          disabled={isRegistered || busy}
                          onChange={() => toggle(t.id_technology)}
                        />
                        <span className="flex-1 min-w-0 [overflow-wrap:anywhere]">{t.name}</span>
                        {isRegistered && (
                          <span className="inline-flex items-center gap-1 text-xs text-ink-muted shrink-0">
                            <Check className="w-3.5 h-3.5" />
                            Ya registrada
                          </span>
                        )}
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-3 mt-4 border-t border-line">
            <p className="text-sm text-ink-muted">
              {selected.size === 0
                ? 'Ninguna tecnología seleccionada'
                : selected.size === 1
                ? '1 tecnología seleccionada'
                : `${selected.size} tecnologías seleccionadas`}
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-3">
              <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
                Cancelar
              </Button>
              <Button type="button" onClick={handleSave} isLoading={isSaving} disabled={selected.size === 0 || isCreating}>
                Registrar
              </Button>
            </div>
          </div>
        </>
      )}
    </Modal>
  );
};
