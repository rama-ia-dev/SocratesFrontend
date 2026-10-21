import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useToast } from '../components/ui/Toast';
import { SocratesLogo } from '../components/ui/SocratesLogo';
import { ArrowLeft } from 'lucide-react';
import { PasswordCodeForm } from '../components/PasswordCodeForm';

export const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const { success } = useToast();

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#F5F9FF]">
      <div className="w-full max-w-[420px] bg-white border border-[#D6E4F7] rounded-xl shadow-md p-8 sm:p-10">
        <div className="flex justify-center mb-6">
          <SocratesLogo size="md" showText={true} />
        </div>

        <h2 className="font-serif font-semibold text-2xl text-[#0B2A66] mb-1">
          Crear o restablecer contraseña
        </h2>
        <div className="title-line mb-4" />

        <PasswordCodeForm
          onSaved={() => {
            success('Contraseña guardada');
            navigate('/login');
          }}
          footer={
            <div className="text-center pt-2">
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[#51607A] hover:text-[#0F1F3D]"
              >
                <ArrowLeft className="w-4 h-4" />
                Volver al inicio de sesión
              </Link>
            </div>
          }
        />
      </div>
    </div>
  );
};
