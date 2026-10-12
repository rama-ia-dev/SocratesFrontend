import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useToast } from '../components/ui/Toast';
import { SocratesLogo } from '../components/ui/SocratesLogo';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Eye, EyeOff, AlertCircle, ArrowLeft } from 'lucide-react';

export const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const { success } = useToast();

  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showRepeatPassword, setShowRepeatPassword] = useState(false);

  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim()) {
      setErrorMessage('Ingrese su correo electrónico');
      return;
    }

    setIsLoading(true);
    try {
      await api.requestPassword({ email: email.trim() });
      setInfoMessage('Si el correo está registrado, recibirá un código');
      setStep(2);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al solicitar el código');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!code.trim()) {
      setErrorMessage('El código es inválido o ya fue usado');
      return;
    }

    if (newPassword.length < 8) {
      setErrorMessage('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    if (newPassword !== repeatPassword) {
      setErrorMessage('Las contraseñas no coinciden');
      return;
    }

    setIsLoading(true);
    try {
      await api.confirmPassword({
        email: email.trim(),
        code: code.trim(),
        new_password: newPassword,
      });
      success('Contraseña guardada');
      navigate('/login');
    } catch (err: any) {
      if (err.status === 400 || err.message?.includes('código')) {
        setErrorMessage('El código es inválido o ya fue usado');
      } else if (err.status === 429 || err.message?.includes('Demasiados')) {
        setErrorMessage('Demasiados intentos. Solicite un código nuevo');
      } else if (err.status === 422 || err.message?.includes('8 caracteres')) {
        setErrorMessage('La contraseña debe tener al menos 8 caracteres');
      } else {
        setErrorMessage(err.message || 'Error al actualizar contraseña');
      }
    } finally {
      setIsLoading(false);
    }
  };

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

        {/* Indicador simple de pasos */}
        <div className="flex items-center gap-2 mb-6">
          <div
            className={`flex-1 h-1.5 rounded-full transition-colors ${
              step >= 1 ? 'bg-[#1D4ED8]' : 'bg-[#D6E4F7]'
            }`}
          />
          <div
            className={`flex-1 h-1.5 rounded-full transition-colors ${
              step >= 2 ? 'bg-[#1D4ED8]' : 'bg-[#D6E4F7]'
            }`}
          />
        </div>

        {infoMessage && (
          <div className="mb-6 p-3 rounded-lg bg-[#EFF6FF] border border-[#BAE6FD] text-[#1D4ED8] text-sm">
            {infoMessage}
          </div>
        )}

        {errorMessage && (
          <div
            role="alert"
            className="mb-6 p-3 rounded-lg bg-[#FEE2E2] border border-[#FCA5A5] text-[#B91C1C] text-sm flex items-start gap-2.5"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleStep1Submit} className="space-y-5" noValidate>
            <div>
              <Input
                label="Correo electrónico"
                requiredAsterisk
                type="email"
                placeholder="nombre@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-2"
              isLoading={isLoading}
            >
              Enviar código
            </Button>

            <div className="text-center pt-2">
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[#51607A] hover:text-[#0F1F3D]"
              >
                <ArrowLeft className="w-4 h-4" />
                Volver al inicio de sesión
              </Link>
            </div>
          </form>
        ) : (
          <form onSubmit={handleStep2Submit} className="space-y-4" noValidate>
            <div>
              <Input
                label="Código"
                requiredAsterisk
                type="text"
                placeholder="Ingrese el código de 6 dígitos"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>

            <div>
              <Input
                label="Nueva contraseña"
                requiredAsterisk
                type={showPassword ? 'text' : 'password'}
                placeholder="Mínimo 8 caracteres"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={isLoading}
                required
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[#51607A] hover:text-[#0F1F3D] focus:outline-none cursor-pointer"
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                }
              />
            </div>

            <div>
              <Input
                label="Repetir contraseña"
                requiredAsterisk
                type={showRepeatPassword ? 'text' : 'password'}
                placeholder="Repita la nueva contraseña"
                value={repeatPassword}
                onChange={(e) => setRepeatPassword(e.target.value)}
                disabled={isLoading}
                required
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowRepeatPassword(!showRepeatPassword)}
                    className="text-[#51607A] hover:text-[#0F1F3D] focus:outline-none cursor-pointer"
                    aria-label={showRepeatPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  >
                    {showRepeatPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                }
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-2"
              isLoading={isLoading}
            >
              Guardar contraseña
            </Button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setErrorMessage(null);
                }}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[#51607A] hover:text-[#0F1F3D] cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                Modificar correo electrónico
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
