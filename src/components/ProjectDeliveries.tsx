import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { DeliveryPublic } from '../types/api';
import { Badge } from './ui/Badge';
import { DeliveryModal } from './DeliveryModal';
import { CATEGORY_LABEL, formatDue, latestGrade, statusVariant } from '../lib/deliveries';
import { ChevronRight, ExternalLink } from 'lucide-react';

/**
 * Entregas de un equipo (SCRUM-62), en el detalle del equipo: una por cada entrega del calendario
 * de su curso lectivo, con estado, notas y enlace. Cada una se abre para manejarla. Solo docentes
 * del curso lectivo y administrador.
 */
export const ProjectDeliveries: React.FC<{ idProject: number }> = ({ idProject }) => {
  const [deliveries, setDeliveries] = useState<DeliveryPublic[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<DeliveryPublic | null>(null);

  const load = useCallback(() => {
    setFailed(false);
    api
      .getProjectDeliveries(idProject)
      .then(setDeliveries)
      .catch(() => setFailed(true));
  }, [idProject]);

  useEffect(() => {
    load();
  }, [load]);

  const handleChanged = useCallback((d: DeliveryPublic) => {
    setDeliveries((prev) => (prev ?? []).map((x) => (x.id_delivery === d.id_delivery ? d : x)));
  }, []);

  return (
    <section className="rounded-xl border border-line bg-white">
      <div className="px-5 pt-4 sm:px-6">
        <h2 className="text-[15px] font-semibold text-ink">
          Entregas
          {deliveries && <span className="font-normal text-ink-muted"> ({deliveries.length})</span>}
        </h2>
        <p className="mt-0.5 text-sm text-ink-muted">Estado y notas del equipo en cada entrega del curso lectivo.</p>
      </div>
      <div className="px-5 sm:px-6 pt-3 pb-4">
        {failed ? (
          <p className="text-sm text-ink-muted">
            No se pudieron cargar las entregas.{' '}
            <button type="button" onClick={load} className="text-primary font-medium hover:underline cursor-pointer">
              Reintentar
            </button>
          </p>
        ) : deliveries === null ? (
          <div className="space-y-2" aria-busy="true">
            {[0, 1].map((i) => (
              <div key={i} className="h-14 rounded-lg bg-fill-neutral animate-pulse" />
            ))}
          </div>
        ) : deliveries.length === 0 ? (
          <p className="text-sm italic text-ink-subtle">El curso lectivo todavía no tiene entregas en el calendario</p>
        ) : (
          <ul className="divide-y divide-line -mx-2">
            {deliveries.map((d) => {
              const grades = (['activity'] as const)
                .map((c) => {
                  const g = latestGrade(d, c);
                  return g ? `${CATEGORY_LABEL[c]}: ${g.score.name}` : null;
                })
                .filter(Boolean);
              return (
                <li key={d.id_delivery} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(d)}
                    className="flex-1 min-w-0 flex items-center gap-3 rounded-lg px-2 py-3 text-left hover:bg-canvas cursor-pointer transition-colors"
                  >
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-ink [overflow-wrap:anywhere]">{d.activity.title}</span>
                      <span className="block text-xs text-ink-muted">
                        {formatDue(d.activity.due_date, d.activity.due_time)}
                        {grades.length > 0 && ` · ${grades.join(' · ')}`}
                      </span>
                    </span>
                    <Badge variant={statusVariant(d.status.code)} className="shrink-0">
                      {d.status.name}
                    </Badge>
                    <ChevronRight className="w-4 h-4 text-ink-faint shrink-0" aria-hidden="true" />
                  </button>
                  {/* Sin enlace, el lugar del ícono queda vacío para que las filas no se corran */}
                  {!d.link && <span className="w-8 shrink-0" aria-hidden="true" />}
                  {d.link && (
                    <a
                      href={d.link}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Abrir los documentos de ${d.activity.title}`}
                      title="Abrir los documentos"
                      className="shrink-0 rounded-lg p-2 text-ink-muted hover:text-primary hover:bg-canvas"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {open && <DeliveryModal delivery={open} onClose={() => setOpen(null)} onChanged={handleChanged} />}
    </section>
  );
};
