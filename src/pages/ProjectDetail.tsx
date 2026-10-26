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

// Integrantes con su contacto; el jefe del grupo primero. El cupo va aparte: es del curso lectivo
// y se exige recién al asegurar el equipo, no es la cantidad que tiene hoy.
const Members: React.FC<{ members: ProjectMember[]; cupo?: React.ReactNode }> = ({ members, cupo }) => {
  const sorted = [...members].sort((a, b) => Number(b.is_leader) - Number(a.is_leader));
  return (
    <section className="rounded-xl border border-line bg-white">
      <div className="px-5 pt-4 sm:px-6 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
        <h2 className="text-[15px] font-semibold text-ink">
          Integrantes <span className="font-normal text-ink-muted">({members.length})</span>
        </h2>
        {cupo && <p className="text-sm text-ink-muted">{cupo}</p>}
      </div>
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

// Error del backend al aceptar o rechazar una solicitud, en palabras del usuario
const decideError = (err: any): string => {
  const detail = String(err.message || '');
  if (err.status === 409) {
    if (detail.includes('already belongs')) return 'El alumno ya forma parte de otro equipo';
    if (detail.includes('cannot change to')) return 'La solicitud ya no está pendiente';
  }
  if (err.status === 403) return 'Solo el jefe del grupo puede aceptar o rechazar solicitudes';
  if (err.status === 404) return 'La solicitud ya no existe';
  return detail || 'No se pudo responder la solicitud';
};

// Solicitudes para sumarse (SCRUM-24): las ve y las decide solo el jefe del grupo
const Requests: React.FC<{
  requests: ProjectMember[];
  busyId: number | null;
  onDecide: (m: ProjectMember, status: 'active' | 'rejected') => void;
}> = ({ requests, busyId, onDecide }) => (
  <section className="rounded-xl border border-line bg-white">
    <div className="px-5 pt-4 sm:px-6">
      <h2 className="text-[15px] font-semibold text-ink">
        Solicitudes para sumarse <span className="font-normal text-ink-muted">({requests.length})</span>
      </h2>
      <p className="mt-0.5 text-sm text-ink-muted">
        Si acepta a un alumno, pasa a ser integrante del equipo y se rechazan sus solicitudes a otros equipos.
      </p>
    </div>
    {requests.length === 0 ? (
      <p className="px-5 sm:px-6 pt-1.5 pb-4 text-sm italic text-ink-subtle">No hay solicitudes pendientes</p>
    ) : (
      <ul className="mt-3 divide-y divide-line border-t border-line">
        {requests.map((r) => (
          <li
            key={r.id_student_project}
            className="px-5 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4"
          >
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <span className="text-sm font-medium text-ink">
                {r.last_name}, {r.first_name}
              </span>
              <span className="text-xs text-ink-muted tabular-nums">{r.legajo}</span>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                size="sm"
                onClick={() => onDecide(r, 'active')}
                disabled={busyId !== null}
                isLoading={busyId === r.id_student_project}
              >
                Aceptar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDecide(r, 'rejected')}
                disabled={busyId !== null}
              >
                Rechazar
              </Button>
            </div>
          </li>
        ))}
      </ul>
    )}
  </section>
);

// Detalle de un equipo de trabajo (SCRUM-105)
export const ProjectDetail: React.FC = () => {
  const { id } = useParams();
  const [project, setProject] = useState<ProjectOverview | null>(null);
  const [sectionYear, setSectionYear] = useState<SectionYearPublic | null>(null);
  const [state, setState] = useState<LoadState>('loading');
  const requestId = useRef(0);
  const { user } = useAuth();
  const { success, error: showError } = useToast();
  // Cupo (SCRUM-19): el backend se lo permite solo al super administrador
  const [isSizeOpen, setIsSizeOpen] = useState(false);
  // Solicitudes pendientes (SCRUM-24); null mientras no se sabe si el usuario es el jefe
  const [requests, setRequests] = useState<ProjectMember[] | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  // `keep`: recarga después de una acción, sin vaciar la pantalla mientras llegan los datos nuevos
  const load = useCallback(async (keep = false) => {
    const current = ++requestId.current;
    const isCurrent = () => current === requestId.current;
    if (!keep) {
      setProject(null);
      setSectionYear(null);
      setRequests(null);
    }
    const idProject = Number(id);
    if (!Number.isInteger(idProject) || idProject <= 0) {
      setState('not-found');
      return;
    }
    if (!keep) setState('loading');
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
      // Solo el jefe del grupo ve las solicitudes, y solo existen mientras el equipo no está asegurado
      const isLeader = p.members.some(
        (m) => m.id_student === user?.id_user && m.is_leader && m.status.code === 'active'
      );
      if (isLeader && p.status?.code === 'uninsured') {
        api
          .getProjectMembers(idProject, ['pending_approval'])
          .then((r) => isCurrent() && setRequests(r.items))
          .catch(() => isCurrent() && setRequests([]));
      } else {
        setRequests(null);
      }
    } catch (err: any) {
      if (!isCurrent()) return;
      setState(err.status === 403 ? 'forbidden' : err.status === 404 ? 'not-found' : 'error');
    }
  }, [id, user?.id_user]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDecide = async (m: ProjectMember, status: 'active' | 'rejected') => {
    if (!project) return;
    setBusyId(m.id_student_project);
    try {
      await api.decideMembership(project.id_project, m.id_student_project, status);
      success(
        status === 'active'
          ? `${m.first_name} ${m.last_name} se sumó al equipo`
          : `Se rechazó la solicitud de ${m.first_name} ${m.last_name}`
      );
    } catch (err: any) {
      showError(decideError(err));
    } finally {
      setBusyId(null);
      load(true);
    }
  };

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
              <Button variant="outline" size="sm" onClick={() => load()}>
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

      <Members
        members={project.members}
        cupo={
          sectionYear?.min_students !== undefined &&
          sectionYear.max_students !== undefined && (
            <>
              Cupo para asegurar el equipo: de {sectionYear.min_students} a {sectionYear.max_students}
              {user?.is_super_admin && (
                <>
                  {' · '}
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
          )
        }
      />

      {requests && <Requests requests={requests} busyId={busyId} onDecide={handleDecide} />}

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
