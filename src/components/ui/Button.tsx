import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'destructive' | 'ghost';
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
      'inline-flex items-center justify-center font-medium transition-colors select-none rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BAE6FD] focus-visible:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none cursor-pointer';

    const sizeStyles = {
      sm: 'text-xs px-3 py-1.5 h-8 gap-1.5',
      md: 'text-sm px-4 py-2 h-10 gap-2',
      lg: 'text-base px-6 py-2.5 h-12 gap-2.5',
    }[size];

    const variantStyles = {
      primary:
        'bg-[#1D4ED8] hover:bg-[#1E40AF] text-white shadow-xs active:bg-[#1E40AF]',
      secondary:
        'bg-[#EFF6FF] hover:bg-[#E0F2FE] text-[#1D4ED8] border border-[#D6E4F7]',
      outline:
        'bg-white hover:bg-[#F5F9FF] text-[#0F1F3D] border border-[#D6E4F7] shadow-2xs',
      destructive:
        'bg-[#B91C1C] hover:bg-[#991B1B] text-white shadow-xs',
      ghost:
        'bg-transparent hover:bg-[#EFF6FF] text-[#51607A] hover:text-[#0F1F3D]',
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
