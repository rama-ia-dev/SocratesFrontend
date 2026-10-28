import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CloudOff, Lock, Mail, Pencil, RefreshCw, SearchX, ShieldCheck, UserPlus } from 'lucide-react';
import { api } from '../lib/api';
import type { ProjectMember, ProjectOverview, SectionYearPublic } from '../types/api';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import { TeamSizeModal } from '../components/TeamSizeModal';
import { EditProjectModal } from '../components/EditProjectModal';
import { AddMemberModal } from '../components/AddMemberModal';
import { MoveMemberModal } from '../components/MoveMemberModal';
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
const Members: React.FC<{
  members: ProjectMember[];
  cupo?: React.ReactNode;
  action?: (m: ProjectMember) => React.ReactNode;
  /** Acción sobre todo el equipo, debajo del cupo (asegurarlo). */
  teamAction?: React.ReactNode;
}> = ({ members, cupo, action, teamAction }) => {
  const sorted = [...members].sort((a, b) => Number(b.is_leader) - Number(a.is_leader));
  return (
    <section className="rounded-xl border border-line bg-white">
      <div className="px-5 pt-4 sm:px-6 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
        <h2 className="text-[15px] font-semibold text-ink">
          Integrantes <span className="font-normal text-ink-muted">({members.length})</span>
        </h2>
        {(cupo || teamAction) && (
          <div className="flex flex-col sm:items-end gap-2">
            {cupo && <p className="text-sm text-ink-muted">{cupo}</p>}
            {teamAction}
          </div>
        )}
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
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <a
                  href={`mailto:${studentEmail(m.legajo)}`}
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline break-all"
                >
                  <Mail className="w-4 h-4 shrink-0" />
                  {studentEmail(m.legajo)}
                </a>
                {action?.(m)}
              </div>
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

// Error del backend al pasar la jefatura, en palabras del usuario
const leaderError = (err: any): string => {
  const detail = String(err.message || '');
  if (err.status === 409) {
    if (detail.includes('final state')) return 'El equipo ya está aprobado o cancelado: la jefatura no cambia';
    if (detail.includes('already the group leader')) return 'Ya es el jefe del grupo';
    if (detail.includes('active member')) return 'La jefatura solo se le pasa a un integrante activo';
  }
  if (err.status === 403) return 'Solo el jefe del grupo puede pasar la jefatura';
  if (err.status === 404) return 'El integrante ya no está en el equipo';
  return detail || 'No se pudo pasar la jefatura';
};

// Error del backend al sacar a un integrante, en palabras del usuario
const expelError = (err: any): string => {
  const detail = String(err.message || '');
  if (err.status === 409) {
    if (detail.includes('uninsured')) return 'El equipo ya está asegurado: sus integrantes no se pueden cambiar';
    if (detail.includes('cannot be expelled')) return 'El alumno ya no es integrante activo del equipo';
  }
  if (err.status === 403) return 'Solo los docentes del curso lectivo y el super administrador pueden sacar integrantes';
  if (err.status === 404) return 'El integrante ya no está en el equipo';
  return detail || 'No se pudo sacar al integrante';
};

// Error del backend al asegurar el equipo, en palabras del usuario
const insureError = (err: any): string => {
  const detail = String(err.message || '');
  if (err.status === 409) {
    const min = detail.match(/At least (\d+)/);
    if (min) return `Para asegurar el equipo hacen falta al menos ${min[1]} integrantes activos`;
    const max = detail.match(/At most (\d+)/);
    if (max) return `Para asegurar el equipo puede tener como máximo ${max[1]} integrantes activos`;
    if (detail.includes('uninsured')) return 'El equipo ya está asegurado';
  }
  if (err.status === 403)
    return 'Solo el jefe del grupo, los docentes del curso lectivo y el super administrador pueden asegurar el equipo';
  if (err.status === 404) return 'El equipo ya no existe';
  return detail || 'No se pudo asegurar el equipo';
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
  // Pasar la jefatura (SCRUM-22): a quién, si se está guardando y el error del backend
  const [newLeader, setNewLeader] = useState<ProjectMember | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);
  // Sacar a un integrante (SCRUM-21): lo pueden los docentes del curso lectivo y el super administrador
  const [canManage, setCanManage] = useState(false);
  const [toExpel, setToExpel] = useState<ProjectMember | null>(null);
  const [isExpelling, setIsExpelling] = useState(false);
  const [expelErrorText, setExpelErrorText] = useState<string | null>(null);
  // Asegurar el equipo (SCRUM-23): el jefe, los docentes del curso lectivo y el super administrador.
  // `pendingCount` es null mientras se cuentan las solicitudes que se van a rechazar
  const [isInsureOpen, setIsInsureOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [isInsuring, setIsInsuring] = useState(false);
  const [insureErrorText, setInsureErrorText] = useState<string | null>(null);
  // Modificar el equipo (SCRUM-103): sus datos, sumar un alumno o moverlo a otro equipo del curso
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [toMove, setToMove] = useState<ProjectMember | null>(null);

  // `keep`: recarga después de una acción, sin vaciar la pantalla mientras llegan los datos nuevos
  const load = useCallback(async (keep = false) => {
    const current = ++requestId.current;
    const isCurrent = () => current === requestId.current;
    if (!keep) {
      setProject(null);
      setSectionYear(null);
      setRequests(null);
      setCanManage(false);
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
      // Docente de este curso lectivo o super administrador
      if (user?.is_super_admin) setCanManage(true);
      else if (user?.role === 'professor')
        api
          .getProfessorSectionYears({ id_professor: user.id_user, id_section_year: p.id_section_year, limit: 1 })
          .then((r) => isCurrent() && setCanManage(r.total > 0))
          .catch(() => isCurrent() && setCanManage(false));
      else setCanManage(false);
    } catch (err: any) {
      if (!isCurrent()) return;
      setState(err.status === 403 ? 'forbidden' : err.status === 404 ? 'not-found' : 'error');
    }
  }, [id, user?.id_user, user?.role, user?.is_super_admin]);

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

  const handleTransfer = async () => {
    if (!project || !newLeader) return;
    setIsTransferring(true);
    setTransferError(null);
    try {
      await api.transferLeadership(project.id_project, newLeader.id_student_project);
      success(`${newLeader.first_name} ${newLeader.last_name} es el nuevo jefe del grupo`);
      setNewLeader(null);
      load(true);
    } catch (err: any) {
      setTransferError(leaderError(err));
    } finally {
      setIsTransferring(false);
    }
  };

  const handleExpel = async () => {
    if (!project || !toExpel) return;
    setIsExpelling(true);
    setExpelErrorText(null);
    try {
      await api.expelMember(project.id_project, toExpel.id_student_project);
      success(`Se sacó a ${toExpel.first_name} ${toExpel.last_name} del equipo`);
      setToExpel(null);
      load(true);
    } catch (err: any) {
      setExpelErrorText(expelError(err));
    } finally {
      setIsExpelling(false);
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

  // Al abrir la confirmación se cuentan las solicitudes pendientes, que el backend rechaza al asegurar
  const openInsure = () => {
    if (!project) return;
    setInsureErrorText(null);
    setPendingCount(null);
    setIsInsureOpen(true);
    api
      .getProjectMembers(project.id_project, ['pending_approval'])
      .then((r) => setPendingCount(r.total))
      .catch(() => setPendingCount(null));
  };

  const handleInsure = async () => {
    if (!project) return;
    setIsInsuring(true);
    setInsureErrorText(null);
    try {
      await api.insureProject(project.id_project);
      success(`Se aseguró el ${teamLabel(project)}`);
      setIsInsureOpen(false);
      load(true);
    } catch (err: any) {
      setInsureErrorText(insureError(err));
    } finally {
      setIsInsuring(false);
    }
  };

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

  // El jefe le pasa la jefatura a otro integrante activo mientras el equipo no esté aprobado ni cancelado
  const iAmLeader = project.members.some(
    (m) => m.id_student === user?.id_user && m.is_leader && m.status.code === 'active'
  );
  const isFinal = project.status?.code === 'approved' || project.status?.code === 'cancelled';
  const canTransfer = iAmLeader && !isFinal;
  // Los docentes del curso y el super administrador sacan, suman y mueven integrantes mientras el
  // equipo no está asegurado
  const canExpel = canManage && project.status?.code === 'uninsured';
  // Los datos los cambian también sus integrantes (activos o que terminaron), salvo aprobado o cancelado
  const iAmMember = project.members.some(
    (m) => m.id_student === user?.id_user && ['active', 'finished'].includes(m.status.code)
  );
  const canEdit = (canManage || iAmMember) && !isFinal && !project.restricted;
  const memberAction =
    canTransfer || canExpel
      ? (m: ProjectMember) =>
          m.status.code === 'active' && (
            <>
              {canTransfer && !m.is_leader && (
                <button
                  type="button"
                  onClick={() => {
                    setTransferError(null);
                    setNewLeader(m);
                  }}
                  className="text-sm text-primary font-medium hover:underline cursor-pointer"
                >
                  Pasar la jefatura
                </button>
              )}
              {canExpel && (
                <button
                  type="button"
                  onClick={() => setToMove(m)}
                  className="text-sm text-primary font-medium hover:underline cursor-pointer"
                >
                  Mover a otro equipo
                </button>
              )}
              {canExpel && (
                <button
                  type="button"
                  onClick={() => {
                    setExpelErrorText(null);
                    setToExpel(m);
                  }}
                  className="text-sm text-danger font-medium hover:underline cursor-pointer"
                >
                  Sacar del equipo
                </button>
              )}
            </>
          )
      : undefined;
  // Asegurar (SCRUM-23): mientras el equipo está sin asegurar; fuera del cupo el botón explica por qué no
  const canInsure = (iAmLeader || canManage) && project.status?.code === 'uninsured';
  const activeCount = project.members.filter((m) => m.status.code === 'active').length;
  const min = sectionYear?.min_students;
  const max = sectionYear?.max_students;
  const insureBlocked =
    min !== undefined && activeCount < min
      ? `${min - activeCount === 1 ? 'Falta 1 integrante activo' : `Faltan ${min - activeCount} integrantes activos`} para el mínimo de ${min}`
      : max !== undefined && activeCount > max
      ? `Tiene ${activeCount - max} ${activeCount - max === 1 ? 'integrante' : 'integrantes'} de más para el máximo de ${max}`
      : null;
  const insureAction = canInsure && (
    <div className="flex flex-col sm:items-end gap-1">
      <div className="flex flex-wrap gap-2 sm:justify-end">
        {canExpel && (
          <Button size="sm" variant="outline" onClick={() => setIsAddOpen(true)}>
            <UserPlus className="w-4 h-4 mr-1.5" />
            Sumar alumno
          </Button>
        )}
        <Button size="sm" onClick={openInsure} disabled={insureBlocked !== null}>
          <ShieldCheck className="w-4 h-4 mr-1.5" />
          Asegurar equipo
        </Button>
      </div>
      {insureBlocked && <p className="text-xs text-ink-muted">{insureBlocked}</p>}
    </div>
  );
  // Si sale el jefe, el backend le pasa la jefatura al integrante activo más antiguo
  const othersActive = toExpel
    ? project.members.filter((m) => m.status.code === 'active' && m.id_student_project !== toExpel.id_student_project)
    : [];

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
          {canEdit && (
            <Button size="sm" variant="outline" className="sm:ml-auto" onClick={() => setIsEditOpen(true)}>
              <Pencil className="w-4 h-4 mr-1.5" />
              Modificar datos
            </Button>
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
        action={memberAction}
        teamAction={insureAction}
        // El cupo solo cuenta para asegurar: asegurado ya no aplica
        cupo={
          project.status?.code === 'uninsured' &&
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

      <Modal
        isOpen={newLeader !== null}
        onClose={() => !isTransferring && setNewLeader(null)}
        title="Pasar la jefatura"
      >
        {transferError && <Alert className="mb-4">{transferError}</Alert>}
        {newLeader && (
          <p className="text-sm text-ink">
            ¿Pasarle la jefatura del grupo a{' '}
            <span className="font-semibold">
              {newLeader.first_name} {newLeader.last_name}
            </span>
            ? Usted sigue en el equipo como integrante, y desde ese momento las solicitudes para sumarse
            las decide el nuevo jefe.
          </p>
        )}
        <div className="flex justify-end gap-3 pt-3 mt-4 border-t border-line">
          <Button type="button" variant="outline" onClick={() => setNewLeader(null)} disabled={isTransferring}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleTransfer} isLoading={isTransferring}>
            Pasar la jefatura
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={toExpel !== null}
        onClose={() => !isExpelling && setToExpel(null)}
        title="Sacar del equipo"
      >
        {expelErrorText && <Alert className="mb-4">{expelErrorText}</Alert>}
        {toExpel && (
          <div className="space-y-2 text-sm text-ink">
            <p>
              ¿Sacar a{' '}
              <span className="font-semibold">
                {toExpel.first_name} {toExpel.last_name}
              </span>{' '}
              del {teamLabel(project)}? Deja de ser integrante y queda libre para sumarse a otro equipo, pero no
              puede volver a pedir sumarse a este.
            </p>
            {toExpel.is_leader && (
              <p className="text-ink-muted">
                {othersActive.length > 0
                  ? 'Es el jefe del grupo: la jefatura pasa al integrante más antiguo del equipo.'
                  : 'Es el jefe del grupo y el único integrante: el equipo queda sin jefe hasta que se sume otro alumno.'}
              </p>
            )}
          </div>
        )}
        <div className="flex justify-end gap-3 pt-3 mt-4 border-t border-line">
          <Button type="button" variant="outline" onClick={() => setToExpel(null)} disabled={isExpelling}>
            Cancelar
          </Button>
          <Button type="button" variant="destructive" onClick={handleExpel} isLoading={isExpelling}>
            Sacar del equipo
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={isInsureOpen}
        onClose={() => !isInsuring && setIsInsureOpen(false)}
        title="Asegurar el equipo"
      >
        {insureErrorText && <Alert className="mb-4">{insureErrorText}</Alert>}
        <div className="space-y-2 text-sm text-ink">
          <p>
            ¿Asegurar el {teamLabel(project)} con sus {activeCount}{' '}
            {activeCount === 1 ? 'integrante' : 'integrantes'}? El equipo queda conformado: no se suma nadie más y no se
            puede sacar a ningún integrante mientras siga asegurado.
          </p>
          {pendingCount !== null && pendingCount > 0 && (
            <p className="text-ink-muted">
              {pendingCount === 1
                ? 'Se rechaza la solicitud pendiente para sumarse.'
                : `Se rechazan las ${pendingCount} solicitudes pendientes para sumarse.`}
            </p>
          )}
          <p className="text-ink-muted">
            Deja de verse como público: pasa a usar la privacidad que eligió el equipo.
          </p>
        </div>
        <div className="flex justify-end gap-3 pt-3 mt-4 border-t border-line">
          <Button type="button" variant="outline" onClick={() => setIsInsureOpen(false)} disabled={isInsuring}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleInsure} isLoading={isInsuring}>
            Asegurar equipo
          </Button>
        </div>
      </Modal>

      {isEditOpen && (
        <EditProjectModal
          project={project}
          onClose={() => setIsEditOpen(false)}
          onSaved={() => {
            setIsEditOpen(false);
            success(`Se guardaron los datos del ${teamLabel(project)}`);
            load(true);
          }}
        />
      )}

      {isAddOpen && (
        <AddMemberModal
          project={project}
          onClose={() => setIsAddOpen(false)}
          onAdded={(name) => {
            setIsAddOpen(false);
            success(`${name} se sumó al ${teamLabel(project)}`);
            load(true);
          }}
        />
      )}

      {toMove && (
        <MoveMemberModal
          project={project}
          member={toMove}
          onClose={() => setToMove(null)}
          onChanged={() => load(true)}
          onMoved={(message) => {
            setToMove(null);
            success(message);
            load(true);
          }}
        />
      )}

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
