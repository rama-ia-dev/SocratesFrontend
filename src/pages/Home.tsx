import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PageHeader } from '../components/ui/PageHeader';
import {
  Layers,
  UserCheck,
  GraduationCap,
  Users,
  ArrowRight,
  BarChart3,
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
          title: 'Estado de la cátedra',
          desc: 'Panorama de los cursos lectivos: docentes, grupos por etapa y aprobados.',
          path: '/catedra',
          icon: BarChart3,
        },
        {
          title: 'Usuarios',
          desc: 'Gestión integral del padrón de docentes y estudiantes con filtros de rol, altas y modificaciones.',
          path: '/usuarios',
          icon: Users,
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
      ];
    }

    // Alumno
    return [];
  };

  const modules = getAvailableModules();

  return (
    <div>
      <PageHeader
        title="Inicio"
        subtitle="Plataforma de gestión del Seminario Integrador"
      />

      {modules.length === 0 && (
        <p className="text-sm text-ink-muted">Todavía no hay módulos disponibles para su rol.</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {modules.map((mod) => {
          const Icon = mod.icon;
          return (
            <div
              key={mod.path}
              onClick={() => navigate(mod.path)}
              className="bg-white border border-line rounded-xl p-6 shadow-2xs hover:shadow-md hover:border-primary transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="w-12 h-12 rounded-lg bg-tint border border-accent-light flex items-center justify-center text-primary mb-4 group-hover:scale-105 transition-transform">
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="font-serif font-semibold text-lg text-navy mb-2 group-hover:text-primary transition-colors">
                  {mod.title}
                </h3>
                <p className="text-sm text-ink-muted leading-relaxed">
                  {mod.desc}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-line/60 flex items-center justify-between text-sm font-medium text-primary">
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
