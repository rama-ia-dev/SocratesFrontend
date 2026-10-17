import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CloudOff, Lock, Mail, RefreshCw, SearchX } from 'lucide-react';
import { api } from '../lib/api';
import type { ProjectMember, ProjectOverview, SectionYearPublic } from '../types/api';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../components/ui/Toast';
import { TeamSizeModal } from '../components/TeamSizeModal';
import { useAuth } from '../context/AuthContext';
import { PRIVACY_HELP, PRIVACY_LABEL, STATUS_VARIANT, studentEmail, teamLabel } from '../lib/projects';

type LoadState = 'loading' | 'ok' | 'forbidden' | 'not-found' | 'error';

// Una sección del detalle: título chico y el texto, sin recuadro propio
const Field: React.FC<{ label: string; value?: string | null }> = ({ label, value }) => (
  <section className="px-5 py-4 sm:px-6">
    <h2 className="text-[13px] font-medium text-ink-muted">{label}</h2>
    {value ? (
      <p className="mt-1.5 text-sm text-ink leading-relaxed whitespace-pre-line [overflow-wrap:anywhere]">{value}</p>
    ) : (
      <p className="mt-1.5 text-sm italic text-ink-subtle">El equipo todavía no lo completó</p>
    )}
  </section>
);

// Integrantes con su contacto; el jefe del grupo primero
const Members: React.FC<{ members: ProjectMember[] }> = ({ members }) => {
  const sorted = [...members].sort((a, b) => Number(b.is_leader) - Number(a.is_leader));
  return (
    <section className="rounded-xl border border-line bg-white">
      <h2 className="px-5 pt-4 sm:px-6 text-[15px] font-semibold text-ink">
        Integrantes <span className="font-normal text-ink-muted">({members.length})</span>
      </h2>
      {sorted.length === 0 ? (
        <p className="px-5 sm:px-6 pt-1.5 pb-4 text-sm italic text-ink-subtle">Todavía no se sumó ningún alumno</p>
      ) : (
        <ul className="mt-2 divide-y divide-line border-t border-line">
          {sorted.map((m) => (
            <li
              key={m.id_student_project}
              className="px-5 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4"
            >
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <span className="text-sm font-medium text-ink">
                  {m.last_name}, {m.first_name}
                </span>
                <span className="text-xs text-ink-muted tabular-nums">{m.legajo}</span>
                {m.is_leader && <Badge variant="leader">Jefe del grupo</Badge>}
                {m.status.code !== 'active' && <Badge variant="neutral">{m.status.name}</Badge>}
              </div>
              <a
                href={`mailto:${studentEmail(m.legajo)}`}
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline break-all"
              >
                <Mail className="w-4 h-4 shrink-0" />
                {studentEmail(m.legajo)}
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

// Detalle de un equipo de trabajo (SCRUM-105)
export const ProjectDetail: React.FC = () => {
  const { id } = useParams();
  const [project, setProject] = useState<ProjectOverview | null>(null);
  const [sectionYear, setSectionYear] = useState<SectionYearPublic | null>(null);
  const [state, setState] = useState<LoadState>('loading');
  const requestId = useRef(0);
  const { user } = useAuth();
  const { success } = useToast();
  // Cupo (SCRUM-19): el backend se lo permite solo al super administrador
  const [isSizeOpen, setIsSizeOpen] = useState(false);

  const load = useCallback(async () => {
    const current = ++requestId.current;
    const isCurrent = () => current === requestId.current;
    setProject(null);
    setSectionYear(null);
    const idProject = Number(id);
    if (!Number.isInteger(idProject) || idProject <= 0) {
      setState('not-found');
      return;
    }
    setState('loading');
    try {
      const p = await api.getProjectOverview(idProject);
      if (!isCurrent()) return;
      setProject(p);
      setState('ok');
      // El cupo vive en el curso lectivo; si no se puede leer, el detalle se muestra igual
      api
        .getSectionYear(p.id_section_year)
        .then((sy) => isCurrent() && setSectionYear(sy))
        .catch(() => undefined);
    } catch (err: any) {
      if (!isCurrent()) return;
      setState(err.status === 403 ? 'forbidden' : err.status === 404 ? 'not-found' : 'error');
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const back = (
    <Link
      to="/equipos"
      className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-primary transition-colors duration-150"
    >
      <ArrowLeft className="w-4 h-4" />
      Volver a equipos de trabajo
    </Link>
  );

  if (state !== 'ok' || !project) {
    return (
      <div className="max-w-4xl space-y-6">
        {back}
        {state === 'loading' ? (
          <div className="space-y-4" aria-busy="true">
            <div className="h-16 w-2/3 rounded-lg bg-fill-neutral animate-pulse" />
            <div className="h-40 rounded-xl bg-white border border-line animate-pulse" />
          </div>
        ) : state === 'forbidden' ? (
          <EmptyState
            icon={<Lock className="w-5 h-5" />}
            message="Este equipo es privado"
            description="Solo lo ven sus integrantes, los docentes del curso y los super administradores."
          />
        ) : state === 'not-found' ? (
          <EmptyState
            icon={<SearchX className="w-5 h-5" />}
            message="No existe el equipo de trabajo que busca"
            description="Puede que se haya eliminado."
          />
        ) : (
          <EmptyState
            icon={<CloudOff className="w-5 h-5" />}
            message="No se pudo cargar el equipo de trabajo"
            description="Puede ser un problema de conexión. Pruebe de nuevo en unos segundos."
            action={
              <Button variant="outline" size="sm" onClick={load}>
                <RefreshCw className="w-4 h-4 mr-1.5" />
                Reintentar
              </Button>
            }
          />
        )}
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      {back}

      <header>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-serif text-[28px] leading-tight font-semibold text-navy">{teamLabel(project)}</h1>
          <Badge variant={project.privacy}>{PRIVACY_LABEL[project.privacy]}</Badge>
          {project.status && (
            <Badge variant={STATUS_VARIANT[project.status.code] ?? 'neutral'}>{project.status.name}</Badge>
          )}
        </div>
        <p className="mt-1.5 text-sm text-ink-muted">
          Comisión {project.section_name} · Ciclo lectivo {project.year}
          {sectionYear?.min_students !== undefined && sectionYear.max_students !== undefined && (
            <>
              {' '}
              · Cupo: de {sectionYear.min_students} a {sectionYear.max_students} integrantes
              {user?.is_super_admin && (
                <>
                  {' '}
                  <button
                    type="button"
                    onClick={() => setIsSizeOpen(true)}
                    className="text-primary font-medium hover:underline cursor-pointer"
                  >
                    Modificar cupo
                  </button>
                </>
              )}
            </>
          )}
        </p>
        <p className="mt-1 text-xs text-ink-subtle">{PRIVACY_HELP[project.privacy]}</p>
      </header>

      {project.restricted ? (
        <EmptyState
          icon={<Lock className="w-5 h-5" />}
          message="El detalle del proyecto es reservado"
          description="El equipo es protegido: el detalle lo ven sus integrantes y los docentes del curso."
        />
      ) : (
        <div className="rounded-xl border border-line bg-white divide-y divide-line">
          <Field label="Nombre del proyecto" value={project.name} />
          <Field label="Descripción" value={project.description} />
          <Field label="Objetivo" value={project.objective} />
          <Field label="Problemática" value={project.problem} />
        </div>
      )}

      <Members members={project.members} />

      {isSizeOpen && sectionYear && (
        <TeamSizeModal
          sectionYear={sectionYear}
          onClose={() => setIsSizeOpen(false)}
          onSaved={(updated) => {
            setSectionYear(updated);
            setIsSizeOpen(false);
            success(
              `Cupo de ${updated.section_name} (${updated.year}): de ${updated.min_students} a ${updated.max_students} integrantes`
            );
          }}
        />
      )}
    </div>
  );
};
