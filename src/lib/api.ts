/**
 * Sócrates - Capa de Integración con el Backend FastAPI
 * 
 * Centraliza todas las llamadas HTTP hacia la API de Sócrates y gestiona
 * el token de acceso en memoria con renovación automática mediante cookie HttpOnly.
 * Sin backend conectado se puede trabajar con datos simulados: VITE_USE_MOCK=true (ver .env.example).
 */

import {
  AccessToken,
  LoginRequest,
  PasswordConfirm,
  PasswordRequest,
  ProfessorCreate,
  ProfessorPublic,
  ProfessorSectionYearCreate,
  ProfessorSectionYearList,
  ProfessorSectionYearPublic,
  ProfessorUpdate,
  ProjectBulkCreate,
  ProjectCreate,
  ProjectList,
  ProjectPublic,
  SectionCreate,
  SectionList,
  SectionPublic,
  SectionUpdate,
  SectionYearCreate,
  SectionYearList,
  SectionYearPublic,
  SectionYearUpdate,
  StudentBulkCreate,
  StudentCreate,
  StudentPublic,
  StudentUpdate,
  StudentList,
  UserList,
  UserPublic,
  UserUpdate,
} from '../types/api';

export const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
export const SESSION_EXPIRED_EVENT = 'socrates:session-expired';

let currentAccessToken: string | null = USE_MOCK ? 'mock-initial-jwt-token' : null;

export function getAccessToken(): string | null {
  return currentAccessToken;
}

export function setAccessToken(token: string | null): void {
  currentAccessToken = token;
}

// ==========================================
// Base de datos simulada en memoria (Mock DB)
// ==========================================

interface MockDatabase {
  me: UserPublic;
  users: (UserPublic & { birth_date?: string; enrollment_year?: number })[];
  sections: SectionPublic[];
  sectionYears: (SectionYearPublic & { assignedProfessorIds: number[] })[];
  professorAssignments: ProfessorSectionYearPublic[];
  projects: ProjectPublic[];
}

const initialMockDB: MockDatabase = {
  me: {
    id_user: 1,
    first_name: 'Roberto',
    last_name: 'González',
    legajo: 10423,
    email: 'rgonzalez@docentes.frc.utn.edu.ar',
    role: 'professor',
    is_super_admin: true,
    birth_date: '1975-06-14',
  },
  users: [
    {
      id_user: 1,
      first_name: 'Roberto',
      last_name: 'González',
      legajo: 10423,
      email: 'rgonzalez@docentes.frc.utn.edu.ar',
      role: 'professor',
      is_super_admin: true,
      birth_date: '1975-06-14',
    },
    {
      id_user: 2,
      first_name: 'Marta',
      last_name: 'Silveyra',
      legajo: 11502,
      email: 'msilveyra@docentes.frc.utn.edu.ar',
      role: 'professor',
      is_super_admin: false,
      birth_date: '1980-03-22',
    },
    {
      id_user: 3,
      first_name: 'Carlos',
      last_name: 'Benítez',
      legajo: 12108,
      email: 'cbenitez@docentes.frc.utn.edu.ar',
      role: 'professor',
      is_super_admin: false,
      birth_date: '1978-11-05',
    },
    {
      id_user: 4,
      first_name: 'Laura',
      last_name: 'Fontana',
      legajo: 13045,
      email: 'lfontana@docentes.frc.utn.edu.ar',
      role: 'professor',
      is_super_admin: false,
      birth_date: '1984-08-19',
    },
    {
      id_user: 101,
      first_name: 'Juan Ignacio',
      last_name: 'Pérez',
      legajo: 89123,
      email: '89123@sistemas.frc.utn.edu.ar',
      role: 'student',
      enrollment_year: 2021,
      birth_date: '2001-04-12',
    },
    {
      id_user: 102,
      first_name: 'Valentina',
      last_name: 'Rossi',
      legajo: 89456,
      email: '89456@sistemas.frc.utn.edu.ar',
      role: 'student',
      enrollment_year: 2021,
      birth_date: '2001-09-28',
    },
    {
      id_user: 103,
      first_name: 'Martín',
      last_name: 'Gómez',
      legajo: 90214,
      email: '90214@sistemas.frc.utn.edu.ar',
      role: 'student',
      enrollment_year: 2022,
      birth_date: '2002-01-17',
    },
    {
      id_user: 104,
      first_name: 'Sofía',
      last_name: 'Martínez',
      legajo: 91045,
      email: '91045@sistemas.frc.utn.edu.ar',
      role: 'student',
      enrollment_year: 2022,
      birth_date: '2002-07-23',
    },
    {
      id_user: 105,
      first_name: 'Lucas',
      last_name: 'Fernández',
      legajo: 91330,
      email: '91330@sistemas.frc.utn.edu.ar',
      role: 'student',
      enrollment_year: 2022,
      birth_date: '2002-11-30',
    },
    {
      id_user: 106,
      first_name: 'Camila',
      last_name: 'Díaz',
      legajo: 91880,
      email: '91880@sistemas.frc.utn.edu.ar',
      role: 'student',
      enrollment_year: 2023,
      birth_date: '2003-03-09',
    },
  ],
  sections: [
    { id_section: 1, name: '3K1' },
    { id_section: 2, name: '3K2' },
    { id_section: 3, name: '3K3' },
    { id_section: 4, name: '4K1' },
    { id_section: 5, name: '4K2' },
  ],
  sectionYears: [
    {
      id_section_year: 1,
      year: 2025,
      id_section: 1,
      section_name: '3K1',
      assignedProfessorIds: [1, 2],
    },
    {
      id_section_year: 2,
      year: 2025,
      id_section: 2,
      section_name: '3K2',
      assignedProfessorIds: [2, 3],
    },
    {
      id_section_year: 3,
      year: 2025,
      id_section: 3,
      section_name: '3K3',
      assignedProfessorIds: [3],
    },
    {
      id_section_year: 4,
      year: 2025,
      id_section: 4,
      section_name: '4K1',
      assignedProfessorIds: [1, 4],
    },
    {
      id_section_year: 5,
      year: 2024,
      id_section: 1,
      section_name: '3K1',
      assignedProfessorIds: [1],
    },
  ],
  professorAssignments: [
    {
      id_professor_section_year: 1,
      id_professor: 1,
      professor_first_name: 'Roberto',
      professor_last_name: 'González',
      id_section_year: 1,
      year: 2025,
      id_section: 1,
      section_name: '3K1',
    },
    {
      id_professor_section_year: 2,
      id_professor: 2,
      professor_first_name: 'Marta',
      professor_last_name: 'Silveyra',
      id_section_year: 1,
      year: 2025,
      id_section: 1,
      section_name: '3K1',
    },
    {
      id_professor_section_year: 3,
      id_professor: 2,
      professor_first_name: 'Marta',
      professor_last_name: 'Silveyra',
      id_section_year: 2,
      year: 2025,
      id_section: 2,
      section_name: '3K2',
    },
    {
      id_professor_section_year: 4,
      id_professor: 3,
      professor_first_name: 'Carlos',
      professor_last_name: 'Benítez',
      id_section_year: 2,
      year: 2025,
      id_section: 2,
      section_name: '3K2',
    },
  ],
  projects: [
    {
      id_project: 1,
      id_section_year: 1,
      year: 2025,
      id_section: 1,
      section_name: '3K1',
      group_number: 1,
      privacy: 'public',
      name: 'Sistema de Trazabilidad Ganadera con IoT y RFID',
      description: 'Plataforma para el seguimiento integral de la cadena bovina desde el campo hasta la comercialización frigorífica.',
      objective: 'Optimizar la recolección de eventos biológicos y el control sanitario de hacienda con lectura en tiempo real.',
      problem: 'Falta de interoperabilidad entre los pesajes en manga y el registro nacional de sanidad animal.',
      min_members: 2,
      max_members: 5,
      is_secured: true,
      members: [
        { id_student: 101, legajo: 89123, first_name: 'Juan Ignacio', last_name: 'Pérez' },
        { id_student: 102, legajo: 89456, first_name: 'Valentina', last_name: 'Rossi' },
      ],
    },
    {
      id_project: 2,
      id_section_year: 1,
      year: 2025,
      id_section: 1,
      section_name: '3K1',
      group_number: 2,
      privacy: 'protected',
      name: 'Optimización de Recorridos de Recolección de Residuos Urbanos',
      description: 'Algoritmo genético acoplado a un visor cartográfico para la reducción de huella de carbono en flotas municipales.',
      objective: 'Reducir los tiempos de traslado y consumo de combustible en un 18%.',
      problem: 'Recorridos estáticos con congestión en horas pico sin adaptación a llenado de contenedores.',
      min_members: 3,
      max_members: 5,
      is_secured: false,
      members: [
        { id_student: 103, legajo: 90214, first_name: 'Martín', last_name: 'Gómez' },
      ],
    },
    {
      id_project: 3,
      id_section_year: 1,
      year: 2025,
      id_section: 1,
      section_name: '3K1',
      group_number: 3,
      privacy: 'private',
      name: null,
      description: null,
      objective: null,
      problem: null,
      min_members: 3,
      max_members: 5,
      is_secured: false,
      members: [],
    },
    {
      id_project: 4,
      id_section_year: 2,
      year: 2025,
      id_section: 2,
      section_name: '3K2',
      group_number: 1,
      privacy: 'public',
      name: 'Portal de Gestión de Pasantías Universitarias UTN',
      description: 'Gestor de convocatorias y convenios empresa-facultad para alumnos del departamento de Sistemas.',
      objective: 'Digitalizar los acuerdos marco y reportes de seguimiento bimestrales.',
      problem: 'Proceso manual y dispersión de documentación en expedientes impresos.',
      min_members: 2,
      max_members: 4,
      is_secured: true,
      members: [
        { id_student: 104, legajo: 91045, first_name: 'Sofía', last_name: 'Martínez' },
        { id_student: 105, legajo: 91330, first_name: 'Lucas', last_name: 'Fernández' },
      ],
    },
  ],
};

