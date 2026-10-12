import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/ui/Toast';
import { Shell } from './components/layout/Shell';

// Pantallas
import { Login } from './pages/Login';
import { ResetPassword } from './pages/ResetPassword';
import { Home } from './pages/Home';
import { Profile } from './pages/Profile';
import { Sections } from './pages/Sections';
import { Professors } from './pages/Professors';
import { Students } from './pages/Students';
import { RegisterStudents } from './pages/RegisterStudents';
import { Users } from './pages/Users';
import { Projects } from './pages/Projects';
import { ProjectDetail } from './pages/ProjectDetail';

// Guardia de autenticación y rol
const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  allowedRoles?: ('superadmin' | 'professor' | 'student')[];
}> = ({ children, allowedRoles }) => {
  const { user, isLoading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F9FF]">
        <div className="w-8 h-8 rounded-full border-2 border-[#1D4ED8] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Verificación de roles permitidos si se definieron
  if (allowedRoles) {
    const isSuperAdmin = Boolean(user.is_super_admin);
    const isProf = user.role === 'professor';
    const isStud = user.role === 'student';

    const hasAccess =
      (allowedRoles.includes('superadmin') && isSuperAdmin) ||
      (allowedRoles.includes('professor') && isProf) ||
      (allowedRoles.includes('student') && isStud);

    if (!hasAccess) {
      return <Navigate to="/" replace />;
    }
  }

  return <Shell>{children}</Shell>;
};

// Redirección para usuarios ya logueados que entran al login
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F9FF]">
        <div className="w-8 h-8 rounded-full border-2 border-[#1D4ED8] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            {/* P1: Iniciar sesión */}
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <Login />
                </PublicRoute>
              }
            />

            {/* P2: Crear o restablecer contraseña */}
            <Route
              path="/password/reset"
              element={
                <PublicRoute>
                  <ResetPassword />
                </PublicRoute>
              }
            />

            {/* P3: Armazón e Inicio */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Home />
                </ProtectedRoute>
              }
            />

            {/* P4: Mi perfil */}
            <Route
              path="/perfil"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />

            {/* P5: Comisiones y cursos lectivos (Solo super admin) */}
            <Route
              path="/comisiones"
              element={
                <ProtectedRoute allowedRoles={['superadmin']}>
                  <Sections />
                </ProtectedRoute>
              }
            />

            {/* P6: Docentes (Solo super admin) */}
            <Route
              path="/docentes"
              element={
                <ProtectedRoute allowedRoles={['superadmin']}>
                  <Professors />
                </ProtectedRoute>
              }
            />

            {/* P7: Estudiantes (Profesor y super admin) */}
            <Route
              path="/estudiantes"
              element={
                <ProtectedRoute allowedRoles={['superadmin', 'professor']}>
                  <Students />
                </ProtectedRoute>
              }
            />
            <Route
              path="/estudiantes/nuevo"
              element={
                <ProtectedRoute allowedRoles={['superadmin', 'professor']}>
                  <RegisterStudents />
                </ProtectedRoute>
              }
            />

            {/* P8: Usuarios (Solo super admin) */}
            <Route
              path="/usuarios"
              element={
                <ProtectedRoute allowedRoles={['superadmin']}>
                  <Users />
                </ProtectedRoute>
              }
            />

            {/* P9: Equipos de trabajo (Todos los roles) */}
            <Route
              path="/equipos"
              element={
                <ProtectedRoute>
                  <Projects />
                </ProtectedRoute>
              }
            />

            {/* P10: Detalle de un equipo de trabajo (Todos los roles) */}
            <Route
              path="/equipos/:id"
              element={
                <ProtectedRoute>
                  <ProjectDetail />
                </ProtectedRoute>
              }
            />

            {/* Redirección por defecto */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
