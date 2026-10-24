import React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'superadmin' | 'professor' | 'student' | 'public' | 'protected' | 'private' | 'neutral';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  className = '',
}) => {
  const variantStyles = {
    // Los roles se distinguen por tono, de más neutro (alumno) a más institucional (super admin)
    superadmin: 'bg-navy text-white border border-navy',
    professor: 'bg-tint text-primary border border-tint-strong',
    student: 'bg-fill-neutral text-ink-muted border border-line-neutral',
    public: 'bg-success-soft text-success border border-success-line',
    protected: 'bg-warning-soft text-warning border border-warning-line',
    private: 'bg-danger-soft text-danger border border-danger-line',
    neutral: 'bg-fill-neutral text-ink-muted border border-line-neutral',
  }[variant];

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium tracking-normal select-none ${variantStyles} ${className}`}
    >
      {children}
    </span>
  );
};
