import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { ProjectPublic, ProjectPrivacy } from '../types/api';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableCell,
  InitialsAvatar,
} from '../components/ui/Table';
import { useToast } from '../components/ui/Toast';
import {
  Lock,
  ArrowLeft,
  Trash2,
  AlertTriangle,
  AlertCircle,
  FileText,
  Users,
} from 'lucide-react';

export const ProjectDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { success, error: toastError } = useToast();

  const [project, setProject] = useState<ProjectPublic | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Diálogo Eliminar Equipo
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchProject = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const data = await api.getProject(Number(id));
      setProject(data);
    } catch (err: any) {
      if (err.status === 404) {
        toastError('No se encontró el recurso');
        navigate('/equipos');
      } else {
        toastError(err.message || 'Error al cargar el equipo');
      }
    } finally {
      setIsLoading(false);
    }
  }, [id, navigate, toastError]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="h-8 bg-[#EFF6FF] rounded-md animate-pulse w-1/4" />
        <div className="h-20 bg-white border border-[#D6E4F7] rounded-xl animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-40 bg-white border border-[#D6E4F7] rounded-xl animate-pulse" />
          <div className="h-40 bg-white border border-[#D6E4F7] rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (!project) return null;

  // Permiso para eliminar: super admin o profesor asignado
  const canDelete = Boolean(user?.is_super_admin || user?.role === 'professor');

  const handleDelete = async () => {
    setDeleteError(null);
    setIsDeleting(true);
    try {
      await api.deleteProject(project.id_project);
      success(`Equipo ${project.group_number} eliminado`);
      setIsDeleteModalOpen(false);
      navigate('/equipos');
    } catch (err: any) {
      if (err.status === 409 || err.message?.includes('estudiantes')) {
        setDeleteError('No se puede eliminar un equipo con estudiantes');
      } else {
        setDeleteError(err.message || 'Error al eliminar el equipo');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const renderPrivacyBadge = (privacy: ProjectPrivacy) => {
    const labels = {
      public: 'Público',
      protected: 'Protegido',
      private: 'Privado',
    };
    return <Badge variant={privacy}>{labels[privacy]}</Badge>;
  };

  const hasAccessToDetails = !project.restricted;
  const canViewMembers =
    project.privacy === 'public' ||
    user?.is_super_admin ||
    user?.role === 'professor' ||
    (project.members || []).some((m) => m.id_student === user?.id_user);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Botón Volver */}
      <div>
        <Link
          to="/equipos"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#51607A] hover:text-[#0F1F3D] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a equipos de trabajo
        </Link>
      </div>

      {/* Encabezado: Equipo X, comisión, año e insignia de privacidad */}
      <div className="bg-white border border-[#D6E4F7] rounded-xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-serif font-semibold text-2xl sm:text-3xl text-[#0B2A66]">
              Equipo {project.group_number}
            </h1>
            {renderPrivacyBadge(project.privacy)}
            {(project.members?.length || 0) >= (project.min_members || 3) ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold bg-[#DCFCE7] text-[#15803D] px-2.5 py-0.5 rounded-full border border-[#86EFAC]">
                Grupo asegurado
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-medium bg-[#FEF3C7] text-[#B45309] px-2.5 py-0.5 rounded-full border border-[#FDE68A]">
                Pendiente de cupo mínimo
              </span>
            )}
          </div>
          <div className="title-line mt-2 mb-2" />
          <p className="text-sm font-medium text-[#51607A]">
            Comisión {project.section_name} · Ciclo lectivo {project.year} · Cupo: {project.members?.length || 0} de {project.max_members || 5} integrantes (mínimo para asegurar: {project.min_members || 3})
          </p>
        </div>

        {canDelete && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              setDeleteError(null);
              setIsDeleteModalOpen(true);
            }}
          >
            <Trash2 className="w-4 h-4 mr-1.5" />
            Eliminar equipo
          </Button>
        )}
      </div>

      {/* Caso: Sin permiso (proyecto privado, usuario ajeno) */}
      {!hasAccessToDetails ? (
        <div className="bg-white border border-[#D6E4F7] rounded-xl p-12 text-center fluted-column-pattern">
          <div className="max-w-sm mx-auto flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-[#EFF6FF] border border-[#BAE6FD] flex items-center justify-center text-[#1D4ED8] mb-3">
              <Lock className="w-6 h-6" />
            </div>
            <p className="text-base font-medium text-[#51607A]">
              El detalle de este equipo es privado
            </p>
          </div>
        </div>
      ) : (
        /* Caso: Con permiso de detalle */
        <div className="space-y-6">
          {/* Tarjetas de Nombre, Descripción, Objetivo y Problemática */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Nombre del Proyecto */}
            <div className="bg-white border border-[#D6E4F7] rounded-xl p-6 shadow-2xs md:col-span-2">
              <span className="text-xs font-semibold text-[#51607A] uppercase tracking-wider block mb-1">
                Nombre del proyecto
              </span>
              <p
                className={`text-base font-medium ${
                  project.name ? 'text-[#0B2A66]' : 'text-[#94A3B8] italic'
                }`}
              >
                {project.name || 'Sin completar'}
              </p>
            </div>

            {/* Descripción */}
            <div className="bg-white border border-[#D6E4F7] rounded-xl p-6 shadow-2xs">
              <span className="text-xs font-semibold text-[#51607A] uppercase tracking-wider block mb-2">
                Descripción
              </span>
              <p
                className={`text-sm leading-relaxed ${
                  project.description ? 'text-[#0F1F3D]' : 'text-[#94A3B8] italic'
                }`}
              >
                {project.description || 'Sin completar'}
              </p>
            </div>

            {/* Objetivo */}
            <div className="bg-white border border-[#D6E4F7] rounded-xl p-6 shadow-2xs">
              <span className="text-xs font-semibold text-[#51607A] uppercase tracking-wider block mb-2">
                Objetivo
              </span>
              <p
                className={`text-sm leading-relaxed ${
                  project.objective ? 'text-[#0F1F3D]' : 'text-[#94A3B8] italic'
                }`}
              >
                {project.objective || 'Sin completar'}
              </p>
            </div>

            {/* Problemática */}
            <div className="bg-white border border-[#D6E4F7] rounded-xl p-6 shadow-2xs md:col-span-2">
              <span className="text-xs font-semibold text-[#51607A] uppercase tracking-wider block mb-2">
                Problemática
              </span>
              <p
                className={`text-sm leading-relaxed ${
                  project.problem ? 'text-[#0F1F3D]' : 'text-[#94A3B8] italic'
                }`}
              >
                {project.problem || 'Sin completar'}
              </p>
            </div>
          </div>

          {/* Listado de Integrantes */}
          <div className="bg-white border border-[#D6E4F7] rounded-xl p-6 shadow-2xs">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-[#1D4ED8]" />
              <h3 className="font-serif font-semibold text-lg text-[#0B2A66]">
                Integrantes
              </h3>
            </div>

            {!canViewMembers ? (
              <div className="p-4 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-center text-xs text-[#51607A]">
                La nómina de integrantes está reservada a miembros del equipo y cuerpo docente.
              </div>
            ) : !project.members || project.members.length === 0 ? (
              <p className="text-sm text-[#94A3B8] italic py-2">
                El equipo aún no cuenta con estudiantes asignados.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-[#0F1F3D]">
                  <thead className="bg-[#EFF6FF] border-b border-[#D6E4F7] text-[12px] font-semibold text-[#51607A] uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-2.5">Legajo</th>
                      <th className="px-4 py-2.5">Apellido y nombre</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D6E4F7]">
                    {project.members.map((member) => (
                      <tr key={member.id_student} className="hover:bg-[#E0F2FE]/30">
                        <td className="px-4 py-3 font-mono text-[#51607A]">
                          {member.legajo}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <InitialsAvatar
                              name={`${member.last_name} ${member.first_name}`}
                              size="sm"
                            />
                            <span className="font-medium">
                              {member.last_name}, {member.first_name}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Diálogo Confirmar Eliminación */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Confirmar eliminación"
      >
        {deleteError && (
          <div
            role="alert"
            className="mb-4 p-3 rounded-lg bg-[#FEE2E2] border border-[#FCA5A5] text-[#B91C1C] text-sm flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{deleteError}</span>
          </div>
        )}

        <div className="space-y-4">
          <p className="text-sm text-[#0F1F3D]">
            ¿Desea eliminar el <span className="font-semibold">Equipo {project.group_number}</span>?
          </p>
          <p className="text-xs text-[#51607A]">
            Esta acción es definitiva. Tenga en cuenta que solo se pueden eliminar equipos que no tengan alumnos asociados.
          </p>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#D6E4F7]">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteModalOpen(false)}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              isLoading={isDeleting}
            >
              Eliminar equipo
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
