import { api } from './api';
import type { ProjectMember, ProjectPublic } from '../types/api';

// Composición de los equipos de un curso lectivo (SCRUM-103): agregar y mover alumnos.

// Todos los equipos de un curso lectivo, recorriendo las páginas del backend
export const projectsOfCourse = async (id_section_year: number): Promise<ProjectPublic[]> => {
  const items: ProjectPublic[] = [];
  for (let offset = 0; ; offset += 100) {
    const res = await api.getProjects({ id_section_year, limit: 100, offset });
    items.push(...res.items);
    if (items.length >= res.total || res.items.length === 0) return items;
  }
};

// Todos los registros de un equipo (integrantes, solicitudes, rechazados, expulsados…): sin
// filtro de estado el backend los devuelve todos
export const allMembershipsOf = async (id_project: number): Promise<ProjectMember[]> =>
  (await api.getProjectMembers(id_project, [])).items;

// Un registro rechazado no impide sumar al alumno a ese equipo: el backend lo reactiva. Cualquier
// otro (integrante, solicitud pendiente, expulsado, que abandonó) sí lo impide.
export const blocksAdding = (m: ProjectMember) => m.status.code !== 'rejected';

// Error del backend al sumar un alumno a un equipo, en palabras del usuario
export const addMemberError = (err: any): string => {
  const detail = String(err.message || '');
  if (err.status === 409) {
    if (detail.includes('another project')) return 'El alumno ya forma parte de otro equipo';
    if (detail.includes('this project')) return 'El alumno ya tiene un registro en ese equipo (una solicitud, o salió de él)';
    if (detail.includes('uninsured')) return 'El equipo ya está asegurado: no se suman integrantes';
  }
  if (err.status === 403) return 'Solo los docentes del curso lectivo y el administrador pueden sumar alumnos';
  if (err.status === 404) return 'El equipo o el alumno ya no existen';
  return detail || 'No se pudo sumar al alumno';
};
