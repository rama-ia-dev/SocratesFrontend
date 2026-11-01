import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Modal } from './ui/Modal';
import { Alert } from './ui/Alert';
import { Button } from './ui/Button';
import { useToast } from './ui/Toast';

/** Evento que se elimina. */
export interface DeletableEvent {
  kind: 'class' | 'delivery';
  id: number; // id_calendar_class o id_activity
  id_section_year: number;
  date: string;
  title: string; // para mostrar
  section_name: string;
}

const WEEKDAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const dateText = (iso: string) => {
  const date = new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
  return `${WEEKDAY_NAMES[date.getDay()]} ${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
};

const errorMessage = (err: any, kind: DeletableEvent['kind']): string => {
  if (err?.status === 409 && kind === 'delivery')
    return 'Los equipos ya cargaron datos en esta entrega: no se puede eliminar.';
  if (err?.status === 403) return 'Solo un docente del curso lectivo o el administrador puede eliminar eventos en él.';
  if (err?.status === 404) return 'El evento ya no existe. Recargue la página.';
  return 'No se pudo eliminar el evento. Intente de nuevo.';
};

export interface DeleteEventModalProps {
  event: DeletableEvent | null;
  /** Clases posteriores de la misma serie semanal (mismo día, horario y título). */
  followingIds?: number[];
  onClose: () => void;
  onDeleted: () => void;
}

export const DeleteEventModal: React.FC<DeleteEventModalProps> = ({ event, followingIds = [], onClose, onDeleted }) => {
  const { success } = useToast();
  const [scope, setScope] = useState<'one' | 'following'>('one');
  // Alumnos presentes en la clase: su asistencia se borra con ella
  const [present, setPresent] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!event) return;
    let alive = true;
    setScope('one');
    setError(null);
    setPresent(null);
    if (event.kind === 'class') {
      api
        .getClassAttendance(event.id)
        .then((res) => alive && setPresent(res.items.filter((s) => s.present).length))
        .catch(() => alive && setPresent(0));
    }
    return () => {
      alive = false;
    };
  }, [event]);

  if (!event) return null;
  const isClass = event.kind === 'class';
  const withFollowing = isClass && scope === 'following' && followingIds.length > 0;

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      if (!isClass) {
        await api.deleteActivity(event.id);
        success('Entrega eliminada');
      } else if (withFollowing) {
        const ids = [event.id, ...followingIds];
        await api.deleteCalendarClasses(event.id_section_year, ids);
        success(`Se eliminaron ${ids.length} clases`);
      } else {
        await api.deleteCalendarClass(event.id);
        success('Clase eliminada');
      }
      onDeleted();
      onClose();
    } catch (err) {
      setError(errorMessage(err, event.kind));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal isOpen onClose={() => !deleting && onClose()} title={isClass ? 'Eliminar clase' : 'Eliminar entrega'}>
      {error && <Alert className="mb-4">{error}</Alert>}

      <p className="text-sm text-ink">
        <span className="font-medium">{event.title}</span> · {event.section_name} · {dateText(event.date)}
      </p>

      {isClass && followingIds.length > 0 && (
        <fieldset className="mt-4 rounded-lg border border-line p-3">
          <legend className="px-1 text-sm font-medium text-ink">¿Qué clases se eliminan?</legend>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
              <input
                type="radio"
                name="eliminar-alcance"
                className="w-4 h-4 accent-primary"
                checked={scope === 'one'}
                onChange={() => setScope('one')}
                disabled={deleting}
              />
              Solo esta clase
            </label>
            <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
              <input
                type="radio"
                name="eliminar-alcance"
                className="w-4 h-4 accent-primary"
                checked={scope === 'following'}
                onChange={() => setScope('following')}
                disabled={deleting}
              />
              Esta y las {followingIds.length} siguientes del mismo día y horario
            </label>
          </div>
        </fieldset>
      )}

      <p className="mt-4 text-sm text-ink-muted">
        {isClass
          ? present
            ? `Esta clase tiene la asistencia de ${present} ${present === 1 ? 'alumno' : 'alumnos'}: se borra junto con la clase. `
            : ''
          : ''}
        {isClass && withFollowing && 'Si alguna de las siguientes tiene asistencia tomada, también se borra. '}
        No se puede deshacer.
      </p>

      <div className="mt-4 flex justify-end gap-3 pt-3 border-t border-line">
        <Button variant="outline" onClick={onClose} disabled={deleting}>
          Cancelar
        </Button>
        <Button variant="destructive" onClick={handleDelete} isLoading={deleting} disabled={isClass && present === null}>
          {withFollowing ? `Eliminar ${followingIds.length + 1} clases` : 'Eliminar'}
        </Button>
      </div>
    </Modal>
  );
};
