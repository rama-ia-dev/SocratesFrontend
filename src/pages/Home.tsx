import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PageHeader } from '../components/ui/PageHeader';
import {
  Layers,
  UserCheck,
  GraduationCap,
  Users,
  FolderKanban,
  ArrowRight,
} from 'lucide-react';

export const Home: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const getAvailableModules = () => {
    if (!user) return [];

    if (user.is_super_admin) {
      return [
        {
          title: 'Comisiones',
          desc: 'Gestión de comisiones y cursos lectivos anuales con asignación docente.',
          path: '/comisiones',
          icon: Layers,
        },
        {
          title: 'Usuarios',
          desc: 'Gestión integral del padrón de docentes y estudiantes con filtros de rol, altas y modificaciones.',
          path: '/usuarios',
          icon: Users,
        },
        {
          title: 'Equipos de trabajo',
          desc: 'Seguimiento de proyectos por curso lectivo, comisiones y privacidad.',
          path: '/equipos',
          icon: FolderKanban,
        },
      ];
    }

    if (user.role === 'professor') {
      return [
        {
          title: 'Estudiantes',
          desc: 'Alta de alumnos de forma manual o mediante importación por lotes Excel.',
          path: '/estudiantes',
          icon: GraduationCap,
        },
        {
          title: 'Equipos de trabajo',
          desc: 'Creación de grupos de proyectos y seguimiento de propuestas académicas.',
          path: '/equipos',
          icon: FolderKanban,
        },
      ];
    }

    // Alumno
    return [
      {
        title: 'Equipos de trabajo',
        desc: 'Consulta de proyectos asignados, integrantes y problemática del seminario.',
        path: '/equipos',
        icon: FolderKanban,
      },
    ];
  };

  const modules = getAvailableModules();

  return (
    <div>
      <PageHeader
        title="Inicio"
        subtitle="Plataforma de gestión del Seminario Integrador"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {modules.map((mod) => {
          const Icon = mod.icon;
          return (
            <div
              key={mod.path}
              onClick={() => navigate(mod.path)}
              className="bg-white border border-[#D6E4F7] rounded-xl p-6 shadow-2xs hover:shadow-md hover:border-[#1D4ED8] transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="w-12 h-12 rounded-lg bg-[#EFF6FF] border border-[#BAE6FD] flex items-center justify-center text-[#1D4ED8] mb-4 group-hover:scale-105 transition-transform">
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="font-serif font-semibold text-lg text-[#0B2A66] mb-2 group-hover:text-[#1D4ED8] transition-colors">
                  {mod.title}
                </h3>
                <p className="text-sm text-[#51607A] leading-relaxed">
                  {mod.desc}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-[#D6E4F7]/60 flex items-center justify-between text-sm font-medium text-[#1D4ED8]">
                <span>Acceder al módulo</span>
                <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
