import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useToast } from '../components/ui/Toast';
import { AuthLayout } from '../components/layout/AuthLayout';
import { ArrowLeft } from 'lucide-react';
import { PasswordCodeForm } from '../components/PasswordCodeForm';

export const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const { success } = useToast();

  return (
    <AuthLayout
      title="Crear o restablecer contraseña"
      subtitle="Le enviamos un código al correo para confirmar que es suyo."
    >
      <PasswordCodeForm
        onSaved={() => {
          success('Contraseña guardada');
          navigate('/login');
        }}
        footer={
          <div className="text-center pt-2">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver al inicio de sesión
            </Link>
          </div>
        }
      />
    </AuthLayout>
  );
};
