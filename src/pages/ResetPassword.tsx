import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useToast } from '../components/ui/Toast';
import { SocratesLogo } from '../components/ui/SocratesLogo';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Eye, EyeOff, AlertCircle, ArrowLeft } from 'lucide-react';

const RESEND_WAIT_SECONDS = 60;

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
  // El backend ignora pedidos del mismo usuario con menos de 60 s de diferencia
  const [resendIn, setResendIn] = useState(0);
  const [requestedEmail, setRequestedEmail] = useState('');

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn(resendIn - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim()) {
      setErrorMessage('Ingrese su correo electrónico');
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

    // Mismo correo dentro de la espera: el backend no mandaría otro, sigue valiendo el anterior
    if (email.trim() === requestedEmail && resendIn > 0) {
      setStep(2);
      return;
    }

    setIsLoading(true);
    try {
      await api.requestPassword({ email: email.trim() });
      setRequestedEmail(email.trim());
      setResendIn(RESEND_WAIT_SECONDS);
      setStep(2);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al solicitar el código');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setErrorMessage(null);
    setIsLoading(true);
    try {
      await api.requestPassword({ email: email.trim() });
      setResendIn(RESEND_WAIT_SECONDS);
      setInfoMessage('Si el correo está registrado, le enviamos un código nuevo. El anterior deja de servir');
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al solicitar el código');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!/^\d{6}$/.test(code)) {
      setErrorMessage('El código tiene 6 dígitos');
      return;
    }

    setIsLoading(true);
    try {
      await api.confirmPassword({
        email: email.trim(),
        code,
        new_password: newPassword,
      });
      success('Contraseña guardada');
      navigate('/login');
    } catch (err: any) {
      if (err.status === 400) {
        setCode('');
        setInfoMessage(null);
        setErrorMessage(
          'El código es incorrecto, venció, ya se usó o se bloqueó por demasiados intentos. Revíselo o pida uno nuevo'
        );
      } else if (err.status === 422) {
        setStep(1);
        setErrorMessage('La contraseña debe tener al menos 8 caracteres');
      } else {
        setErrorMessage(err.message || 'Error al guardar la contraseña');
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
          <form onSubmit={handleStep1Submit} className="space-y-4" noValidate>
            <div>
              <Input
                label="Correo electrónico"
                type="email"
                placeholder="nombre@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>

            <div>
              <Input
                label="Nueva contraseña"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
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
                type={showRepeatPassword ? 'text' : 'password'}
                autoComplete="new-password"
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
          <form onSubmit={handleStep2Submit} className="space-y-5" noValidate>
            <p className="text-sm text-[#51607A]">
              Si <span className="font-medium text-[#0F1F3D] break-all">{email.trim()}</span> está
              registrado, le enviamos un código de 6 dígitos.
            </p>

            <div>
              <Input
                label="Código"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                maxLength={6}
                placeholder="Ingrese el código de 6 dígitos"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
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
              Guardar contraseña
            </Button>

            <div className="flex flex-col items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleResendCode}
                disabled={isLoading || resendIn > 0}
                className="text-sm font-medium text-[#1D4ED8] hover:underline cursor-pointer disabled:opacity-50"
              >
                {resendIn > 0 ? `Reenviar código en ${resendIn} s` : 'Reenviar código'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setCode('');
                  setInfoMessage(null);
                  setErrorMessage(null);
                }}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[#51607A] hover:text-[#0F1F3D] cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                Modificar correo o contraseña
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
