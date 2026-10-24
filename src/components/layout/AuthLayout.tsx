import React from 'react';
import logo from '../../assets/socrates-logo.png';
import { SocratesLogo } from '../ui/SocratesLogo';

/**
 * Pantallas sin sesión (login y contraseña): a la izquierda la identidad, con el degradado de la
 * UTN y el logo completo sobre su fondo blanco; a la derecha el formulario. En celular el panel
 * se reduce a una franja con el isotipo.
 */
export const AuthLayout: React.FC<{ title: string; subtitle?: string; children: React.ReactNode }> = ({
  title,
  subtitle,
  children,
}) => (
  <div className="min-h-screen flex flex-col md:flex-row bg-white">
    {/* Panel institucional (escritorio) */}
    <aside className="auth-utn hidden md:flex md:w-[44%] lg:w-[48%] relative overflow-hidden flex-col justify-between p-10 lg:p-14 text-white">
      <div className="relative z-10 text-sm font-medium text-accent-light/90 tracking-wide">
        UTN · Facultad Regional Córdoba
      </div>

      <div className="relative z-10 flex flex-col items-start gap-8">
        <div className="bg-white rounded-2xl p-5 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.5)]">
          <img src={logo} alt="Sócrates, gestor de proyectos" className="w-56 lg:w-64 h-auto" draggable={false} />
        </div>
        <p className="max-w-sm font-serif text-2xl lg:text-[28px] leading-snug text-white">
          Los proyectos de la cátedra, de la propuesta a la aprobación.
        </p>
      </div>

      <div className="relative z-10 text-sm text-accent-light/80">Seminario Integrador</div>
    </aside>

    {/* Franja institucional (celular) */}
    <div className="auth-utn md:hidden px-5 py-5 flex items-center justify-between">
      <SocratesLogo size="sm" invertText />
      <span className="text-xs font-medium text-accent-light/90">UTN · FRC</span>
    </div>

    {/* Formulario */}
    {/* En celular el formulario arranca arriba; en escritorio, centrado */}
    <main className="flex-1 flex items-start md:items-center justify-center px-5 pt-8 pb-10 sm:px-12 md:py-10">
      <div className="w-full max-w-[400px]">
        <h1 className="font-serif font-semibold text-[28px] leading-tight text-navy">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-ink-muted">{subtitle}</p>}
        <div className="mt-8">{children}</div>
      </div>
    </main>
  </div>
);
