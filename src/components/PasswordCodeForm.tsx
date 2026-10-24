import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Eye, EyeOff, AlertCircle, ArrowLeft } from 'lucide-react';
import { PasswordChecklist } from './PasswordChecklist';
import {
  isStrongPassword,
  PASSWORD_MAX_LENGTH,
  STUDENT_EMAIL_HELP,
  STUDENT_EMAIL_PLACEHOLDER,
} from '../lib/validation';

const RESEND_WAIT_SECONDS = 60;

interface PasswordCodeFormProps {
  /** Correo de la sesión iniciada: no se pide y el código va a ese correo. */
  fixedEmail?: string;
  /** Se llama con la contraseña ya guardada; el backend cerró todas las sesiones del usuario. */
  onSaved: () => void | Promise<void>;
  /** Contenido al pie del primer paso (por ejemplo, volver al inicio de sesión). */
  footer?: React.ReactNode;
}

/**
 * Fija la contraseña en dos pasos: la nueva contraseña y el pedido del código al correo, y después
 * el código. Sirve para crearla, recuperarla o cambiarla con la sesión iniciada.
 */
export const PasswordCodeForm: React.FC<PasswordCodeFormProps> = ({ fixedEmail, onSaved, footer }) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState(fixedEmail ?? '');
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

    if (!isStrongPassword(newPassword)) {
      setErrorMessage('La contraseña no cumple todos los requisitos');
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
      setInfoMessage(
        fixedEmail
          ? 'Le enviamos un código nuevo. El anterior deja de servir'
          : 'Si el correo está registrado, le enviamos un código nuevo. El anterior deja de servir'
      );
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
      await onSaved();
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
    <>
      {/* Indicador simple de pasos */}
      <div className="flex items-center gap-2 mb-6">
        <div
          className={`flex-1 h-1.5 rounded-full transition-colors ${
            step >= 1 ? 'bg-primary' : 'bg-line'
          }`}
        />
        <div
          className={`flex-1 h-1.5 rounded-full transition-colors ${
            step >= 2 ? 'bg-primary' : 'bg-line'
          }`}
        />
      </div>

      {infoMessage && (
        <div className="mb-6 p-3 rounded-lg bg-tint border border-accent-light text-primary text-sm">
          {infoMessage}
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          className="mb-6 p-3 rounded-lg bg-danger-soft border border-danger-line text-danger text-sm flex items-start gap-2.5"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {step === 1 ? (
        <form onSubmit={handleStep1Submit} className="space-y-4" noValidate>
          {fixedEmail ? (
            <p className="text-sm text-ink-muted">
              Para confirmar el cambio le vamos a enviar un código de 6 dígitos a{' '}
              <span className="font-medium text-ink break-all">{fixedEmail}</span>.
            </p>
          ) : (
            <div>
              <Input
                label="Correo electrónico"
                type="email"
                placeholder={STUDENT_EMAIL_PLACEHOLDER}
                helperText={STUDENT_EMAIL_HELP}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>
          )}

          <div>
            <Input
              label="Nueva contraseña"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              maxLength={PASSWORD_MAX_LENGTH}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={isLoading}
              required
              rightIcon={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-ink-muted hover:text-ink focus:outline-none cursor-pointer"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              }
            />
            <PasswordChecklist password={newPassword} />
          </div>

          <div>
            <Input
              label="Repetir contraseña"
              type={showRepeatPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Repita la nueva contraseña"
              maxLength={PASSWORD_MAX_LENGTH}
              value={repeatPassword}
              onChange={(e) => setRepeatPassword(e.target.value)}
              disabled={isLoading}
              required
              rightIcon={
                <button
                  type="button"
                  onClick={() => setShowRepeatPassword(!showRepeatPassword)}
                  className="text-ink-muted hover:text-ink focus:outline-none cursor-pointer"
                  aria-label={showRepeatPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                >
                  {showRepeatPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              }
            />
          </div>

          <Button type="submit" variant="primary" size="lg" className="w-full mt-2" isLoading={isLoading}>
            Enviar código
          </Button>

          {footer}
        </form>
      ) : (
        <form onSubmit={handleStep2Submit} className="space-y-5" noValidate>
          <p className="text-sm text-ink-muted">
            {fixedEmail ? 'Le enviamos un código de 6 dígitos a ' : 'Si '}
            <span className="font-medium text-ink break-all">{email.trim()}</span>
            {fixedEmail ? '.' : ' está registrado, le enviamos un código de 6 dígitos.'}
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

          <Button type="submit" variant="primary" size="lg" className="w-full mt-2" isLoading={isLoading}>
            Guardar contraseña
          </Button>

          <div className="flex flex-col items-center gap-2 pt-2">
            <button
              type="button"
              onClick={handleResendCode}
              disabled={isLoading || resendIn > 0}
              className="text-sm font-medium text-primary hover:underline cursor-pointer disabled:opacity-50"
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
              className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              {fixedEmail ? 'Modificar contraseña' : 'Modificar correo o contraseña'}
            </button>
          </div>
        </form>
      )}
    </>
  );
};
