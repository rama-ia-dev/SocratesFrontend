import type { ProjectPrivacy, ProjectPublic } from '../types/api';

// Textos comunes de Equipos de trabajo ("projects" en el backend).

export const PRIVACY_LABEL: Record<ProjectPrivacy, string> = {
  public: 'Público',
  protected: 'Protegido',
  private: 'Privado',
};

// Qué ve cada uno según la privacidad (la decide el backend; esto solo la explica en pantalla).
export const PRIVACY_HELP: Record<ProjectPrivacy, string> = {
  public: 'Cualquier usuario ve el detalle del proyecto',
  protected: 'Fuera del equipo y de sus docentes, solo se ven los datos básicos',
  private: 'Solo lo ven sus integrantes, los docentes del curso y los super administradores',
};

// Color del estado del equipo según su código. Sin asegurar (`uninsured`) y cualquier estado
// nuevo del backend se muestran neutros.
export const STATUS_VARIANT: Record<string, 'public' | 'protected' | 'private' | 'neutral'> = {
  in_idea: 'public',
  in_progress: 'public',
  approved: 'public',
  pending_approval: 'protected',
  rejected: 'private',
  cancelled: 'private',
};

// Correo de un alumno: el backend lo arma con el legajo.
export const studentEmail = (legajo: number) => `${legajo}@sistemas.frc.utn.edu.ar`;

export const teamLabel =(p: Pick<ProjectPublic, 'group_number'>) => `Equipo ${p.group_number}`;

export const courseLabel = (p: { section_name: string; year: number }) => `${p.section_name} · ${p.year}`;
