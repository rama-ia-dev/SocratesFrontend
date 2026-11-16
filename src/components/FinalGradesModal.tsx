import React, { useState } from 'react';
import type { SectionYearScore } from '../types/api';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { useToast } from './ui/Toast';
import { saveFinals, type FinalGrades } from '../lib/deliveryDocs';

const isGrade = (v: string) => v === '' || (/^\d{1,2}$/.test(v) && Number(v) >= 1 && Number(v) <= 10);

/**
 * Notas finales de un equipo, como en la planilla de la cátedra: la de todas las entregas (un
 * concepto que pone el docente, no se calcula), la de regularización y la del examen.
 * VISTA PREVIA: se guardan solo en este navegador hasta que el backend tenga dónde guardarlas.
 */
export const FinalGradesModal: React.FC<{
  teamLabel: string;
  id_project: number;
  initial: FinalGrades;
  scores: SectionYearScore[];
  onClose: () => void;
  onSaved: (f: FinalGrades) => void;
}> = ({ teamLabel, id_project, initial, scores, onClose, onSaved }) => {
  const { success } = useToast();
  const [finals, setFinals] = useState(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof FinalGrades, string>>>({});

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!isGrade(finals.regularization)) next.regularization = 'Ingrese una nota del 1 al 10';
    if (!isGrade(finals.exam)) next.exam = 'Ingrese una nota del 1 al 10';
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    saveFinals(id_project, finals);
    onSaved(finals);
    success(`Se guardaron las notas finales del ${teamLabel}`);
    onClose();
  };

  return (
    <Modal isOpen onClose={onClose} title={`Notas finales · ${teamLabel}`}>
      <form onSubmit={save} className="space-y-4" noValidate>
        <p className="text-sm text-ink-muted">Vista previa: estas notas se guardan solo en este navegador.</p>
        <Select
          id="final-deliveries"
          label="Nota de las entregas"
          value={finals.deliveries}
          onChange={(e) => setFinals((f) => ({ ...f, deliveries: e.target.value }))}
          options={[{ value: '', label: 'Sin nota' }, ...scores.map((s) => ({ value: s.name, label: s.name }))]}
          helperText="La pone el docente mirando todas las entregas; no se calcula."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            id="final-regularization"
            label="Regularización"
            inputMode="numeric"
            maxLength={2}
            placeholder="1 a 10"
            value={finals.regularization}
            error={errors.regularization}
            onChange={(e) => setFinals((f) => ({ ...f, regularization: e.target.value.trim() }))}
          />
          <Input
            id="final-exam"
            label="Examen"
            inputMode="numeric"
            maxLength={2}
            placeholder="1 a 10"
            value={finals.exam}
            error={errors.exam}
            onChange={(e) => setFinals((f) => ({ ...f, exam: e.target.value.trim() }))}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit">Guardar</Button>
        </div>
      </form>
    </Modal>
  );
};
