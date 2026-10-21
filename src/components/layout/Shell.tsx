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
  UserCheck,
  User,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Shield,
  BookOpen,
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

  // Cerrar menú móvil al navegar
  useEffect(() => {
    setIsMobileMenuOpen(false);
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

  return (
    <div className="min-h-screen flex bg-[#F5F9FF] text-[#0F1F3D]">
      {/* ========================================================= */}
      {/* Sidebar de escritorio (ancho 264px, azul institucional #0B2A66) */}
      {/* ========================================================= */}
      <aside className="hidden md:flex flex-col w-[264px] bg-[#0B2A66] border-r border-[#0B2A66] fixed inset-y-0 left-0 z-30 select-none shadow-[4px_0_18px_rgba(11,42,102,0.18)]">
        {/* Cabecera Sidebar: Logo Sócrates */}
        <div className="h-16 px-6 flex items-center border-b border-[#0B2A66] bg-[#0B2A66]">
          <NavLink to="/" className="flex items-center gap-3">
            <SocratesLogo size="sm" showText={true} invertText={true} />
          </NavLink>
        </div>

        {/* Lista de navegación */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto bg-[#0B2A66]">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm transition-all duration-150 ${
                    isActive
                      ? 'bg-white text-[#0B2A66] font-semibold shadow-md'
                      : 'text-[#BAE6FD] hover:bg-white/10 hover:text-white font-medium'
                  }`
                }
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Selector de rol para revisión rápida: solo con datos simulados */}
        {USE_MOCK && (
        <div className="px-4 py-2.5 border-t border-[#0B2A66] bg-[#0B2A66]">
          <div className="text-[11px] font-semibold text-[#BAE6FD] uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Shield className="w-3 h-3 text-[#7DD3FC]" />
            <span>Rol en vista</span>
          </div>
          <div className="grid grid-cols-3 gap-1 text-xs">
            <button
              type="button"
              onClick={() => switchMockRole('superadmin')}
              className={`py-1 px-1.5 rounded text-center transition-colors font-medium truncate ${
                user?.is_super_admin
                  ? 'bg-[#1D4ED8] text-white shadow-xs font-semibold'
                  : 'bg-white/10 text-white/80 border border-transparent hover:bg-white/20 hover:text-white'
              }`}
              title="Super administrador"
            >
              Admin
            </button>
            <button
              type="button"
              onClick={() => switchMockRole('professor')}
              className={`py-1 px-1.5 rounded text-center transition-colors font-medium truncate ${
                user?.role === 'professor' && !user.is_super_admin
                  ? 'bg-[#1D4ED8] text-white shadow-xs font-semibold'
                  : 'bg-white/10 text-white/80 border border-transparent hover:bg-white/20 hover:text-white'
              }`}
              title="Docente"
            >
              Docente
            </button>
            <button
              type="button"
              onClick={() => switchMockRole('student')}
              className={`py-1 px-1.5 rounded text-center transition-colors font-medium truncate ${
                user?.role === 'student'
                  ? 'bg-[#1D4ED8] text-white shadow-xs font-semibold'
                  : 'bg-white/10 text-white/80 border border-transparent hover:bg-white/20 hover:text-white'
              }`}
              title="Alumno"
            >
              Alumno
            </button>
          </div>
        </div>
        )}

        {/* Pie de Sidebar: Usuario y Menú */}
        <div className="p-3.5 border-t border-[#0B2A66] bg-[#0B2A66] relative" ref={userMenuRef}>
          <button
            type="button"
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/10 transition-colors text-left cursor-pointer"
            aria-expanded={isUserMenuOpen}
            aria-label="Menú de usuario"
          >
            <InitialsAvatar
              name={fullName}
              size="md"
              className="bg-white text-[#0B2A66] border-white font-bold ring-2 ring-white/50 shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white truncate">
                {fullName}
              </div>
              <div className="text-xs text-[#BAE6FD] truncate">
                {roleLabel}
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-[#BAE6FD] shrink-0" />
          </button>

          {/* Menú desplegable con "Mi perfil" y "Cerrar sesión" */}
          {isUserMenuOpen && (
            <div className="absolute bottom-20 left-4 right-4 bg-[#061A3D] border border-white/15 rounded-xl shadow-[0_12px_32px_rgba(6,26,61,0.6)] p-1.5 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150 backdrop-blur-md">
              <button
                type="button"
                onClick={() => {
                  setIsUserMenuOpen(false);
                  navigate('/perfil');
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-white hover:bg-white/12 rounded-lg transition-colors cursor-pointer text-left font-medium"
              >
                <User className="w-4 h-4 text-[#7DD3FC]" />
                <span>Mi perfil</span>
              </button>
              <div className="my-1 border-t border-white/10" />
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[#FCA5A5] hover:bg-[#DC2626]/20 hover:text-white rounded-lg transition-colors cursor-pointer text-left font-medium"
              >
                <LogOut className="w-4 h-4 text-[#F87171]" />
                <span>Cerrar sesión</span>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ========================================================= */}
      {/* Contenedor principal                                      */}
      {/* ========================================================= */}
      <div className="flex-1 min-w-0 md:pl-[264px] flex flex-col min-h-screen">
        {/* Barra superior de 64 px con el azul más oscuro #061A3D y borde literal del mismo color */}
        <header className="h-16 bg-[#061A3D] border-b border-[#061A3D] px-4 sm:px-8 flex items-center justify-between sticky top-0 z-20 shadow-[0_4px_18px_rgba(6,26,61,0.22)]">
          <div className="flex items-center gap-3">
            {/* Botón hamburguesa móvil */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-lg text-[#E0F2FE] hover:bg-white/15 hover:text-white transition-colors cursor-pointer border border-[#061A3D] shadow-2xs"
              aria-label="Abrir menú de navegación"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Logo sutil en vista móvil cuando no se ve el sidebar */}
            <div className="md:hidden flex items-center">
              <SocratesLogo size="sm" showText={true} invertText={true} />
            </div>
          </div>

          <div className="flex items-center">
            {/* Píldora interactiva del usuario con borde del mismo color/transparente */}
            <button
              type="button"
              onClick={() => navigate('/perfil')}
              className="flex items-center gap-3 py-1.5 pl-3.5 pr-1.5 rounded-full bg-white/10 hover:bg-white/18 border border-transparent shadow-xs transition-all cursor-pointer backdrop-blur-xs group focus:outline-none focus:ring-2 focus:ring-[#7DD3FC]"
              title="Ver mi perfil"
            >
              <span className="hidden sm:inline-block text-sm font-medium text-white group-hover:text-[#BAE6FD] transition-colors">
                {fullName}
              </span>
              <InitialsAvatar
                name={fullName}
                size="sm"
                className="bg-white text-[#061A3D] border-white font-bold ring-2 ring-white/50 group-hover:ring-white transition-all shadow-xs"
              />
            </button>
          </div>
        </header>

        {/* Contenido principal de la página */}
        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* ========================================================= */}
      {/* Menú móvil (Drawer lateral)                              */}
      {/* ========================================================= */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-[#061A3D]/40 backdrop-blur-xs"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-[#0B2A66] border-r border-[#0B2A66] shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            <div className="h-16 px-6 flex items-center justify-between border-b border-[#0B2A66] bg-[#0B2A66]">
              <SocratesLogo size="sm" showText={true} invertText={true} />
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1 rounded-lg text-[#BAE6FD] hover:bg-white/10 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto bg-[#0B2A66]">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm transition-colors ${
                        isActive
                          ? 'bg-white text-[#0B2A66] font-semibold shadow-md'
                          : 'text-[#BAE6FD] hover:bg-white/10 hover:text-white font-medium'
                      }`
                    }
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>

            <div className="p-4 border-t border-[#0B2A66] bg-[#0B2A66]">
              <div className="flex items-center gap-3 p-2">
                <InitialsAvatar
                  name={fullName}
                  size="md"
                  className="bg-white text-[#0B2A66] border-white font-bold ring-2 ring-white/50"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white truncate">
                    {fullName}
                  </div>
                  <div className="text-xs text-[#BAE6FD] truncate">
                    {roleLabel}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    navigate('/perfil');
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-white hover:bg-white/10 rounded-lg"
                >
                  <User className="w-4 h-4 text-[#7DD3FC]" />
                  <span>Mi perfil</span>
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-[#FCA5A5] hover:bg-[#B91C1C]/30 rounded-lg"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Cerrar sesión</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
