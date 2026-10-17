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

// Color del estado del equipo según su código. Un estado nuevo del backend se muestra neutro.
export const STATUS_VARIANT: Record<string, 'public' | 'private' | 'neutral'> = {
  active: 'public',
  cancelled: 'private',
};

export const teamLabel =(p: Pick<ProjectPublic, 'group_number'>) => `Equipo ${p.group_number}`;

export const courseLabel = (p: { section_name: string; year: number }) => `${p.section_name} · ${p.year}`;
