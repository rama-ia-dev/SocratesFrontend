import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { SocratesLogo } from '../components/ui/SocratesLogo';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import { validateEmail, STUDENT_EMAIL_HELP, STUDENT_EMAIL_PLACEHOLDER } from '../lib/validation';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Los dos campos se revisan a la vez y cada error va debajo de su campo. El recuadro de
    // arriba queda para lo que responde el backend.
    const emailProblem = validateEmail(email);
    const passwordProblem = password ? null : 'Ingrese su contraseña';
    setEmailError(emailProblem);
    setPasswordError(passwordProblem);
    if (emailProblem || passwordProblem) return;

    setIsLoading(true);
    try {
      await login(email.trim(), password);
      navigate('/');
    } catch (err: any) {
      if (err.status === 401 || err.message?.includes('incorrectos')) {
        setErrorMessage('Correo o contraseña incorrectos');
      } else {
        setErrorMessage(err.message || 'Error al iniciar sesión');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-canvas">
      {/* ========================================================= */}
      {/* Panel Izquierdo: Patrón de acanalado y baldosa con logo  */}
      {/* ========================================================= */}
      <div className="hidden md:flex flex-1 bg-tint fluted-column-pattern border-r border-line items-center justify-center p-12">
        <div className="bg-white border border-line rounded-xl p-8 shadow-sm max-w-sm w-full text-center flex flex-col items-center">
          <SocratesLogo size="xl" showText={true} />
          <div className="title-line mt-4 mb-4" />
          <p className="text-sm font-medium text-ink-muted">
            Seminario Integrador
          </p>
          <p className="text-xs text-ink-muted mt-1">
            Facultad Regional Córdoba
          </p>
        </div>
      </div>

      {/* ========================================================= */}
      {/* Panel Derecho: Tarjeta de 420px con formulario           */}
      {/* ========================================================= */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-[420px] bg-white border border-line rounded-xl shadow-md p-8 sm:p-10">
          {/* Logo en versión móvil */}
          <div className="md:hidden flex justify-center mb-6">
            <SocratesLogo size="md" showText={true} />
          </div>

          <h2 className="font-serif font-semibold text-2xl sm:text-3xl text-navy mb-1">
            Iniciar sesión
          </h2>
          <div className="title-line mb-6" />

          {errorMessage && (
            <div
              role="alert"
              className="mb-6 p-3 rounded-lg bg-danger-soft border border-danger-line text-danger text-sm flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div>
              <Input
                label="Correo electrónico"
                type="email"
                placeholder={STUDENT_EMAIL_PLACEHOLDER}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  // Ya marcado el error, se va apenas el correo queda bien escrito.
                  if (emailError) setEmailError(validateEmail(e.target.value));
                }}
                onBlur={() => {
                  if (email.trim()) setEmailError(validateEmail(email));
                }}
                error={emailError ?? undefined}
                helperText={STUDENT_EMAIL_HELP}
                disabled={isLoading}
                autoComplete="email"
                required
              />
            </div>

            <div>
              <Input
                label="Contraseña"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (e.target.value) setPasswordError(null);
                }}
                error={passwordError ?? undefined}
                disabled={isLoading}
                autoComplete="current-password"
                required
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-ink-muted hover:text-ink focus:outline-none cursor-pointer"
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

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-2"
              isLoading={isLoading}
            >
              Iniciar sesión
            </Button>

            <div className="text-center pt-2">
              <Link
                to="/password/reset"
                className="text-sm font-medium text-primary hover:text-primary-hover hover:underline"
              >
                Crear o restablecer contraseña
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
