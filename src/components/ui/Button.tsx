import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'destructive' | 'ghost' | 'ghostDanger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      className = '',
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium whitespace-nowrap transition-colors duration-150 select-none rounded-lg disabled:opacity-50 disabled:pointer-events-none cursor-pointer';

    const sizeStyles = {
      sm: 'text-[13px] px-3 h-8 gap-1.5',
      md: 'text-sm px-4 h-10 gap-2',
      lg: 'text-[15px] px-5 h-11 gap-2',
    }[size];

    // El relleno lleno se reserva para la acción principal y para borrar; el resto va con borde
    const variantStyles = {
      primary:
        'bg-primary hover:bg-primary-hover active:bg-primary-hover text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_1px_2px_rgba(15,31,61,0.12)]',
      secondary:
        'bg-tint hover:bg-tint-strong text-primary border border-tint-strong',
      outline:
        'bg-white hover:bg-canvas active:bg-fill-neutral text-ink border border-line hover:border-line-neutral-strong shadow-[0_1px_2px_rgba(15,31,61,0.04)]',
      destructive:
        'bg-danger hover:bg-danger-hover text-white shadow-[0_1px_2px_rgba(15,31,61,0.12)]',
      ghost:
        'bg-transparent hover:bg-fill-neutral text-ink-muted hover:text-ink',
      ghostDanger:
        'bg-transparent hover:bg-danger-soft text-danger hover:text-ink',
    }[variant];

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${sizeStyles} ${variantStyles} ${className}`}
        {...props}
      >
        {isLoading && <Loader2 className="w-4 h-4 animate-spin text-current" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
