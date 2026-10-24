import React from 'react';
import { Check, X } from 'lucide-react';
import { PASSWORD_RULES } from '../lib/validation';

/** Requisitos de la contraseña, que se van marcando mientras se escribe. */
export const PasswordChecklist: React.FC<{ password: string }> = ({ password }) => (
  <ul className="mt-2 space-y-1 text-xs" aria-label="Requisitos de la contraseña">
    {PASSWORD_RULES.map((rule) => {
      const ok = rule.test(password);
      return (
        <li
          key={rule.label}
          className={`flex items-center gap-1.5 ${ok ? 'text-success font-semibold' : 'text-ink-muted'}`}
        >
          {ok ? (
            <span className="w-4 h-4 rounded-full bg-success-vivid text-white flex items-center justify-center shrink-0">
              <Check className="w-3 h-3" strokeWidth={3} />
            </span>
          ) : (
            <span className="w-4 h-4 rounded-full bg-line-neutral text-ink-muted flex items-center justify-center shrink-0">
              <X className="w-3 h-3" />
            </span>
          )}
          <span>{rule.label}</span>
          <span className="sr-only">{ok ? '(cumplido)' : '(falta)'}</span>
        </li>
      );
    })}
  </ul>
);
