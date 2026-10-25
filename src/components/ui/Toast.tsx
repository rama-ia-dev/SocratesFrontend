import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      removeToast(id);
    }, 4500);
  }, [removeToast]);

  const value: ToastContextType = {
    toast: addToast,
    success: (msg) => addToast(msg, 'success'),
    error: (msg) => addToast(msg, 'error'),
    warning: (msg) => addToast(msg, 'warning'),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Avisos arriba a la derecha: tarjeta blanca y el color solo en el ícono */}
      <div className="fixed top-4 right-4 left-4 sm:left-auto z-[60] flex flex-col gap-2 sm:w-96 pointer-events-none">
        {toasts.map((item) => {
          const typeStyles = {
            success: 'text-success-vivid',
            error: 'text-danger',
            warning: 'text-warning-vivid',
            info: 'text-primary',
          }[item.type];

          const IconComponent = {
            success: CheckCircle2,
            error: AlertCircle,
            warning: AlertCircle,
            info: Info,
          }[item.type];

          return (
            <div
              key={item.id}
              role="alert"
              className="pointer-events-auto flex items-start gap-3 pl-4 pr-3 py-3 rounded-xl bg-white border border-line shadow-[0_12px_32px_-8px_rgba(6,26,61,0.25)] text-sm text-ink pop-in"
            >
              <IconComponent className={`w-5 h-5 shrink-0 ${typeStyles}`} aria-hidden="true" />
              <div className="flex-1 pt-px">{item.message}</div>
              <button
                type="button"
                onClick={() => removeToast(item.id)}
                className="shrink-0 rounded-md p-0.5 text-ink-muted hover:text-ink hover:bg-fill-neutral transition-colors cursor-pointer"
                aria-label="Cerrar notificación"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
