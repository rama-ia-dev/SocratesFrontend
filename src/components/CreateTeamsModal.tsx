import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import type { ProjectPublic } from '../types/api';
import { Modal } from './ui/Modal';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Button } from './ui/Button';
import { Alert } from './ui/Alert';
import { digitsOnly } from '../lib/validation';

interface CourseOption {
  id_section_year: number;
  label: string;
}

const MAX_QUANTITY = 50; // límite del backend por pedido
const MAX_GROUP_NUMBER = 9999;

// Crear equipos de trabajo (SCRUM-102). El backend crea equipos vacíos y sin asegurar en un curso
// lectivo: uno con número elegido (o el primero libre) o varios en los primeros libres. Puede hacerlo un
// docente del curso lectivo o un administrador.
export const CreateTeamsModal: React.FC<{
  onClose: () => void;
  onCreated: (created: ProjectPublic[]) => void;
}> = ({ onClose, onCreated }) => {
  const { user } = useAuth();
  const [courses, setCourses] = useState<CourseOption[] | null>(null);
  const [coursesError, setCoursesError] = useState(false);

  const [course, setCourse] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [groupNumber, setGroupNumber] = useState('');
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // El administrador puede crear en cualquier curso lectivo; el docente, solo en los suyos.
  useEffect(() => {
    if (!user) return;
    const load = user.is_super_admin
      ? api.getSectionYears({ limit: 100 }).then((r) =>
          r.items.map((sy) => ({ id_section_year: sy.id_section_year, label: `${sy.section_name} (${sy.year})` }))
        )
      : api.getProfessorSectionYears({ id_professor: user.id_user, limit: 100 }).then((r) =>
          r.items.map((a) => ({ id_section_year: a.id_section_year, label: `${a.section_name} (${a.year})` }))
        );
    load
      .then((options) => {
        setCourses(options);
        if (options.length === 1) setCourse(String(options[0].id_section_year));
      })
      .catch(() => setCoursesError(true));
  }, [user]);

  const qty = Number(quantity);
  const courseError = !course ? 'Elija el curso lectivo' : null;
  const quantityError =
    !quantity || qty < 1 || qty > MAX_QUANTITY ? `Ingrese un número entre 1 y ${MAX_QUANTITY}` : null;
  const groupNumberError =
    qty === 1 && groupNumber && (Number(groupNumber) < 1 || Number(groupNumber) > MAX_GROUP_NUMBER)
      ? `El número de equipo va de 1 a ${MAX_GROUP_NUMBER}`
      : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setError(null);
    if (courseError || quantityError || groupNumberError) return;

    setIsSaving(true);
    try {
      const id_section_year = Number(course);
      const created =
        qty === 1
          ? [
              await api.createProject({
                id_section_year,
                ...(groupNumber && { group_number: Number(groupNumber) }),
              }),
            ]
          : await api.createProjectsBulk({ id_section_year, quantity: qty });
      onCreated(created);
    } catch (err: any) {
      setError(
        err.status === 409
          ? qty === 1 && groupNumber
            ? `Ya existe el Equipo ${groupNumber} en ese curso lectivo. Elija otro número o déjelo vacío`
            : 'Otro docente creó equipos en ese curso lectivo al mismo tiempo. Vuelva a intentarlo'
          : err.status === 403
            ? 'No es docente de ese curso lectivo'
            : err.status === 404
              ? 'El curso lectivo ya no existe'
              : err.message || 'No se pudieron crear los equipos'
      );
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={() => !isSaving && onClose()} title="Crear equipos de trabajo">
      {error && <Alert className="mb-4">{error}</Alert>}

      {coursesError ? (
        <Alert>No se pudieron cargar sus cursos lectivos. Cierre y vuelva a intentarlo.</Alert>
      ) : courses && courses.length === 0 ? (
        <Alert tone="info">
          No tiene cursos lectivos asignados. Un administrador tiene que asignarlo a una comisión
          para que pueda crear equipos.
        </Alert>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <Select
            label="Curso lectivo"
            value={course}
            onChange={(e) => setCourse(e.target.value)}
            disabled={isSaving || !courses}
            error={touched ? courseError ?? undefined : undefined}
            options={[
              { value: '', label: courses ? 'Elija un curso lectivo' : 'Cargando…' },
              ...(courses ?? []).map((c) => ({ value: c.id_section_year, label: c.label })),
            ]}
          />

          <Input
            label="Cantidad de equipos"
            inputMode="numeric"
            maxLength={2}
            value={quantity}
            onChange={(e) => setQuantity(digitsOnly(e.target.value))}
            disabled={isSaving}
            error={touched ? quantityError ?? undefined : undefined}
            helperText={`De 1 a ${MAX_QUANTITY}. Toman los primeros números libres del curso lectivo`}
          />

          {qty === 1 && (
            <Input
              label="Número de equipo"
              optional
              inputMode="numeric"
              maxLength={4}
              placeholder="Automático (el primero libre)"
              value={groupNumber}
              onChange={(e) => setGroupNumber(digitsOnly(e.target.value))}
              disabled={isSaving}
              error={touched ? groupNumberError ?? undefined : undefined}
              helperText="Sirve, por ejemplo, para volver a crear un número que se eliminó"
            />
          )}

          <Alert tone="info">
            Los equipos se crean vacíos, sin asegurar y públicos. Los alumnos se suman después y
            completan el nombre y los datos del proyecto.
          </Alert>

          <div className="flex justify-end gap-3 pt-4 border-t border-line">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" isLoading={isSaving} disabled={!courses}>
              {qty > 1 ? `Crear ${qty} equipos` : 'Crear equipo'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};
