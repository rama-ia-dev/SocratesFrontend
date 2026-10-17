import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import {
  Layers,
  GraduationCap,
  Users,
  ChevronRight,
  BarChart3,
  Compass,
  FolderKanban,
} from 'lucide-react';

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Buenos días';
  if (hour < 20) return 'Buenas tardes';
  return 'Buenas noches';
};

export const Home: React.FC = () => {
  const { user } = useAuth();

  const getAvailableModules = () => {
    if (!user) return [];

    if (user.is_super_admin) {
      return [
        {
          title: 'Comisiones',
          desc: 'Comisiones y cursos lectivos de cada año, con sus docentes.',
          path: '/comisiones',
          icon: Layers,
        },
        {
          title: 'Estado de la cátedra',
          desc: 'Docentes, grupos por etapa y aprobados de cada curso lectivo.',
          path: '/catedra',
          icon: BarChart3,
        },
        {
          title: 'Usuarios',
          desc: 'Docentes, super administradores y estudiantes: altas y modificaciones.',
          path: '/usuarios',
          icon: Users,
        },
        {
          title: 'Equipos de trabajo',
          desc: 'Equipos de cada comisión y el proyecto de cada uno.',
          path: '/equipos',
          icon: FolderKanban,
        },
      ];
    }

    if (user.role === 'professor') {
      return [
        {
          title: 'Estudiantes',
          desc: 'Alumnos de sus cursos lectivos y el equipo de cada uno.',
          path: '/estudiantes',
          icon: GraduationCap,
        },
        {
          title: 'Equipos de trabajo',
          desc: 'Equipos de sus comisiones y el proyecto de cada uno.',
          path: '/equipos',
          icon: FolderKanban,
        },
      ];
    }

    // Alumno
    return [
      {
        title: 'Equipos de trabajo',
        desc: 'Equipos de trabajo de la cátedra y sus proyectos.',
        path: '/equipos',
        icon: FolderKanban,
      },
    ];
  };

  const modules = getAvailableModules();

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={user ? `${greeting()}, ${user.first_name}` : 'Inicio'}
        subtitle="Seminario Integrador · UTN Facultad Regional Córdoba"
      />

      {modules.length === 0 ? (
        <EmptyState
          icon={<Compass className="w-5 h-5" />}
          message="Todavía no hay secciones para su rol"
          description="Cuando estén disponibles las funciones para alumnos, van a aparecer acá."
        />
      ) : (
        <nav aria-label="Secciones" className="rounded-xl border border-line bg-white divide-y divide-line">
          {modules.map((mod) => {
            const Icon = mod.icon;
            return (
              <Link
                key={mod.path}
                to={mod.path}
                className="group flex items-center gap-4 px-5 py-4 first:rounded-t-xl last:rounded-b-xl hover:bg-canvas transition-colors duration-150"
              >
                <span className="w-10 h-10 rounded-lg bg-tint text-navy flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] font-semibold text-ink">{mod.title}</span>
                  <span className="block text-sm text-ink-muted">{mod.desc}</span>
                </span>
                <ChevronRight className="w-5 h-5 text-ink-faint shrink-0 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-ink-muted" />
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
};
