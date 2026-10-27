import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, CloudOff, FolderKanban, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';
import type { MyProject } from '../types/api';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { ProjectDetail } from './ProjectDetail';
import { teamLabel } from '../lib/projects';

type LoadState = 'loading' | 'ok' | 'error';

// Mi equipo (SCRUM-585): el equipo del alumno, con el mismo detalle que el resto de los equipos.
// Mientras no integra ninguno, sus solicitudes para sumarse, pendientes y rechazadas.
export const MyTeam: React.FC = () => {
  const [data, setData] = useState<MyProject | null>(null);
  const [state, setState] = useState<LoadState>('loading');
  const requestId = useRef(0);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    const current = ++requestId.current;
    setState('loading');
    try {
      const d = await api.getMyProject();
      if (current !== requestId.current) return;
      setData(d);
      setState('ok');
    } catch {
      if (current !== requestId.current) return;
      setState('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (state === 'ok' && data?.project) return <ProjectDetail projectId={data.project.id_project} />;

  const toTeams = (
    <Button variant="outline" size="sm" onClick={() => navigate('/equipos')}>
      Ver equipos de trabajo
    </Button>
  );

  return (
    <div className="max-w-4xl">
      <PageHeader title="Mi equipo" subtitle={state === 'ok' ? 'Todavía no integra ningún equipo de trabajo' : undefined} />

      {state === 'loading' ? (
        <div className="h-40 rounded-xl bg-white border border-line animate-pulse" aria-busy="true" />
      ) : state === 'error' || !data ? (
        <EmptyState
          icon={<CloudOff className="w-5 h-5" />}
          message="No se pudo cargar su equipo"
          description="Puede ser un problema de conexión. Pruebe de nuevo en unos segundos."
          action={
            <Button variant="outline" size="sm" onClick={load}>
              <RefreshCw className="w-4 h-4 mr-1.5" />
              Reintentar
            </Button>
          }
        />
      ) : data.requests.length === 0 ? (
        <EmptyState
          icon={<FolderKanban className="w-5 h-5" />}
          message="No tiene solicitudes para sumarse a un equipo"
          description="Los equipos de su comisión están en Equipos de trabajo."
          action={toTeams}
        />
      ) : (
        <section className="rounded-xl border border-line bg-white overflow-hidden">
          <div className="px-5 pt-4 sm:px-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold text-ink">
                Mis solicitudes para sumarse <span className="font-normal text-ink-muted">({data.requests.length})</span>
              </h2>
              <p className="mt-0.5 text-sm text-ink-muted">
                El jefe de cada equipo decide si lo acepta. Si lo aceptan en uno, sus otras solicitudes se rechazan.
              </p>
            </div>
            <div className="shrink-0">{toTeams}</div>
          </div>
          <ul className="mt-3 divide-y divide-line border-t border-line">
            {data.requests.map((r) => (
              <li key={r.id_project}>
                <Link
                  to={`/equipos/${r.id_project}`}
                  className="group px-5 sm:px-6 py-3 flex items-center gap-4 hover:bg-canvas transition-colors duration-150"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-ink">{teamLabel(r)}</span>
                      {r.status && (
                        <Badge variant={r.status.code === 'rejected' ? 'private' : 'protected'}>{r.status.name}</Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-ink-muted [overflow-wrap:anywhere]">
                      Comisión {r.section_name} · Ciclo lectivo {r.year}
                      {r.project_name && ` · ${r.project_name}`}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-ink-faint shrink-0 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-ink-muted" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};
