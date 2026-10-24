import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { USE_MOCK } from '../../lib/api';
import { SocratesLogo } from '../ui/SocratesLogo';
import { InitialsAvatar } from '../ui/Table';
import {
  Layers,
  Users,
  GraduationCap,
  User,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Shield,
  BarChart3,
} from 'lucide-react';

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
}

export const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout, switchMockRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Cerrar menú usuario al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cerrar los menús al navegar
  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsUserMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    setIsUserMenuOpen(false);
    await logout();
    navigate('/login');
  };

  // Ítems de navegación según el rol
  const getNavItems = (): NavItem[] => {
    if (!user) return [];

    if (user.is_super_admin) {
      return [
        { label: 'Comisiones', path: '/comisiones', icon: Layers },
        { label: 'Estado de la cátedra', path: '/catedra', icon: BarChart3 },
        { label: 'Usuarios', path: '/usuarios', icon: Users },
      ];
    }

    if (user.role === 'professor') {
      return [
        { label: 'Estudiantes', path: '/estudiantes', icon: GraduationCap },
      ];
    }

    // Alumno
    return [];
  };

  const navItems = getNavItems();

  const roleLabel = user?.is_super_admin
    ? 'Super administrador'
    : user?.role === 'professor'
    ? 'Docente'
    : 'Alumno';

  const fullName = user ? `${user.first_name} ${user.last_name}` : '';

  // La misma lista de secciones en el menú lateral y en el menú del celular
  const navList = (
    <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors duration-150 ${
                isActive
                  ? 'bg-white/12 text-white font-semibold'
                  : 'text-accent-light/85 hover:bg-white/6 hover:text-white font-medium'
              }`
            }
          >
            <Icon className="w-[18px] h-[18px] shrink-0" />
            <span>{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen flex bg-canvas text-ink">
      {/* ========================================================= */}
      {/* Menú lateral de escritorio: la identidad UTN (navy)       */}
      {/* ========================================================= */}
      <aside className="hidden md:flex flex-col w-60 bg-navy fixed inset-y-0 left-0 z-30 select-none">
        <div className="h-16 px-5 flex items-center">
          <NavLink to="/" className="flex items-center gap-3 rounded-lg">
            <SocratesLogo size="sm" showText={true} invertText={true} />
          </NavLink>
        </div>

        {navList}

        {/* Selector de rol para revisión rápida: solo con datos simulados */}
        {USE_MOCK && (
          <div className="px-4 py-3 border-t border-white/10">
            <div className="text-[11px] font-semibold text-accent-light uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Shield className="w-3 h-3 text-accent" />
              <span>Rol en vista</span>
            </div>
            <div className="grid grid-cols-3 gap-1 text-xs">
              {(
                [
                  ['superadmin', 'Admin', Boolean(user?.is_super_admin)],
                  ['professor', 'Docente', user?.role === 'professor' && !user.is_super_admin],
                  ['student', 'Alumno', user?.role === 'student'],
                ] as const
              ).map(([role, label, active]) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => switchMockRole(role)}
                  className={`py-1 px-1.5 rounded text-center transition-colors font-medium truncate ${
                    active ? 'bg-primary text-white' : 'bg-white/10 text-white/80 hover:bg-white/20 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </aside>

      {/* ========================================================= */}
      {/* Contenedor principal                                      */}
      {/* ========================================================= */}
      <div className="flex-1 min-w-0 md:pl-60 flex flex-col min-h-screen">
        {/* Barra superior clara: menú del celular y el usuario, que aparece solo acá */}
        <header className="h-16 bg-white/90 backdrop-blur-sm border-b border-line px-4 sm:px-8 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 -ml-2 rounded-lg text-ink-muted hover:bg-fill-neutral hover:text-ink transition-colors cursor-pointer"
              aria-label="Abrir menú de navegación"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="md:hidden">
              <SocratesLogo size="sm" showText={true} />
            </div>
          </div>

          <div className="relative" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-3 py-1.5 pl-2 pr-2 sm:pl-3 rounded-lg hover:bg-fill-neutral transition-colors cursor-pointer text-left"
              aria-expanded={isUserMenuOpen}
              aria-haspopup="menu"
              aria-label="Menú de usuario"
            >
              <span className="hidden sm:flex flex-col items-end leading-tight max-w-56">
                <span className="text-sm font-medium text-ink truncate max-w-full">{fullName}</span>
                <span className="text-xs text-ink-muted">{roleLabel}</span>
              </span>
              <InitialsAvatar name={fullName} size="md" colors="bg-navy text-white border-navy" />
              <ChevronDown
                className={`w-4 h-4 text-ink-muted transition-transform duration-150 ${isUserMenuOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {isUserMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-2 w-60 bg-white border border-line rounded-xl shadow-[0_8px_24px_-8px_rgba(15,31,61,0.18)] p-1.5 z-50"
              >
                {/* En celular el nombre no entra en la barra: se muestra acá */}
                <div className="sm:hidden px-3 py-2 border-b border-line mb-1">
                  <div className="text-sm font-medium text-ink truncate">{fullName}</div>
                  <div className="text-xs text-ink-muted">{roleLabel}</div>
                </div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => navigate('/perfil')}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-ink hover:bg-fill-neutral rounded-lg transition-colors cursor-pointer text-left"
                >
                  <User className="w-4 h-4 text-ink-muted" />
                  <span>Mi perfil</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-danger hover:bg-danger-soft rounded-lg transition-colors cursor-pointer text-left"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Cerrar sesión</span>
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Contenido principal de la página */}
        <main className="flex-1 px-4 py-6 sm:px-8 sm:py-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* ========================================================= */}
      {/* Menú del celular (panel lateral)                          */}
      {/* ========================================================= */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-navy-deep/40"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="relative flex flex-col w-72 max-w-[85vw] bg-navy shadow-2xl z-10">
            <div className="h-16 px-5 flex items-center justify-between">
              <SocratesLogo size="sm" showText={true} invertText={true} />
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1.5 rounded-lg text-accent-light hover:bg-white/10 hover:text-white cursor-pointer"
                aria-label="Cerrar menú de navegación"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {navList}
          </div>
        </div>
      )}
    </div>
  );
};
