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
}

export interface SectionYearPublic {
  id_section_year: number;
  year: number;
  id_section: number;
  section_name: string;
  assigned_professors?: {
    id_professor: number;
    first_name: string;
    last_name: string;
  }[];
}

export interface SectionYearUpdate {
  year?: number | null;
  id_section?: number | null;
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

export interface ProjectCreate {
  id_section_year: number;
  group_number?: number | null;
  min_members?: number | null;
  max_members?: number | null;
}

export interface ProjectBulkCreate {
  id_section_year: number;
  quantity: number;
  min_members?: number | null;
  max_members?: number | null;
}

export interface ProjectPublic {
  id_project: number;
  id_section_year: number;
  year: number;
  id_section: number;
  section_name: string;
  group_number: number;
  privacy: ProjectPrivacy;
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

export interface ProjectList {
  items: ProjectPublic[];
  total: number;
  limit: number;
  offset: number;
}
