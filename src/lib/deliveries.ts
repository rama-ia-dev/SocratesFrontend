import type { DeliveryPublic, GradeCategory } from '../types/api';
import type { BadgeProps } from '../components/ui/Badge';

// Entregas (SCRUM-59 a 62 y 590). Los nombres de los estados y de los conceptos son los del backend.

export const CATEGORY_LABEL: Record<GradeCategory, string> = {
  activity: 'Nota de la entrega',
  follow_up: 'Seguimiento del avance',
};

// Qué mide cada nota (la de seguimiento no es el documento "Planificación y seguimiento")
export const CATEGORY_HELP: Record<GradeCategory, string> = {
  activity: 'La nota de la entrega completa.',
  follow_up: 'Cómo viene avanzando el proyecto en esta entrega.',
};

export const statusVariant = (code: string): BadgeProps['variant'] => {
  if (code === 'approved') return 'public';
  if (code === 'pending_approval') return 'protected';
  if (code === 'pending_modification') return 'private';
  return 'neutral';
};

// Qué significa cada estado para el docente: en qué etapa está la entrega, qué puede hacer ahora y qué sigue
export const statusHelp = (code: string): string => {
  if (code === 'requested')
    return 'El equipo todavía no presentó esta entrega. Cuando la presente, toque "Registrar como entregada" para poder escribir notas y devoluciones.';
  if (code === 'pending_approval')
    return 'El equipo presentó la entrega y está esperando su revisión. Ahora puede escribir notas, devoluciones y marcar como corregidas aquellas que el equipo ya resolvió. Mientras haya devoluciones sin corregir, puede pedirle modificaciones al equipo. Solo se puede aprobar cuando todas las devoluciones estén corregidas.';
  if (code === 'pending_modification')
    return 'Se le pidieron modificaciones al equipo y actualmente se encuentra trabajando en las devoluciones. Cuando el equipo avise que terminó de corregir, toque "Registrar como entregada": la entrega vuelve a quedar pendiente de aprobación y podrá marcar como corregidas aquellas devoluciones que considere.';
  if (code === 'approved')
    return 'La entrega está aprobada. Es definitivo: ya no se pueden cambiar las notas ni escribir devoluciones nuevas.';
  return '';
};

export const latestGrade = (d: DeliveryPublic, category: GradeCategory) =>
  d.latest_grades.find((g) => g.category === category) ?? null;

// "2026-05-16" y "23:59:00" → "16/05/2026 23:59"
export const formatDue = (date: string, time?: string | null) => {
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y}${time ? ` ${time.slice(0, 5)}` : ''}`;
};

// Fecha sola, "27/04/2026"
export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export const isValidLink = (value: string) => {
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && Boolean(url.host);
  } catch {
    return false;
  }
};

/** Mensaje para un error del backend al operar una entrega. `stale` indica que conviene recargarla. */
export const deliveryError = (err: any): { text: string; stale: boolean } => {
  const detail = String(err?.message ?? '');
  if (err?.status === 409 && detail.includes('requires a link')) {
    return { text: 'Esta entrega pide un enlace: cárguelo antes de registrarla como entregada.', stale: false };
  }
  if (err?.status === 409 && detail.includes('cannot receive new grades')) {
    return { text: 'La entrega ya está aprobada: no admite notas nuevas.', stale: true };
  }
  if (err?.status === 409 && detail.includes('already corrected')) {
    return { text: 'La devolución ya estaba marcada como corregida.', stale: true };
  }
  if (err?.status === 409) {
    return { text: 'La entrega cambió de estado mientras estaba abierta. Se muestran los datos actualizados.', stale: true };
  }
  if (err?.status === 403) {
    return { text: 'Solo los docentes del curso lectivo y el administrador pueden modificar esta entrega.', stale: false };
  }
  if (err?.status === 404) return { text: 'La entrega ya no existe.', stale: false };
  if (err?.status === 422) return { text: 'Revise los datos: el enlace debe empezar con http:// o https://.', stale: false };
  return { text: detail || 'No se pudo guardar el cambio. Intente nuevamente.', stale: false };
};
