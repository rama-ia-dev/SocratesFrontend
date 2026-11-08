import React, { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { Modal } from './ui/Modal';
import { Alert } from './ui/Alert';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { useToast } from './ui/Toast';

/** Clase de hoy en la que el alumno registra su asistencia. */
export interface CheckInClass {
  id: number; // id_calendar_class
  title: string;
  section_name: string;
  start: string | null; // HH:MM
  end: string | null;
}

const errorMessage = (err: any): string => {
  if (err?.status === 409)
    return 'La asistencia con código no está habilitada o el código ya venció. Pídale al docente que genere uno nuevo.';
  if (err?.status === 422) return 'El código no es correcto. Revíselo e intente de nuevo.';
  if (err?.status === 403) return 'Solo los alumnos que cursan este curso lectivo pueden registrar su asistencia.';
  if (err?.status === 404) return 'La clase ya no existe. Recargue la página.';
  return 'No se pudo registrar la asistencia. Intente de nuevo.';
};

export interface CheckInModalProps {
  classInfo: CheckInClass | null;
  onClose: () => void;
  /** Se registró la asistencia (o ya estaba registrada). */
  onDone: (id_calendar_class: number) => void;
}

/** El alumno ingresa el código de 6 dígitos que da el docente para registrar su asistencia. */
export const CheckInModal: React.FC<CheckInModalProps> = ({ classInfo, onClose, onDone }) => {
  const { success } = useToast();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!classInfo) return;
    setCode('');
    setError(null);
    setSaving(false);
    // El foco va al código apenas se abre, para escribirlo directo
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [classInfo]);

  if (!classInfo) return null;

  const complete = /^\d{6}$/.test(code);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complete || saving) return;
    setError(null);
    setSaving(true);
    try {
      await api.checkInAttendance(classInfo.id, code);
      success('Se registró su asistencia a la clase');
      onDone(classInfo.id);
      onClose();
    } catch (err: any) {
      setError(errorMessage(err));
      setSaving(false);
    }
  };

  const timeText = classInfo.start ? ` · ${classInfo.start}${classInfo.end ? ` a ${classInfo.end}` : ''}` : '';

  return (
    <Modal isOpen onClose={onClose} title="Registrar mi asistencia" maxWidth="sm">
      <form onSubmit={submit} noValidate>
        <p className="text-sm text-ink">
          <span className="font-medium [overflow-wrap:anywhere]">{classInfo.title}</span> · {classInfo.section_name}
          {timeText}
        </p>
        <p className="mt-1 text-sm text-ink-muted">Ingrese el código de 6 dígitos que le dio el docente.</p>

        <div className="mt-4">
          <Input
            ref={inputRef}
            label="Código"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
              setError(null);
            }}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            className="font-mono text-lg tracking-[0.3em] tabular-nums"
          />
        </div>

        {error && <Alert className="mt-4">{error}</Alert>}

        <div className="mt-5 flex justify-end gap-3 pt-3 border-t border-line">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!complete} isLoading={saving}>
            Registrar asistencia
          </Button>
        </div>
      </form>
    </Modal>
  );
};
