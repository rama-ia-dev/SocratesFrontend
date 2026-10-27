export type UserRole = 'student' | 'professor';

export interface AccessToken {
  access_token: string;
  token_type?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface PasswordRequest {
  email: string;
}

export interface PasswordConfirm {
  email: string;
  code: string;
  new_password: string;
}

export interface UserPublic {
  id_user: number;
  first_name: string;
  last_name: string;
  legajo: number;
  email: string;
  role: UserRole;
  is_super_admin?: boolean;
  birth_date?: string;
  enrollment_year?: number;
}

export interface UserListItem {
  id_user: number;
  first_name: string;
  last_name: string;
  legajo: number;
  email: string;
  role: UserRole;
  birth_date?: string | null;
  enrollment_year?: number | null;
  is_super_admin?: boolean | null;
}

export interface UserList {
  items: UserListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface UserUpdate {
  first_name?: string | null;
  last_name?: string | null;
  birth_date?: string | null;
}

export interface StudentCreate {
  first_name: string;
  last_name: string;
  legajo: number;
  birth_date: string;
  enrollment_year: number;
  // Curso lectivo en el que se inscribe (su cursada)
  id_section_year?: number;
}

export interface StudentBulkCreate {
  students: StudentCreate[];
}

export interface StudentPublic {
  id_student: number;
  first_name: string;
  last_name: string;
  legajo: number;
  email: string;
  enrollment_year: number;
  birth_date?: string;
}

// Listado de alumnos para docentes (GET /students): cada alumno con los equipos a los que pertenece
export interface StudentGroup {
  id_project: number;
  project_name?: string | null;
  group_number: number;
  id_section_year: number;
  year: number;
  id_section: number;
  section_name: string;
  // Si es el jefe del grupo y el estado de su membresía (activo, finalizado, etc.). Opcionales
  // solo porque los datos simulados no los tienen.
  is_leader?: boolean;
  status?: { code: string; name: string };
}

export interface StudentListItem {
  id_student: number;
  first_name: string;
  last_name: string;
  legajo: number;
  email: string;
  enrollment_year: number;
  groups: StudentGroup[];
}

export interface StudentList {
  items: StudentListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface StudentUpdate {
  first_name?: string | null;
  last_name?: string | null;
  birth_date?: string | null;
  legajo?: number | null;
  enrollment_year?: number | null;
}

export interface ProfessorCreate {
  first_name: string;
  last_name: string;
  legajo: number;
  birth_date: string;
  mail: string;
  is_super_admin?: boolean;
}

export interface ProfessorPublic {
  id_professor: number;
  first_name: string;
  last_name: string;
  legajo: number;
  email: string;
  is_super_admin: boolean;
  birth_date?: string;
}

export interface ProfessorUpdate {
  first_name?: string | null;
  last_name?: string | null;
  birth_date?: string | null;
  legajo?: number | null;
  mail?: string | null;
  is_super_admin?: boolean | null;
}

export interface SectionCreate {
  name: string;
}

export interface SectionPublic {
  id_section: number;
  name: string;
}

export interface SectionUpdate {
  name: string;
}

export interface SectionList {
  items: SectionPublic[];
  total: number;
  limit: number;
  offset: number;
}

export interface SectionYearCreate {
  year: number;
  id_section: number;
  min_students: number;
  max_students: number;
}

export interface SectionYearPublic {
  id_section_year: number;
  year: number;
  id_section: number;
  section_name: string;
  // Cupo de integrantes de cada equipo del curso lectivo
  min_students?: number;
  max_students?: number;
  assigned_professors?: {
    id_professor: number;
    first_name: string;
    last_name: string;
  }[];
}

export interface SectionYearUpdate {
  year?: number | null;
  id_section?: number | null;
  min_students?: number;
  max_students?: number;
}

export interface SectionYearList {
  items: SectionYearPublic[];
  total: number;
  limit: number;
  offset: number;
}

export interface ProfessorSectionYearCreate {
  id_professor: number;
  id_section_year: number;
}

export interface ProfessorSectionYearPublic {
  id_professor_section_year: number;
  id_professor: number;
  professor_first_name: string;
  professor_last_name: string;
  id_section_year: number;
  year: number;
  id_section: number;
  section_name: string;
}

export interface ProfessorSectionYearList {
  items: ProfessorSectionYearPublic[];
  total: number;
  limit: number;
  offset: number;
}

export type ProjectPrivacy = 'public' | 'private' | 'protected';

// Estado de un equipo (ámbito `project`) o de la membresía de un alumno (`student_project`).
// Los define el backend (`GET /statuses`); el código es el identificador y el nombre, el texto a mostrar.
export interface StatusPublic {
  id_status: number;
  ambito: string;
  code: string;
  name: string;
  description?: string | null;
}

export interface ProjectCreate {
  id_section_year: number;
  group_number?: number | null;
}

export interface ProjectBulkCreate {
  id_section_year: number;
  quantity: number;
}

export interface ProjectPublic {
  id_project: number;
  id_section_year: number;
  year: number;
  id_section: number;
  section_name: string;
  group_number: number;
  privacy: ProjectPrivacy;
  // Siempre viene del backend; opcional solo porque los datos simulados no lo tienen.
  status?: StatusPublic;
  restricted?: boolean;
  name?: string | null;
  description?: string | null;
  objective?: string | null;
  problem?: string | null;
  min_members?: number;
  max_members?: number;
  is_secured?: boolean;
  members?: {
    id_student: number;
    legajo: number;
    first_name: string;
    last_name: string;
  }[];
}

// Integrante de un equipo, como lo devuelve `GET /projects/{id}/overview`
export interface ProjectMember {
  id_student_project: number;
  id_student: number;
  first_name: string;
  last_name: string;
  legajo: number;
  is_leader: boolean;
  enrolled_at: string;
  status: StatusPublic;
}

// Membresía de un alumno en un equipo, como la devuelven las acciones sobre integrantes
export interface StudentProjectPublic {
  id_student_project: number;
  id_project: number;
  id_student: number;
  is_leader: boolean;
  enrolled_at: string;
  status: StatusPublic;
}

// `PATCH /projects/{id}`: solo los campos que cambian; un texto en null se borra
export interface ProjectUpdate {
  name?: string | null;
  description?: string | null;
  objective?: string | null;
  problem?: string | null;
  privacy?: ProjectPrivacy;
}

// `GET /student-section-years`: la cursada de un alumno en un curso lectivo
export interface StudentSectionYearPublic {
  id_student_section_year: number;
  id_student: number;
  student_first_name: string;
  student_last_name: string;
  student_legajo: number;
  id_section_year: number;
  year: number;
  id_section: number;
  section_name: string;
}

export interface StudentSectionYearList {
  items: StudentSectionYearPublic[];
  total: number;
  limit: number;
  offset: number;
}

// `GET /projects/{id}/members`: integrantes filtrados por estado de la membresía
export interface ProjectMemberList {
  items: ProjectMember[];
  total: number;
  limit: number;
  offset: number;
}

// Docente del curso lectivo que hace el seguimiento de un equipo (sin correo)
export interface ProfessorResponsible {
  id_professor: number;
  first_name: string;
  last_name: string;
  legajo: number;
}

// `GET /projects/{id}/overview`: el equipo con sus integrantes activos y finalizados, los docentes
// de su curso lectivo y el jefe del grupo
export interface ProjectOverview extends Omit<ProjectPublic, 'members'> {
  members: ProjectMember[];
  responsible: ProfessorResponsible[];
  leader: ProjectMember | null;
}

// `GET /me/project`: el equipo del alumno (null si no integra ninguno) y sus solicitudes para
// sumarse, pendientes y rechazadas
export interface MyProject {
  project: ProjectOverview | null;
  requests: StudentGroup[];
}

export interface ProjectList {
  items: ProjectPublic[];
  total: number;
  limit: number;
  offset: number;
}
