import React, { useState } from 'react';
import type { SectionYearScore } from '../types/api';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Select } from './ui/Select';
import { fieldClasses } from './ui/Input';
import { useToast } from './ui/Toast';
import { EMPTY_STUDENT, saveFinals, type FinalGrades, type StudentFinals } from '../lib/deliveryDocs';

const isGrade = (v: string) => v === '' || (/^\d{1,2}$/.test(v) && Number(v) >= 1 && Number(v) <= 10);

export interface FinalsMember {
  id_student: number;
  name: string;
  legajo: number;
}

/**
 * Notas finales de un equipo, como en la planilla de la cátedra: la de todas las entregas es del
 * equipo (un concepto que pone el docente, no se calcula); la de regularización y la del examen,
 * de cada integrante.
 * VISTA PREVIA: se guardan solo en este navegador hasta que el backend tenga dónde guardarlas.
 */
export const FinalGradesModal: React.FC<{
  teamLabel: string;
  id_project: number;
  members: FinalsMember[];
  initial: FinalGrades;
  scores: SectionYearScore[];
  onClose: () => void;
  onSaved: (f: FinalGrades) => void;
}> = ({ teamLabel, id_project, members, initial, scores, onClose, onSaved }) => {
  const { success } = useToast();
  const [deliveries, setDeliveries] = useState(initial.deliveries);
  const [students, setStudents] = useState<Record<number, StudentFinals>>(initial.students);
  const [invalid, setInvalid] = useState(false);

  const of = (id: number) => students[id] ?? EMPTY_STUDENT;
  const set = (id: number, field: keyof StudentFinals, value: string) =>
    setStudents((s) => ({ ...s, [id]: { ...of(id), [field]: value.trim() } }));

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const bad = members.some((m) => !isGrade(of(m.id_student).regularization) || !isGrade(of(m.id_student).exam));
    setInvalid(bad);
    if (bad) return;
    const finals = { deliveries, students };
    saveFinals(id_project, finals);
    onSaved(finals);
    success(`Se guardaron las notas finales del ${teamLabel}`);
    onClose();
  };

  const cellInput = (m: FinalsMember, field: keyof StudentFinals, label: string) => {
    const value = of(m.id_student)[field];
    return (
      <div className="w-16 mx-auto">
        <input
          aria-label={`${label} de ${m.name}`}
          aria-invalid={!isGrade(value)}
          inputMode="numeric"
          maxLength={2}
          placeholder="—"
          value={value}
          onChange={(e) => set(m.id_student, field, e.target.value)}
          className={`${fieldClasses(isGrade(value) ? undefined : 'error')} text-center tabular-nums`}
        />
      </div>
    );
  };

  return (
    <Modal isOpen onClose={onClose} title={`Notas finales · ${teamLabel}`} maxWidth="lg">
      <form onSubmit={save} className="space-y-5" noValidate>
        <p className="text-sm text-ink-muted">Vista previa: estas notas se guardan solo en este navegador.</p>
        <div className="sm:max-w-xs">
          <Select
            id="final-deliveries"
            label="Nota de las entregas del equipo"
            value={deliveries}
            onChange={(e) => setDeliveries(e.target.value)}
            options={[{ value: '', label: 'Sin nota' }, ...scores.map((s) => ({ value: s.name, label: s.name }))]}
            helperText="La pone el docente mirando todas las entregas; no se calcula."
          />
        </div>

        <div>
          <h4 className="text-sm font-semibold text-ink">Notas de cada integrante</h4>
          <p className="text-xs text-ink-muted mt-0.5">Del 1 al 10. Una vacía queda sin nota.</p>
          {members.length === 0 ? (
            <p className="mt-2 text-sm italic text-ink-subtle">El equipo no tiene integrantes.</p>
          ) : (
            <table className="mt-2 w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-muted">
                  <th className="py-1.5 font-medium">Integrante</th>
                  <th className="py-1.5 font-medium text-center w-24">Regularización</th>
                  <th className="py-1.5 font-medium text-center w-20">Examen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {members.map((m) => (
                  <tr key={m.id_student}>
                    <td className="py-1.5 pr-2">
                      <span className="block [overflow-wrap:anywhere]">{m.name}</span>
                      <span className="block text-xs text-ink-muted tabular-nums">{m.legajo}</span>
                    </td>
                    <td className="py-1.5 text-center">{cellInput(m, 'regularization', 'Regularización')}</td>
                    <td className="py-1.5 text-center">{cellInput(m, 'exam', 'Examen')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {invalid && <p className="mt-2 text-xs font-medium text-danger">Revise las notas marcadas: van del 1 al 10.</p>}
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit">Guardar</Button>
        </div>
      </form>
    </Modal>
  );
};