const mockDB: MockDatabase = JSON.parse(JSON.stringify(initialMockDB));

// Helper para emular latencia de red en mock
function delay(ms: number = 180): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// El backend rota el refresh token en cada uso: si dos pedidos reciben 401 a la vez y cada uno
// llamara a /auth/refresh, el segundo llegaría con una cookie ya consumida y expulsaría al usuario.
// Por eso todos los 401 simultáneos esperan la misma renovación.
let refreshInFlight: Promise<string | null> | null = null;

function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
      .then(async (res) => (res.ok ? ((await res.json()) as AccessToken).access_token : null))
      .catch(() => null)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

// Helper HTTP real con reintento automático de refresh token en 401
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  if (USE_MOCK) {
    throw new Error('Using mock mode. Directly call mock functions.');
  }

  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (currentAccessToken) {
    headers.set('Authorization', `Bearer ${currentAccessToken}`);
  }

  const fetchOptions: RequestInit = {
    ...options,
    headers,
    credentials: 'include',
  };

  let response = await fetch(`${API_BASE_URL}${endpoint}`, fetchOptions);

  if (response.status === 401 && endpoint !== '/auth/login' && endpoint !== '/auth/refresh') {
    // Intentar renovar el token llamando a POST /auth/refresh (la cookie viaja sola)
    const newToken = await refreshAccessToken();
    if (!newToken) {
      // Sin sesión válida: se avisa a AuthContext, que limpia el usuario y el router manda al
      // login. No se recarga la página: eso volvía a pedir /me y entraba en un bucle.
      currentAccessToken = null;
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
      const err: any = new Error('Sesión vencida. Inicie sesión nuevamente.');
      err.status = 401;
      throw err;
    }
    currentAccessToken = newToken;
    headers.set('Authorization', `Bearer ${currentAccessToken}`);
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...fetchOptions,
      headers,
    });
  }

  if (!response.ok) {
    let errorDetail = '';
    try {
      const errorJson = await response.json();
      errorDetail = errorJson.detail || JSON.stringify(errorJson);
    } catch {
      errorDetail = response.statusText;
    }
    const err: any = new Error(errorDetail || `Error ${response.status}`);
    err.status = response.status;
    throw err;
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

export const api = {
  // ==========================================
  // Auth
  // ==========================================
  async login(payload: LoginRequest): Promise<AccessToken> {
    if (USE_MOCK) {
      await delay();
      const emailLower = payload.email.trim().toLowerCase();
      // Buscar usuario en base simulada
      const foundUser = mockDB.users.find(
        (u) => u.email.toLowerCase() === emailLower
      );

      if (!foundUser) {
        const err: any = new Error('Correo o contraseña incorrectos');
        err.status = 401;
        throw err;
      }

      currentAccessToken = `mock-token-${foundUser.id_user}`;
      mockDB.me = {
        id_user: foundUser.id_user,
        first_name: foundUser.first_name,
        last_name: foundUser.last_name,
        legajo: foundUser.legajo,
        email: foundUser.email,
        role: foundUser.role,
        is_super_admin: foundUser.is_super_admin,
        birth_date: foundUser.birth_date,
        enrollment_year: foundUser.enrollment_year,
      };

      return { access_token: currentAccessToken, token_type: 'bearer' };
    }
    const token = await request<AccessToken>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    currentAccessToken = token.access_token;
    return token;
  },

  async logout(): Promise<void> {
    if (USE_MOCK) {
      await delay(100);
      currentAccessToken = null;
      return;
    }
    await request<void>('/auth/logout', { method: 'POST' });
    currentAccessToken = null;
  },

  async requestPassword(payload: PasswordRequest): Promise<void> {
    if (USE_MOCK) {
      await delay();
      // El backend siempre responde 202 exista o no el correo
      return;
    }
    await request<void>('/auth/password/request', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async confirmPassword(payload: PasswordConfirm): Promise<void> {
    if (USE_MOCK) {
      await delay();
      if (!payload.code || payload.code.trim().length === 0) {
        const err: any = new Error('El código es inválido o ya fue usado');
        err.status = 400;
        throw err;
      }
      if (payload.new_password.length < 8) {
        const err: any = new Error('La contraseña debe tener al menos 8 caracteres');
        err.status = 422;
        throw err;
      }
      return;
    }
    await request<void>('/auth/password/confirm', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // ==========================================
  // Me
  // ==========================================
  async getMe(): Promise<UserPublic> {
    if (USE_MOCK) {
      await delay(100);
      if (!currentAccessToken) {
        const err: any = new Error('Token ausente, inválido o vencido');
        err.status = 401;
        throw err;
      }
      return { ...mockDB.me };
    }
    return request<UserPublic>('/me', { method: 'GET' });
  },

  async updateMe(payload: UserUpdate): Promise<UserPublic> {
    if (USE_MOCK) {
      await delay();
      if (payload.birth_date) {
        const inputDate = new Date(payload.birth_date);
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        if (inputDate > today) {
          const err: any = new Error('La fecha no puede ser posterior a hoy');
          err.status = 422;
          throw err;
        }
      }
      if (payload.first_name) mockDB.me.first_name = payload.first_name.trim();
      if (payload.last_name) mockDB.me.last_name = payload.last_name.trim();
      if (payload.birth_date) mockDB.me.birth_date = payload.birth_date;

      const userIndex = mockDB.users.findIndex((u) => u.id_user === mockDB.me.id_user);
      if (userIndex >= 0) {
        mockDB.users[userIndex] = {
          ...mockDB.users[userIndex],
          first_name: mockDB.me.first_name,
          last_name: mockDB.me.last_name,
          birth_date: mockDB.me.birth_date,
        };
      }

      return { ...mockDB.me };
    }
    return request<UserPublic>('/me', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  // Helper para cambiar rol de simulación en mock mode
  setMockRole(role: 'superadmin' | 'professor' | 'student'): void {
    if (role === 'superadmin') {
      const u = mockDB.users.find((x) => x.id_user === 1)!;
      mockDB.me = { ...u };
      currentAccessToken = 'mock-token-superadmin';
    } else if (role === 'professor') {
      const u = mockDB.users.find((x) => x.id_user === 2)!;
      mockDB.me = { ...u };
      currentAccessToken = 'mock-token-professor';
    } else {
      const u = mockDB.users.find((x) => x.id_user === 101)!;
      mockDB.me = { ...u };
      currentAccessToken = 'mock-token-student';
    }
  },

  // ==========================================
  // Students: listado para docentes (SCRUM-99)
  // ==========================================
  // Un docente común ve los alumnos de sus cursos lectivos; el super administrador, todos.
  async getStudents(params: {
    id_section_year?: number | null;
    q?: string | null;
    limit?: number;
    offset?: number;
  } = {}): Promise<StudentList> {
    if (USE_MOCK) {
      const res = await this.getUsers({ role: 'student', q: params.q, limit: params.limit, offset: params.offset });
      return {
        ...res,
        items: res.items.map((u) => ({
          id_student: u.id_user,
          first_name: u.first_name,
          last_name: u.last_name,
          legajo: u.legajo,
          email: u.email,
          enrollment_year: u.enrollment_year ?? 0,
          groups: [],
        })),
      };
    }

    const query = new URLSearchParams();
    if (params.id_section_year) query.set('id_section_year', params.id_section_year.toString());
    if (params.q) query.set('q', params.q);
    if (params.limit !== undefined) query.set('limit', params.limit.toString());
    if (params.offset !== undefined) query.set('offset', params.offset.toString());

    return request<StudentList>(`/students?${query.toString()}`);
  },

  // ==========================================
  // Users (Solo super admin)
  // ==========================================
  async getUsers(params: {
    role?: 'student' | 'professor' | null;
    q?: string | null;
    limit?: number;
    offset?: number;
  } = {}): Promise<UserList> {
    if (USE_MOCK) {
      await delay();
      if (!mockDB.me.is_super_admin) {
        // Profesores tienen permiso para consultar los estudiantes a su cargo
        if (mockDB.me.role === 'professor' && params.role === 'student') {
          // Permitido
        } else {
          const err: any = new Error('No tiene permisos para realizar esta acción');
          err.status = 403;
          throw err;
        }
      }

      let filtered = [...mockDB.users];
      if (params.role) {
        filtered = filtered.filter((u) => u.role === params.role);
      }
      if (params.q && params.q.trim()) {
        const query = params.q.trim().toLowerCase();
        filtered = filtered.filter(
          (u) =>
            u.first_name.toLowerCase().includes(query) ||
            u.last_name.toLowerCase().includes(query) ||
            u.legajo.toString() === query ||
            u.email.toLowerCase().includes(query)
        );
      }

      // Orden: apellido, nombre
      filtered.sort((a, b) => {
        const last = a.last_name.localeCompare(b.last_name);
        return last !== 0 ? last : a.first_name.localeCompare(b.first_name);
      });

      const total = filtered.length;
      const offset = params.offset || 0;
      const limit = params.limit || 50;
      const paged = filtered.slice(offset, offset + limit);

      return {
        items: paged.map((u) => ({
          id_user: u.id_user,
          first_name: u.first_name,
          last_name: u.last_name,
          legajo: u.legajo,
          email: u.email,
          role: u.role,
          birth_date: u.birth_date ?? null,
          enrollment_year: u.enrollment_year ?? null,
          is_super_admin: u.is_super_admin ?? null,
        })),
        total,
        limit,
        offset,
      };
    }

    const query = new URLSearchParams();
    if (params.role) query.set('role', params.role);
    if (params.q) query.set('q', params.q);
    if (params.limit !== undefined) query.set('limit', params.limit.toString());
    if (params.offset !== undefined) query.set('offset', params.offset.toString());

    return request<UserList>(`/users?${query.toString()}`);
  },

  // ==========================================
  // Students
  // ==========================================
  async createStudent(payload: StudentCreate): Promise<StudentPublic> {
    if (USE_MOCK) {
      await delay();
      const existing = mockDB.users.find(
        (u) => u.role === 'student' && u.legajo === payload.legajo
      );
      if (existing) {
        const err: any = new Error('Ya existe un alumno con ese legajo');
        err.status = 409;
        throw err;
      }

      const id_student = Date.now();
      const email = `${payload.legajo}@sistemas.frc.utn.edu.ar`;
      const newStudent: UserPublic & { birth_date?: string; enrollment_year?: number } = {
        id_user: id_student,
        first_name: payload.first_name.trim(),
        last_name: payload.last_name.trim(),
        legajo: payload.legajo,
        email,
        role: 'student',
        enrollment_year: payload.enrollment_year,
        birth_date: payload.birth_date,
      };
      mockDB.users.push(newStudent);

      return {
        id_student,
        first_name: newStudent.first_name,
        last_name: newStudent.last_name,
        legajo: newStudent.legajo,
        email,
        enrollment_year: payload.enrollment_year,
        birth_date: payload.birth_date,
      };
    }

    return request<StudentPublic>('/students', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async createStudentsBulk(payload: StudentBulkCreate): Promise<StudentPublic[]> {
    if (USE_MOCK) {
      await delay(300);
      const errors: { row: number; legajo: number; detail: string }[] = [];
      const seenLegajos = new Set<number>();

      payload.students.forEach((s, idx) => {
        const row = idx + 1;
        if (!s.legajo || s.legajo <= 0) {
          errors.push({ row, legajo: s.legajo, detail: 'El legajo debe ser un número positivo' });
        } else if (seenLegajos.has(s.legajo)) {
          errors.push({ row, legajo: s.legajo, detail: 'Legajo duplicado dentro del archivo' });
        } else {
          seenLegajos.add(s.legajo);
          const exists = mockDB.users.find(
            (u) => u.role === 'student' && u.legajo === s.legajo
          );
          if (exists) {
            errors.push({ row, legajo: s.legajo, detail: 'Ya existe un alumno con ese legajo' });
          }
        }
      });

      if (errors.length > 0) {
        const first = errors[0];
        const err: any = new Error(`Error en la fila ${first.row}: ${first.detail}`);
        err.status = 422;
        err.errors = errors;
        throw err;
      }

      const created: StudentPublic[] = [];
      for (const s of payload.students) {
        const id_student = Math.floor(Math.random() * 1000000);
        const email = `${s.legajo}@sistemas.frc.utn.edu.ar`;
        mockDB.users.push({
          id_user: id_student,
          first_name: s.first_name.trim(),
          last_name: s.last_name.trim(),
          legajo: s.legajo,
          email,
          role: 'student',
          enrollment_year: s.enrollment_year,
          birth_date: s.birth_date,
        });
        created.push({
          id_student,
          first_name: s.first_name.trim(),
          last_name: s.last_name.trim(),
          legajo: s.legajo,
          email,
          enrollment_year: s.enrollment_year,
        });
      }
      return created;
    }

    return request<StudentPublic[]>('/students/bulk', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateStudent(id_student: number, payload: StudentUpdate): Promise<StudentPublic> {
    if (USE_MOCK) {
      await delay();
      const userIndex = mockDB.users.findIndex(
        (u) => u.id_user === id_student && u.role === 'student'
      );
      if (userIndex === -1) {
        const err: any = new Error('No existe el alumno');
        err.status = 404;
        throw err;
      }

      if (payload.legajo !== undefined && payload.legajo !== null) {
        const dup = mockDB.users.find(
          (u) => u.role === 'student' && u.legajo === payload.legajo && u.id_user !== id_student
        );
        if (dup) {
          const err: any = new Error('Otro alumno ya tiene ese legajo');
          err.status = 409;
          throw err;
        }
      }

      const current = mockDB.users[userIndex];
      const newLegajo = payload.legajo ?? current.legajo;
      const newEmail = payload.legajo ? `${payload.legajo}@sistemas.frc.utn.edu.ar` : current.email;

      mockDB.users[userIndex] = {
        ...current,
        first_name: payload.first_name !== undefined && payload.first_name !== null ? payload.first_name.trim() : current.first_name,
        last_name: payload.last_name !== undefined && payload.last_name !== null ? payload.last_name.trim() : current.last_name,
        birth_date: payload.birth_date ?? current.birth_date,
        legajo: newLegajo,
        email: newEmail,
        enrollment_year: payload.enrollment_year ?? current.enrollment_year,
      };

      const updated = mockDB.users[userIndex];
      return {
        id_student: updated.id_user,
        first_name: updated.first_name,
        last_name: updated.last_name,
        legajo: updated.legajo,
        email: updated.email,
        enrollment_year: updated.enrollment_year || 2024,
      };
    }

    return request<StudentPublic>(`/students/${id_student}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  // ==========================================
  // Professors
  // ==========================================
  async createProfessor(payload: ProfessorCreate): Promise<ProfessorPublic> {
    if (USE_MOCK) {
      await delay();
      const mailLower = payload.mail.trim().toLowerCase();
      if (mailLower.endsWith('@sistemas.frc.utn.edu.ar')) {
        const err: any = new Error('No puede usar el dominio de los alumnos');
        err.status = 422;
        throw err;
      }

      const dup = mockDB.users.find(
        (u) => u.role === 'professor' && u.email.toLowerCase() === mailLower
      );
      if (dup) {
        const err: any = new Error('Ya existe un docente con ese correo');
        err.status = 409;
        throw err;
      }

      const id_professor = Date.now();
      const newProf: UserPublic & { birth_date?: string } = {
        id_user: id_professor,
        first_name: payload.first_name.trim(),
        last_name: payload.last_name.trim(),
        legajo: payload.legajo,
        email: mailLower,
        role: 'professor',
        is_super_admin: Boolean(payload.is_super_admin),
        birth_date: payload.birth_date,
      };
      mockDB.users.push(newProf);

      return {
        id_professor,
        first_name: newProf.first_name,
        last_name: newProf.last_name,
        legajo: newProf.legajo,
        email: newProf.email,
        is_super_admin: Boolean(newProf.is_super_admin),
        birth_date: payload.birth_date,
      };
    }

    return request<ProfessorPublic>('/professors', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateProfessor(id_professor: number, payload: ProfessorUpdate): Promise<ProfessorPublic> {
    if (USE_MOCK) {
      await delay();
      const profIndex = mockDB.users.findIndex(
        (u) => u.id_user === id_professor && u.role === 'professor'
      );
      if (profIndex === -1) {
        const err: any = new Error('No existe el profesor');
        err.status = 404;
        throw err;
      }

      const current = mockDB.users[profIndex];

      // Un super admin no puede quitarse a sí mismo el rol
      if (
        id_professor === mockDB.me.id_user &&
        payload.is_super_admin === false &&
        mockDB.me.is_super_admin
      ) {
        const err: any = new Error('No puede quitarse a sí mismo el rol de super administrador');
        err.status = 409;
        throw err;
      }

      let newEmail = current.email;
      if (payload.mail) {
        const mailLower = payload.mail.trim().toLowerCase();
        if (mailLower.endsWith('@sistemas.frc.utn.edu.ar')) {
          const err: any = new Error('No puede usar el dominio de los alumnos');
          err.status = 422;
          throw err;
        }
        const dup = mockDB.users.find(
          (u) => u.role === 'professor' && u.email.toLowerCase() === mailLower && u.id_user !== id_professor
        );
        if (dup) {
          const err: any = new Error('Ya existe un profesor con ese mail');
          err.status = 409;
          throw err;
        }
        newEmail = mailLower;
      }

      mockDB.users[profIndex] = {
        ...current,
        first_name: payload.first_name !== undefined && payload.first_name !== null ? payload.first_name.trim() : current.first_name,
        last_name: payload.last_name !== undefined && payload.last_name !== null ? payload.last_name.trim() : current.last_name,
        birth_date: payload.birth_date ?? current.birth_date,
        legajo: payload.legajo ?? current.legajo,
        email: newEmail,
        is_super_admin: payload.is_super_admin !== undefined && payload.is_super_admin !== null ? payload.is_super_admin : current.is_super_admin,
      };

      const updated = mockDB.users[profIndex];
      return {
        id_professor: updated.id_user,
        first_name: updated.first_name,
        last_name: updated.last_name,
        legajo: updated.legajo,
        email: updated.email,
        is_super_admin: Boolean(updated.is_super_admin),
      };
    }

    return request<ProfessorPublic>(`/professors/${id_professor}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  // ==========================================
  // Sections (Comisiones)
  // ==========================================
  async getSections(params: { q?: string | null; limit?: number; offset?: number } = {}): Promise<SectionList> {
    if (USE_MOCK) {
      await delay();
      let filtered = [...mockDB.sections];
      if (params.q && params.q.trim()) {
        const query = params.q.trim().toUpperCase();
        filtered = filtered.filter((s) => s.name.toUpperCase().includes(query));
      }
      filtered.sort((a, b) => a.name.localeCompare(b.name));

      const total = filtered.length;
      const offset = params.offset || 0;
      const limit = params.limit || 50;

      return {
        items: filtered.slice(offset, offset + limit),
        total,
        limit,
        offset,
      };
    }

    const query = new URLSearchParams();
    if (params.q) query.set('q', params.q);
    if (params.limit !== undefined) query.set('limit', params.limit.toString());
    if (params.offset !== undefined) query.set('offset', params.offset.toString());

    return request<SectionList>(`/sections?${query.toString()}`);
  },

  async createSection(payload: SectionCreate): Promise<SectionPublic> {
    if (USE_MOCK) {
      await delay();
      const normName = payload.name.trim().toUpperCase();
      if (!normName) {
        const err: any = new Error('Ingrese un nombre');
        err.status = 422;
        throw err;
      }
      const dup = mockDB.sections.find((s) => s.name.toUpperCase() === normName);
      if (dup) {
        const err: any = new Error('Ya existe una comisión con ese nombre');
        err.status = 409;
        throw err;
      }

      const newSec: SectionPublic = {
        id_section: Date.now(),
        name: normName,
      };
      mockDB.sections.push(newSec);
      return newSec;
    }

    return request<SectionPublic>('/sections', {
      method: 'POST',
      body: JSON.stringify({ name: payload.name.trim().toUpperCase() }),
    });
  },

  async updateSection(id_section: number, payload: SectionUpdate): Promise<SectionPublic> {
    if (USE_MOCK) {
      await delay();
      const normName = payload.name.trim().toUpperCase();
      const idx = mockDB.sections.findIndex((s) => s.id_section === id_section);
      if (idx === -1) {
        const err: any = new Error('No existe la comisión');
        err.status = 404;
        throw err;
      }
      const dup = mockDB.sections.find(
        (s) => s.id_section !== id_section && s.name.toUpperCase() === normName
      );
      if (dup) {
        const err: any = new Error('Ya existe otra comisión con ese nombre');
        err.status = 409;
        throw err;
      }

      mockDB.sections[idx].name = normName;
      // Actualizar también nombres denormalizados
      mockDB.sectionYears.forEach((sy) => {
        if (sy.id_section === id_section) sy.section_name = normName;
      });
      mockDB.projects.forEach((p) => {
        if (p.id_section === id_section) p.section_name = normName;
      });

      return mockDB.sections[idx];
    }

    return request<SectionPublic>(`/sections/${id_section}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: payload.name.trim().toUpperCase() }),
    });
  },

  async deleteSection(id_section: number): Promise<void> {
    if (USE_MOCK) {
      await delay();
      const hasYears = mockDB.sectionYears.some((sy) => sy.id_section === id_section);
      if (hasYears) {
        const err: any = new Error('La comisión tiene cursos lectivos asociados y no se puede eliminar');
        err.status = 409;
        throw err;
      }
      mockDB.sections = mockDB.sections.filter((s) => s.id_section !== id_section);
      return;
    }

    return request<void>(`/sections/${id_section}`, { method: 'DELETE' });
  },

  // ==========================================
  // Section Years (Cursos Lectivos)
  // ==========================================
  async getSectionYears(params: {
    year?: number | null;
    id_section?: number | null;
    limit?: number;
    offset?: number;
  } = {}): Promise<SectionYearList> {
    if (USE_MOCK) {
      await delay();
      let filtered = [...mockDB.sectionYears];

      if (params.year) {
        filtered = filtered.filter((sy) => sy.year === params.year);
      }
      if (params.id_section) {
        filtered = filtered.filter((sy) => sy.id_section === params.id_section);
      }

      // Orden: año más reciente primero, luego comisión
      filtered.sort((a, b) => {
        if (b.year !== a.year) return b.year - a.year;
        return a.section_name.localeCompare(b.section_name);
      });

      const total = filtered.length;
      const offset = params.offset || 0;
      const limit = params.limit || 50;

      const items: SectionYearPublic[] = filtered
        .slice(offset, offset + limit)
        .map((sy) => {
          const professors = sy.assignedProfessorIds
            .map((pid) => mockDB.users.find((u) => u.id_user === pid))
            .filter((u): u is UserPublic => Boolean(u))
            .map((u) => ({
              id_professor: u.id_user,
              first_name: u.first_name,
              last_name: u.last_name,
            }));

          return {
            id_section_year: sy.id_section_year,
            year: sy.year,
            id_section: sy.id_section,
            section_name: sy.section_name,
            assigned_professors: professors,
          };
        });

      return {
        items,
        total,
        limit,
        offset,
      };
    }

    const query = new URLSearchParams();
    if (params.year) query.set('year', params.year.toString());
    if (params.id_section) query.set('id_section', params.id_section.toString());
    if (params.limit !== undefined) query.set('limit', params.limit.toString());
    if (params.offset !== undefined) query.set('offset', params.offset.toString());

    return request<SectionYearList>(`/section-years?${query.toString()}`);
  },

  async createSectionYear(payload: SectionYearCreate): Promise<SectionYearPublic> {
    if (USE_MOCK) {
      await delay();
      const sec = mockDB.sections.find((s) => s.id_section === payload.id_section);
      if (!sec) {
        const err: any = new Error('No existe la comisión indicada');
        err.status = 404;
        throw err;
      }

      const dup = mockDB.sectionYears.find(
        (sy) => sy.year === payload.year && sy.id_section === payload.id_section
      );
      if (dup) {
        const err: any = new Error('Ya existe ese curso lectivo');
        err.status = 409;
        throw err;
      }

      const newSY: SectionYearPublic & { assignedProfessorIds: number[] } = {
        id_section_year: Date.now(),
        year: payload.year,
        id_section: payload.id_section,
        section_name: sec.name,
        min_students: payload.min_students,
        max_students: payload.max_students,
        assignedProfessorIds: [],
        assigned_professors: [],
      };
      mockDB.sectionYears.push(newSY);
      return newSY;
    }

    return request<SectionYearPublic>('/section-years', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateSectionYear(id_section_year: number, payload: SectionYearUpdate): Promise<SectionYearPublic> {
    if (USE_MOCK) {
      await delay();
      const sy = mockDB.sectionYears.find((x) => x.id_section_year === id_section_year);
      if (!sy) {
        const err: any = new Error('No existe el curso lectivo');
        err.status = 404;
        throw err;
      }

      const targetYear = payload.year ?? sy.year;
      const targetSecId = payload.id_section ?? sy.id_section;

      const dup = mockDB.sectionYears.find(
        (x) =>
          x.id_section_year !== id_section_year &&
          x.year === targetYear &&
          x.id_section === targetSecId
      );
      if (dup) {
        const err: any = new Error('Ya existe esa comisión en ese año');
        err.status = 409;
        throw err;
      }

      if (payload.id_section) {
        const sec = mockDB.sections.find((s) => s.id_section === payload.id_section);
        if (sec) {
          sy.id_section = sec.id_section;
          sy.section_name = sec.name;
        }
      }
      if (payload.year) {
        sy.year = payload.year;
      }
      if (payload.min_students) sy.min_students = payload.min_students;
      if (payload.max_students) sy.max_students = payload.max_students;

      return {
        id_section_year: sy.id_section_year,
        year: sy.year,
        id_section: sy.id_section,
        section_name: sy.section_name,
        min_students: sy.min_students,
        max_students: sy.max_students,
      };
    }

    return request<SectionYearPublic>(`/section-years/${id_section_year}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async deleteSectionYear(id_section_year: number): Promise<void> {
    if (USE_MOCK) {
      await delay();
      const hasAssignments = mockDB.professorAssignments.some(
        (p) => p.id_section_year === id_section_year
      );
      const hasProjects = mockDB.projects.some((p) => p.id_section_year === id_section_year);
      if (hasAssignments || hasProjects) {
        const err: any = new Error('El curso lectivo tiene profesores asignados (u otros datos) y no se puede eliminar');
        err.status = 409;
        throw err;
      }
      mockDB.sectionYears = mockDB.sectionYears.filter((x) => x.id_section_year !== id_section_year);
      return;
    }

    return request<void>(`/section-years/${id_section_year}`, { method: 'DELETE' });
  },

  // ==========================================
  // Professor Section Years (Asignaciones)
  // ==========================================
  async getProfessorSectionYears(params: {
    id_professor?: number | null;
    id_section_year?: number | null;
    year?: number | null;
    id_section?: number | null;
    limit?: number;
    offset?: number;
  } = {}): Promise<ProfessorSectionYearList> {
    if (USE_MOCK) {
      await delay();
      let filtered = [...mockDB.professorAssignments];
      if (params.id_professor) {
        filtered = filtered.filter((pa) => pa.id_professor === params.id_professor);
      }
      if (params.id_section_year) {
        filtered = filtered.filter((pa) => pa.id_section_year === params.id_section_year);
      }
      if (params.year) {
        filtered = filtered.filter((pa) => pa.year === params.year);
      }
      if (params.id_section) {
        filtered = filtered.filter((pa) => pa.id_section === params.id_section);
      }

      const total = filtered.length;
      const offset = params.offset || 0;
      const limit = params.limit || 50;

      return {
        items: filtered.slice(offset, offset + limit),
        total,
        limit,
        offset,
      };
    }

    const query = new URLSearchParams();
    if (params.id_professor) query.set('id_professor', params.id_professor.toString());
    if (params.id_section_year) query.set('id_section_year', params.id_section_year.toString());
    if (params.year) query.set('year', params.year.toString());
    if (params.id_section) query.set('id_section', params.id_section.toString());
    if (params.limit !== undefined) query.set('limit', params.limit.toString());
    if (params.offset !== undefined) query.set('offset', params.offset.toString());

    return request<ProfessorSectionYearList>(`/professor-section-years?${query.toString()}`);
  },

  async createProfessorSectionYear(payload: ProfessorSectionYearCreate): Promise<ProfessorSectionYearPublic> {
    if (USE_MOCK) {
      await delay();
      const prof = mockDB.users.find(
        (u) => u.id_user === payload.id_professor && u.role === 'professor'
      );
      if (!prof) {
        const err: any = new Error('No existe el profesor');
        err.status = 404;
        throw err;
      }
      const sy = mockDB.sectionYears.find((x) => x.id_section_year === payload.id_section_year);
      if (!sy) {
        const err: any = new Error('No existe el curso lectivo');
        err.status = 404;
        throw err;
      }

      const dup = mockDB.professorAssignments.find(
        (pa) =>
          pa.id_professor === payload.id_professor &&
          pa.id_section_year === payload.id_section_year
      );
      if (dup) {
        const err: any = new Error('El docente ya está asignado a este curso lectivo');
        err.status = 409;
        throw err;
      }

      const newAssignment: ProfessorSectionYearPublic = {
        id_professor_section_year: Date.now(),
        id_professor: prof.id_user,
        professor_first_name: prof.first_name,
        professor_last_name: prof.last_name,
        id_section_year: sy.id_section_year,
        year: sy.year,
        id_section: sy.id_section,
        section_name: sy.section_name,
      };

      mockDB.professorAssignments.push(newAssignment);
      if (!sy.assignedProfessorIds.includes(prof.id_user)) {
        sy.assignedProfessorIds.push(prof.id_user);
      }

      return newAssignment;
    }

    return request<ProfessorSectionYearPublic>('/professor-section-years', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async deleteProfessorSectionYear(id_professor_section_year: number): Promise<void> {
    if (USE_MOCK) {
      await delay();
      const assignment = mockDB.professorAssignments.find(
        (pa) => pa.id_professor_section_year === id_professor_section_year
      );
      if (assignment) {
        const sy = mockDB.sectionYears.find((x) => x.id_section_year === assignment.id_section_year);
        if (sy) {
          sy.assignedProfessorIds = sy.assignedProfessorIds.filter(
            (pid) => pid !== assignment.id_professor
          );
        }
      }
      mockDB.professorAssignments = mockDB.professorAssignments.filter(
        (pa) => pa.id_professor_section_year !== id_professor_section_year
      );
      return;
    }

    return request<void>(`/professor-section-years/${id_professor_section_year}`, {
      method: 'DELETE',
    });
  },

  // ==========================================
  // Projects (Equipos de trabajo)
  // ==========================================
  async getProjects(params: {
    id_section_year?: number | null;
    year?: number | null;
    id_section?: number | null;
    privacy?: 'public' | 'private' | 'protected' | null;
    limit?: number;
    offset?: number;
  } = {}): Promise<ProjectList> {
    if (USE_MOCK) {
      await delay();
      let filtered = [...mockDB.projects];

      if (params.id_section_year) {
        filtered = filtered.filter((p) => p.id_section_year === params.id_section_year);
      }
      if (params.year) {
        filtered = filtered.filter((p) => p.year === params.year);
      }
      if (params.id_section) {
        filtered = filtered.filter((p) => p.id_section === params.id_section);
      }
      if (params.privacy) {
        filtered = filtered.filter((p) => p.privacy === params.privacy);
      }

      // Orden: año más reciente, comisión y número de grupo
      filtered.sort((a, b) => {
        if (b.year !== a.year) return b.year - a.year;
        const sComp = a.section_name.localeCompare(b.section_name);
        if (sComp !== 0) return sComp;
        return a.group_number - b.group_number;
      });

      const total = filtered.length;
      const offset = params.offset || 0;
      const limit = params.limit || 50;

      // Adaptar visibilidad básica
      const items: ProjectPublic[] = filtered
        .slice(offset, offset + limit)
        .map((p) => {
          // Chequear permisos sobre proyecto privado
          const isSuperAdmin = Boolean(mockDB.me.is_super_admin);
          const sy = mockDB.sectionYears.find((x) => x.id_section_year === p.id_section_year);
          const isProfOfCourse = sy ? sy.assignedProfessorIds.includes(mockDB.me.id_user) : false;
          const isMember = (p.members || []).some((m) => m.id_student === mockDB.me.id_user);

          const hasAccess = isSuperAdmin || isProfOfCourse || isMember;

          if (p.privacy === 'private' && !hasAccess) {
            return {
              id_project: p.id_project,
              id_section_year: p.id_section_year,
              year: p.year,
              id_section: p.id_section,
              section_name: p.section_name,
              group_number: p.group_number,
              privacy: p.privacy,
              restricted: true,
              name: null,
              description: null,
              objective: null,
              problem: null,
              members: p.members || [],
            };
          }

          return { ...p, restricted: false, members: p.members || [] };
        });

      return {
        items,
        total,
        limit,
        offset,
      };
    }

    const query = new URLSearchParams();
    if (params.id_section_year) query.set('id_section_year', params.id_section_year.toString());
    if (params.year) query.set('year', params.year.toString());
    if (params.id_section) query.set('id_section', params.id_section.toString());
    if (params.privacy) query.set('privacy', params.privacy);
    if (params.limit !== undefined) query.set('limit', params.limit.toString());
    if (params.offset !== undefined) query.set('offset', params.offset.toString());

    return request<ProjectList>(`/projects?${query.toString()}`);
  },

  async getProject(id_project: number): Promise<ProjectPublic> {
    if (USE_MOCK) {
      await delay();
      const p = mockDB.projects.find((x) => x.id_project === id_project);
      if (!p) {
        const err: any = new Error('No se encontró el recurso');
        err.status = 404;
        throw err;
      }

      const isSuperAdmin = Boolean(mockDB.me.is_super_admin);
      const sy = mockDB.sectionYears.find((x) => x.id_section_year === p.id_section_year);
      const isProfOfCourse = sy ? sy.assignedProfessorIds.includes(mockDB.me.id_user) : false;
      const isMember = (p.members || []).some((m) => m.id_student === mockDB.me.id_user);
      const hasFullAccess = isSuperAdmin || isProfOfCourse || isMember;

      if (p.privacy === 'private' && !hasFullAccess) {
        // En lugar de exponer 403 crudo o fallar la pantalla, retornamos el proyecto con restricted = true
        return {
          id_project: p.id_project,
          id_section_year: p.id_section_year,
          year: p.year,
          id_section: p.id_section,
          section_name: p.section_name,
          group_number: p.group_number,
          privacy: p.privacy,
          restricted: true,
          name: null,
          description: null,
          objective: null,
          problem: null,
          members: [],
        };
      }

      if (p.privacy === 'protected') {
        return {
          ...p,
          restricted: false,
          // miembros solo para autorizados
          members: hasFullAccess ? p.members : [],
        };
      }

      return { ...p, restricted: false };
    }

    return request<ProjectPublic>(`/projects/${id_project}`, { method: 'GET' });
  },

  async createProject(payload: ProjectCreate): Promise<ProjectPublic> {
    if (USE_MOCK) {
      await delay();
      const sy = mockDB.sectionYears.find((x) => x.id_section_year === payload.id_section_year);
      if (!sy) {
        const err: any = new Error('No existe el curso lectivo');
        err.status = 404;
        throw err;
      }

      const existingInSY = mockDB.projects.filter(
        (p) => p.id_section_year === payload.id_section_year
      );
      const maxNum = existingInSY.reduce((m, p) => Math.max(m, p.group_number), 0);
      const group_number = payload.group_number || maxNum + 1;

      const dup = existingInSY.find((p) => p.group_number === group_number);
      if (dup) {
        const err: any = new Error('Ya existe ese número de equipo en el curso lectivo');
        err.status = 409;
        throw err;
      }

      const min_members = payload.min_members || 3;
      const max_members = payload.max_members || 5;

      const newProj: ProjectPublic = {
        id_project: Date.now(),
        id_section_year: sy.id_section_year,
        year: sy.year,
        id_section: sy.id_section,
        section_name: sy.section_name,
        group_number,
        privacy: 'private',
        name: null,
        description: null,
        objective: null,
        problem: null,
        min_members,
        max_members,
        is_secured: false,
        members: [],
      };
      mockDB.projects.push(newProj);
      return newProj;
    }

    return request<ProjectPublic>('/projects', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async createProjectsBulk(payload: ProjectBulkCreate): Promise<ProjectPublic[]> {
    if (USE_MOCK) {
      await delay(250);
      const sy = mockDB.sectionYears.find((x) => x.id_section_year === payload.id_section_year);
      if (!sy) {
        const err: any = new Error('No existe el curso lectivo');
        err.status = 404;
        throw err;
      }
      if (payload.quantity < 1 || payload.quantity > 50) {
        const err: any = new Error('Ingrese un número entre 1 y 50');
        err.status = 422;
        throw err;
      }

      const min_members = payload.min_members || 3;
      const max_members = payload.max_members || 5;

      const existingInSY = mockDB.projects.filter(
        (p) => p.id_section_year === payload.id_section_year
      );
      const maxNum = existingInSY.reduce((m, p) => Math.max(m, p.group_number), 0);

      const created: ProjectPublic[] = [];
      for (let i = 1; i <= payload.quantity; i++) {
        const newProj: ProjectPublic = {
          id_project: Date.now() + i,
          id_section_year: sy.id_section_year,
          year: sy.year,
          id_section: sy.id_section,
          section_name: sy.section_name,
          group_number: maxNum + i,
          privacy: 'private',
          name: null,
          description: null,
          objective: null,
          problem: null,
          min_members,
          max_members,
          is_secured: false,
          members: [],
        };
        mockDB.projects.push(newProj);
        created.push(newProj);
      }
      return created;
    }

    return request<ProjectPublic[]>('/projects/bulk', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async deleteProject(id_project: number): Promise<void> {
    if (USE_MOCK) {
      await delay();
      const p = mockDB.projects.find((x) => x.id_project === id_project);
      if (!p) {
        const err: any = new Error('No se encontró el recurso');
        err.status = 404;
        throw err;
      }

      if (p.members && p.members.length > 0) {
        const err: any = new Error('No se puede eliminar un equipo con estudiantes');
        err.status = 409;
        throw err;
      }

      mockDB.projects = mockDB.projects.filter((x) => x.id_project !== id_project);
      return;
    }

    return request<void>(`/projects/${id_project}`, { method: 'DELETE' });
  },

  async joinProject(id_project: number): Promise<ProjectPublic> {
    if (USE_MOCK) {
      await delay(150);
      const targetProj = mockDB.projects.find((p) => p.id_project === id_project);
      if (!targetProj) {
        const err: any = new Error('No se encontró el equipo de trabajo');
        err.status = 404;
        throw err;
      }

      const maxLimit = targetProj.max_members || 5;
      if (targetProj.members && targetProj.members.length >= maxLimit) {
        const err: any = new Error(`El equipo ha alcanzado el cupo máximo de ${maxLimit} integrantes`);
        err.status = 400;
        throw err;
      }

      // Desvincular de cualquier otro equipo en el que esté actualmente
      mockDB.projects.forEach((p) => {
        if (p.members) {
          p.members = p.members.filter((m) => m.id_student !== mockDB.me.id_user);
          p.is_secured = p.members.length >= (p.min_members || 3);
        }
      });

      if (!targetProj.members) {
        targetProj.members = [];
      }

      targetProj.members.push({
        id_student: mockDB.me.id_user,
        legajo: mockDB.me.legajo,
        first_name: mockDB.me.first_name,
        last_name: mockDB.me.last_name,
      });

      targetProj.is_secured = targetProj.members.length >= (targetProj.min_members || 3);

      return { ...targetProj };
    }

    return request<ProjectPublic>(`/projects/${id_project}/join`, {
      method: 'POST',
    });
  },

  async leaveProject(id_project: number): Promise<ProjectPublic> {
    if (USE_MOCK) {
      await delay(150);
      const targetProj = mockDB.projects.find((p) => p.id_project === id_project);
      if (!targetProj) {
        const err: any = new Error('No se encontró el equipo de trabajo');
        err.status = 404;
        throw err;
      }

      if (targetProj.members) {
        targetProj.members = targetProj.members.filter(
          (m) => m.id_student !== mockDB.me.id_user
        );
      }

      targetProj.is_secured = (targetProj.members?.length || 0) >= (targetProj.min_members || 3);

      return { ...targetProj };
    }

    return request<ProjectPublic>(`/projects/${id_project}/leave`, {
      method: 'POST',
    });
  },
};
