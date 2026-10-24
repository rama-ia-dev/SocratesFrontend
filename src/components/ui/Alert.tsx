import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';

type AlertTone = 'error' | 'warning' | 'success' | 'info';

const TONES: Record<AlertTone, { box: string; icon: React.ElementType }> = {
  error: { box: 'bg-danger-soft border-danger-line text-danger', icon: AlertCircle },
  warning: { box: 'bg-warning-soft border-warning-line text-warning', icon: AlertTriangle },
  success: { box: 'bg-success-soft border-success-line text-success', icon: CheckCircle2 },
  info: { box: 'bg-tint border-tint-strong text-navy', icon: Info },
};

/**
 * Aviso dentro de un formulario o una pantalla: el mismo estilo en toda la app. Los errores se
 * anuncian a los lectores de pantalla apenas aparecen.
 */
export const Alert: React.FC<{
  tone?: AlertTone;
  children: React.ReactNode;
  /** Acción a la derecha, por ejemplo un botón para limpiar o reintentar. */
  action?: React.ReactNode;
  className?: string;
}> = ({ tone = 'error', children, action, className = '' }) => {
  const { box, icon: Icon } = TONES[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm ${box} ${className}`}
    >
      <Icon className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
      <div className="flex-1 min-w-0">{children}</div>
      {action && <div className="shrink-0 -my-1">{action}</div>}
    </div>
  );
};
