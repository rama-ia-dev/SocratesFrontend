import React, { useState } from 'react';
import { api } from '../lib/api';
import type { SectionYearPublic } from '../types/api';
import { Modal } from './ui/Modal';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Alert } from './ui/Alert';
import { digitsOnly } from '../lib/validation';

const MIN = 1;
const MAX = 100; // rango que acepta el backend

// Cupo de integrantes por equipo de un curso lectivo (SCRUM-19): PATCH /section-years/{id}.
// Vale para todos los equipos del curso lectivo. Hoy el backend se lo permite solo al administrador.
export const TeamSizeModal: React.FC<{
  sectionYear: SectionYearPublic;
  onClose: () => void;
  onSaved: (updated: SectionYearPublic) => void;
}> = ({ sectionYear, onClose, onSaved }) => {
  const [min, setMin] = useState(String(sectionYear.min_students ?? ''));
  const [max, setMax] = useState(String(sectionYear.max_students ?? ''));
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const inRange = (v: string) => /^\d+$/.test(v) && Number(v) >= MIN && Number(v) <= MAX;
  const minError = !inRange(min) ? `Ingrese un número de ${MIN} a ${MAX}` : null;
  const maxError = !inRange(max)
    ? `Ingrese un número de ${MIN} a ${MAX}`
    : !minError && Number(max) < Number(min)
      ? 'No puede ser menor que el mínimo'
      : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setError(null);
    if (minError || maxError) return;

    // Solo lo que cambió (el backend rechaza el cuerpo vacío)
    const changes = {
      ...(Number(min) !== sectionYear.min_students && { min_students: Number(min) }),
      ...(Number(max) !== sectionYear.max_students && { max_students: Number(max) }),
    };
    if (Object.keys(changes).length === 0) {
      onClose();
      return;
    }

    setIsSaving(true);
    try {
      onSaved(await api.updateSectionYear(sectionYear.id_section_year, changes));
    } catch (err: any) {
      setError(
        err.status === 403
          ? 'Solo un administrador puede cambiar el cupo'
          : err.status === 404
            ? 'El curso lectivo ya no existe'
            : err.message || 'No se pudo guardar el cupo'
      );
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={() => !isSaving && onClose()} title="Cupo de integrantes por equipo">
      {error && <Alert className="mb-4">{error}</Alert>}
      <p className="mb-4 text-sm text-ink-muted">
        Vale para todos los equipos de {sectionYear.section_name} ({sectionYear.year}).
      </p>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Mínimo de integrantes"
            inputMode="numeric"
            maxLength={3}
            value={min}
            onChange={(e) => setMin(digitsOnly(e.target.value))}
            disabled={isSaving}
            error={touched ? minError ?? undefined : undefined}
            helperText="Desde cuántos alumnos el equipo está completo"
          />
          <Input
            label="Máximo de integrantes"
            inputMode="numeric"
            maxLength={3}
            value={max}
            onChange={(e) => setMax(digitsOnly(e.target.value))}
            disabled={isSaving}
            error={touched ? maxError ?? undefined : undefined}
            helperText="Cuántos alumnos admite como máximo"
          />
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t border-line">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" isLoading={isSaving}>
            Guardar
          </Button>
        </div>
      </form>
    </Modal>
  );
};
