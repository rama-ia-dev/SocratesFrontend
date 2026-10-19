import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { UserListItem } from '../types/api';
import { useAuth } from '../context/AuthContext';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableCell,
  InitialsAvatar,
} from '../components/ui/Table';
import { Pagination } from '../components/ui/Pagination';
import { EmptyState, TableSkeleton } from '../components/ui/EmptyState';
import { useToast } from '../components/ui/Toast';
import {
  Search,
  MoreVertical,
  Plus,
  Edit2,
  AlertCircle,
  ShieldAlert,
} from 'lucide-react';

export const Students: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { success, error: toastError } = useToast();

  const [students, setStudents] = useState<UserListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [permissionError, setPermissionError] = useState<boolean>(false);

  // Diálogo Modificar Estudiante
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<UserListItem | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [legajo, setLegajo] = useState<number | ''>('');
  const [originalLegajo, setOriginalLegajo] = useState<number | ''>('');
  const [birthDate, setBirthDate] = useState('2002-01-01');
  const [enrollmentYear, setEnrollmentYear] = useState<number>(2022);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Menú contextual
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  const fetchStudents = useCallback(async () => {
    setIsLoading(true);
    setPermissionError(false);

    try {
      const res = await api.getUsers({
        role: 'student',
        q: searchQuery || null,
        limit: 10,
        offset,
      });
      setStudents(res.items);
      setTotal(res.total);
    } catch (err: any) {
      if (err.status === 403) {
        setPermissionError(true);
      } else {
        toastError('Error al cargar la lista de estudiantes');
      }
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, offset, toastError]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const handleOpenEdit = (st: UserListItem) => {
    setEditingStudent(st);
    setFirstName(st.first_name);
    setLastName(st.last_name);
    setLegajo(st.legajo);
    setOriginalLegajo(st.legajo);
    setEnrollmentYear(st.enrollment_year || 2022);
    setBirthDate('2002-05-15');
    setModalError(null);
    setOpenMenuId(null);
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    setModalError(null);

    if (!legajo || legajo <= 0) {
      setModalError('El legajo debe ser un número positivo');
      return;
    }
    if (!firstName.trim() || !lastName.trim()) {
      setModalError('Ingrese nombre y apellido');
      return;
    }

    setIsSaving(true);
    try {
      await api.updateStudent(editingStudent.id_user, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        legajo: Number(legajo),
        enrollment_year: enrollmentYear,
        birth_date: birthDate,
      });
      success('Datos del estudiante actualizados');
      setIsEditModalOpen(false);
      fetchStudents();
    } catch (err: any) {
      if (err.status === 409 || err.message?.includes('existe')) {
        setModalError('Ya existe un alumno con ese legajo');
      } else {
        setModalError(err.message || 'Error al actualizar estudiante');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const legajoChanged = legajo !== originalLegajo && legajo !== '';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Estudiantes"
        subtitle={
          user?.is_super_admin
            ? 'Padrón institucional de alumnos matriculados'
            : 'Estudiantes matriculados en tus cursos lectivos a cargo'
        }
        action={
          <Button
            variant="primary"
            onClick={() => navigate('/estudiantes/nuevo')}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Registrar estudiantes
          </Button>
        }
      />

      {/* Si el profesor no tiene permisos según el backend actual (403) */}
      {permissionError ? (
        <div className="rounded-xl border border-[#D6E4F7] bg-white p-12 text-center fluted-column-pattern">
          <div className="max-w-md mx-auto flex flex-col items-center">
            <div className="p-3 bg-[#FEE2E2] text-[#B91C1C] rounded-full mb-3 border border-[#FCA5A5]">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <p className="text-base font-semibold text-[#0F1F3D]">
              No tiene permisos para ver el listado
            </p>
            <p className="text-xs text-[#51607A] mt-1 mb-4">
              La consulta del padrón de usuarios está reservada exclusivamente a super administradores según el protocolo de seguridad institucional.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/estudiantes/nuevo')}
            >
              Ir a registrar estudiantes
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* Buscador */}
          <div className="max-w-md">
            <Input
              type="text"
              placeholder="Buscar por nombre o legajo"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setOffset(0);
              }}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>

          {isLoading ? (
            <TableSkeleton rows={4} cols={5} />
          ) : students.length === 0 ? (
            <EmptyState message="No se encontraron estudiantes registrados." />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <tr>
                    <TableHead>Legajo</TableHead>
                    <TableHead>Apellido y nombre</TableHead>
                    <TableHead>Correo de ingreso</TableHead>
                    <TableHead>Año de ingreso</TableHead>
                    <TableHead className="w-20 text-right">Acciones</TableHead>
                  </tr>
                </TableHeader>
                <tbody>
                  {students.map((st) => (
                    <TableRow key={st.id_user}>
                      <TableCell className="font-mono font-medium text-[#0F1F3D]">
                        {st.legajo}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <InitialsAvatar
                            name={`${st.last_name} ${st.first_name}`}
                            size="sm"
                          />
                          <span className="font-medium text-[#0F1F3D]">
                            {st.last_name}, {st.first_name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-[#51607A] text-xs">
                        {`${st.legajo}@sistemas.frc.utn.edu.ar`}
                      </TableCell>
                      <TableCell className="text-[#51607A]">
                        {st.enrollment_year || '—'}
                      </TableCell>
                      <TableCell className="text-right relative">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenMenuId(
                              openMenuId === st.id_user ? null : st.id_user
                            )
                          }
                          className="p-1 rounded text-[#51607A] hover:text-[#0F1F3D] hover:bg-[#EFF6FF] cursor-pointer"
                          aria-label="Abrir menú de opciones"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {openMenuId === st.id_user && (
                          <div className="absolute right-4 top-10 w-36 bg-white border border-[#D6E4F7] rounded-lg shadow-lg py-1 z-20 text-left">
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(st)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#0F1F3D] hover:bg-[#EFF6FF] cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-[#1D4ED8]" />
                              <span>Modificar</span>
                            </button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </tbody>
              </Table>

              <Pagination
                total={total}
                limit={10}
                offset={offset}
                onChangeOffset={setOffset}
              />
            </>
          )}
        </>
      )}

      {/* Diálogo Modificar Estudiante */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Modificar estudiante"
      >
        {modalError && (
          <div
            role="alert"
            className="mb-4 p-3 rounded-lg bg-[#FEE2E2] border border-[#FCA5A5] text-[#B91C1C] text-sm flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{modalError}</span>
          </div>
        )}

        {legajoChanged && (
          <div className="mb-4 p-3 rounded-lg bg-[#EFF6FF] border border-[#BAE6FD] text-[#1D4ED8] text-xs">
            El correo de ingreso pasará a ser{' '}
            <span className="font-mono font-semibold">
              {legajo}@sistemas.frc.utn.edu.ar
            </span>
          </div>
        )}

        <form onSubmit={handleSaveEdit} className="space-y-4">
          <div>
            <Input
              label="Legajo"
              type="number"
              min={1}
              value={legajo}
              onChange={(e) => setLegajo(Number(e.target.value))}
              disabled={isSaving}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Nombre"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              disabled={isSaving}
              required
            />
            <Input
              label="Apellido"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              disabled={isSaving}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Fecha de nacimiento"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              disabled={isSaving}
              required
            />
            <Input
              label="Año de ingreso"
              type="number"
              min={1950}
              max={2100}
              value={enrollmentYear}
              onChange={(e) => setEnrollmentYear(Number(e.target.value))}
              disabled={isSaving}
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#D6E4F7]">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditModalOpen(false)}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isSaving}
            >
              Guardar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
