import type { DeliveryPublic, GradeCategory } from '../types/api';
import type { BadgeProps } from '../components/ui/Badge';

// Entregas (SCRUM-59 a 62 y 590). Los nombres de los estados y de los conceptos son los del backend.

export const CATEGORY_LABEL: Record<GradeCategory, string> = {
  activity: 'Actividad',
  follow_up: 'Seguimiento',
};

export const statusVariant = (code: string): BadgeProps['variant'] => {
  if (code === 'approved') return 'public';
  if (code === 'pending_approval') return 'protected';
  if (code === 'pending_modification') return 'private';
  return 'neutral';
};

// Qué significa cada estado, en una línea, para quien maneja la entrega
export const statusHelp = (code: string): string => {
  if (code === 'requested') return 'El equipo todavía no entregó.';
  if (code === 'pending_approval') return 'El equipo entregó y la entrega espera su revisión.';
  if (code === 'pending_modification') return 'Se pidieron modificaciones: el equipo tiene que volver a entregar.';
  if (code === 'approved') return 'La entrega está aprobada. Es definitivo: no cambia de estado ni admite notas nuevas.';
  return '';
};

export const latestGrade = (d: DeliveryPublic, category: GradeCategory) =>
  d.latest_grades.find((g) => g.category === category) ?? null;

// "2026-05-16" y "23:59:00" → "16/05/2026 23:59"
export const formatDue = (date: string, time?: string | null) => {
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y}${time ? ` ${time.slice(0, 5)}` : ''}`;
};

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
