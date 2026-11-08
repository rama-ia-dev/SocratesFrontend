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

// `GET /projects/{id}/attendance` (docente del curso lectivo o administrador): integrantes del equipo
// con su asistencia en el curso lectivo, jefe primero. `attendance` es null si el integrante no tiene
// cursada en el curso lectivo.
export interface ProjectAttendanceMember extends ProjectMember {
  attendance: AttendanceStats | null;
}

export interface ProjectAttendanceList {
  id_project: number;
  id_section_year: number;
  year: number;
  id_section: number;
  section_name: string;
  group_number: number;
  items: ProjectAttendanceMember[];
  total: number;
  limit: number;
  offset: number;
}

// Cambios de estado de un equipo asegurado (SCRUM-27): cada uno es `POST /projects/{id}/<acción>`
export type ProjectStatusAction = 'start' | 'submit' | 'approve' | 'reject' | 'retry' | 'cancel';

// Tecnología del catálogo (SCRUM-42). La imagen es opcional y hoy no se usa en pantalla
export interface TechnologyPublic {
  id_technology: number;
  name: string;
  description: string | null;
  image: { id_image: number; url: string; original_name: string | null; content_type: string } | null;
}

export interface TechnologyList {
  items: TechnologyPublic[];
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

export type ClassModality = 'in_person' | 'virtual';

// Clase concreta del calendario de un curso lectivo (una fila por fecha). Las horas vienen como
// "HH:MM:SS", en hora local.
export interface CalendarClassPublic {
  id_calendar_class: number;
  id_calendar: number;
  date: string;
  weekday: number; // ISO: 1 = lunes ... 7 = domingo
  start_time: string;
  end_time: string;
  modality: ClassModality;
  title?: string | null;
  location?: string | null;
  meeting_url?: string | null;
}

// Actividad (entrega) del curso lectivo completo
export interface ActivityPublic {
  id_activity: number;
  id_calendar: number;
  id_section_year: number;
  title: string;
  description?: string | null;
  due_date: string;
  due_time?: string | null;
}

// Alta de una clase puntual. Horas "HH:MM"; la fecha debe caer en el año del curso lectivo.
export interface CalendarClassCreate {
  date: string;
  start_time: string;
  end_time: string;
  modality: ClassModality;
  title?: string | null;
  location?: string | null;
  meeting_url?: string | null;
}

// Modificación de una clase: solo los campos enviados. `null` en título, aula o link los vacía.
export type CalendarClassUpdate = Partial<CalendarClassCreate>;

// Modificación de varias clases de un curso lectivo de una vez (la fecha no se cambia en lote). 409 si
// alguna queda superpuesta: `detail` = [{date, detail}].
export interface CalendarClassBulkUpdate {
  ids: number[];
  changes: Omit<CalendarClassUpdate, 'date'>;
}

// Porcentaje de asistencia de una cursada: sobre las clases con toma de asistencia del curso lectivo.
// `attendance_percentage` es null si todavía no hay clases con toma.
export interface AttendanceStats {
  attended_classes: number;
  total_classes: number;
  attendance_percentage: number | null;
}

// Cómo se registró la asistencia: código del alumno, marca del docente o importada del chat
export type AttendanceMethod = 'code' | 'manual' | 'transcript';

// Un alumno en la asistencia de una clase. Solo vienen cursadas `attending` o `finished_*`; solo
// las `attending` se pueden marcar (una `finished_*` solo se puede desmarcar).
export interface AttendanceStudent {
  id_student_section_year: number;
  id_student: number;
  first_name: string;
  last_name: string;
  legajo: number;
  state: string;
  present: boolean;
  method: AttendanceMethod | null;
  recorded_at: string | null;
  attendance: AttendanceStats | null;
}

// Asistencia de una clase (docente del curso lectivo o administrador), ordenada por apellido y nombre.
// `session` es la toma con código, sin exponer el código; null si nunca se habilitó.
export interface ClassAttendance {
  session: {
    id_attendance_session: number;
    open: boolean;
    opened_at: string;
    expires_at: string;
    closed_at: string | null;
  } | null;
  items: AttendanceStudent[];
}

// Toma de asistencia con código recién habilitada (o con el código rotado). El código se muestra solo
// en esta respuesta: el backend lo guarda hasheado.
export interface AttendanceSessionOpened {
  id_attendance_session: number;
  id_calendar_class: number;
  code: string;
  expires_at: string;
}

// `GET /me/attendance`: clases a las que asistió el alumno logueado, la más reciente primero
export interface MyAttendanceItem {
  id_attendance: number;
  id_calendar_class: number;
  id_section_year: number;
  year: number;
  id_section: number;
  section_name: string;
  date: string;
  start_time: string;
  end_time: string;
  title: string | null;
  modality: string;
  method: AttendanceMethod;
  recorded_at: string;
}

export interface MyAttendanceList {
  section_years: {
    id_section_year: number;
    year: number;
    id_section: number;
    section_name: string;
    attendance: AttendanceStats;
  }[];
  items: MyAttendanceItem[];
}

// Marca de asistencia guardada
export interface AttendancePublic {
  id_attendance: number;
  id_calendar_class: number;
  id_student_section_year: number;
  id_student: number;
  id_section_year: number;
  method: AttendanceMethod;
  recorded_at: string;
}

// Resultado de marcar varios alumnos a la vez. `already_present` son los que ya figuraban presentes
// (conservan su método original).
export interface AttendanceBulkResult {
  requested: number;
  created: number;
  already_present: number;
  items: AttendancePublic[];
}

// Carga en lote del calendario de un curso lectivo: agrega las filas, todo o nada. 409 si alguna clase
// se superpone con una existente: `detail` = [{kind, row, detail}], con `row` desde 1.
export interface CalendarBulkLoad {
  classes?: CalendarClassCreate[];
  activities?: ActivityCreate[];
}

export interface CalendarBulkLoadReport {
  dry_run: boolean;
  classes_created: number;
  activities_created: number;
}

// Alta de una actividad (entrega) del curso lectivo
export interface ActivityCreate {
  title: string;
  description?: string | null;
  due_date: string;
  due_time?: string | null;
}

// Modificación de una entrega: solo los campos enviados. `null` en descripción u hora los vacía.
export type ActivityUpdate = Partial<ActivityCreate>;

// `GET /section-years/{id}/calendar`: el calendario del curso lectivo con sus clases y actividades
export interface CalendarWithClasses {
  id_calendar: number;
  id_section_year: number;
  timezone: string;
  classes: CalendarClassPublic[];
  activities: ActivityPublic[];
}
