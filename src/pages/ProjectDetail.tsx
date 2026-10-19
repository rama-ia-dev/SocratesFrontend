import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Lock, Mail, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';
import type { ProjectMember, ProjectOverview, SectionYearPublic } from '../types/api';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { PRIVACY_HELP, PRIVACY_LABEL, STATUS_VARIANT, studentEmail, teamLabel } from '../lib/projects';

type LoadState = 'loading' | 'ok' | 'forbidden' | 'not-found' | 'error';

const Field: React.FC<{ label: string; value?: string | null; className?: string }> = ({
  label,
  value,
  className = '',
}) => (
  <section className={`rounded-xl border border-[#D6E4F7] bg-white p-5 ${className}`}>
    <h2 className="text-[12px] font-semibold uppercase tracking-wider text-[#51607A]">{label}</h2>
    {value ? (
      <p className="mt-2 text-sm text-[#0F1F3D] leading-relaxed whitespace-pre-line">{value}</p>
    ) : (
      <p className="mt-2 text-sm italic text-[#8A9AB5]">El equipo todavía no lo completó</p>
    )}
  </section>
);

// Integrantes con su contacto; el jefe del grupo primero
const Members: React.FC<{ members: ProjectMember[] }> = ({ members }) => {
  const sorted = [...members].sort((a, b) => Number(b.is_leader) - Number(a.is_leader));
  return (
    <section className="rounded-xl border border-[#D6E4F7] bg-white p-5">
      <h2 className="text-[12px] font-semibold uppercase tracking-wider text-[#51607A]">
        Integrantes ({members.length})
      </h2>
      {sorted.length === 0 ? (
        <p className="mt-2 text-sm italic text-[#8A9AB5]">Todavía no se sumó ningún alumno</p>
      ) : (
        <ul className="mt-3 divide-y divide-[#EEF3FB]">
          {sorted.map((m) => (
            <li
              key={m.id_student_project}
              className="py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4"
            >
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <span className="text-sm font-medium text-[#0F1F3D]">
                  {m.last_name}, {m.first_name}
                </span>
                <span className="text-xs font-mono text-[#51607A]">{m.legajo}</span>
                {m.is_leader && <Badge variant="superadmin">Jefe del grupo</Badge>}
                {m.status.code !== 'active' && <Badge variant="neutral">{m.status.name}</Badge>}
              </div>
              <a
                href={`mailto:${studentEmail(m.legajo)}`}
                className="inline-flex items-center gap-1.5 text-sm text-[#1D4ED8] hover:underline break-all"
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
      className="inline-flex items-center gap-1.5 text-sm text-[#51607A] hover:text-[#1D4ED8]"
    >
      <ArrowLeft className="w-4 h-4" />
      Volver a equipos de trabajo
    </Link>
  );

  if (state !== 'ok' || !project) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        {back}
        {state === 'loading' ? (
          <div className="space-y-4" aria-busy="true">
            <div className="h-28 rounded-xl bg-white border border-[#D6E4F7] animate-pulse" />
            <div className="h-20 rounded-xl bg-white border border-[#D6E4F7] animate-pulse" />
          </div>
        ) : (
          <EmptyState
            icon={state === 'forbidden' ? <Lock className="w-6 h-6" /> : undefined}
            message={
              state === 'forbidden'
                ? 'Este equipo es privado: solo lo ven sus integrantes, los docentes del curso y los super administradores.'
                : state === 'not-found'
                  ? 'No existe el equipo de trabajo que busca. Puede que se haya eliminado.'
                  : 'No se pudo cargar el equipo de trabajo.'
            }
            action={
              state === 'error' ? (
                <Button variant="outline" size="sm" onClick={load}>
                  <RefreshCw className="w-4 h-4 mr-1.5" />
                  Reintentar
                </Button>
              ) : undefined
            }
          />
        )}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {back}

      <header className="rounded-xl border border-[#D6E4F7] bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-[#0B2A66]">{teamLabel(project)}</h1>
          <Badge variant={project.privacy}>{PRIVACY_LABEL[project.privacy]}</Badge>
          {project.status && (
            <Badge variant={STATUS_VARIANT[project.status.code] ?? 'neutral'}>{project.status.name}</Badge>
          )}
        </div>
        <p className="mt-2 text-sm text-[#51607A]">
          Comisión {project.section_name} · Ciclo lectivo {project.year}
          {sectionYear?.min_students !== undefined && sectionYear.max_students !== undefined && (
            <>
              {' '}
              · Cupo: de {sectionYear.min_students} a {sectionYear.max_students} integrantes
            </>
          )}
        </p>
        <p className="mt-1 text-xs text-[#8A9AB5]">{PRIVACY_HELP[project.privacy]}</p>
      </header>

      {project.restricted ? (
        <EmptyState
          icon={<Lock className="w-6 h-6" />}
          message="El equipo es protegido: el detalle del proyecto lo ven sus integrantes y los docentes del curso."
        />
      ) : (
        <>
          <Field label="Nombre del proyecto" value={project.name} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Descripción" value={project.description} />
            <Field label="Objetivo" value={project.objective} />
          </div>
          <Field label="Problemática" value={project.problem} />
        </>
      )}

      <Members members={project.members} />
    </div>
  );
};
