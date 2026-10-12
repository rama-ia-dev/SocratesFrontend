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
    superadmin: 'bg-[#EFF6FF] text-[#1D4ED8] border border-[#BAE6FD]',
    professor: 'bg-[#F1F5F9] text-[#0F1F3D] border border-[#CBD5E1]',
    student: 'bg-[#F8FAFC] text-[#51607A] border border-[#E2E8F0]',
    public: 'bg-[#DCFCE7] text-[#15803D] border border-[#86EFAC]',
    protected: 'bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A]',
    private: 'bg-[#FEE2E2] text-[#B91C1C] border border-[#FCA5A5]',
    neutral: 'bg-[#F1F5F9] text-[#51607A] border border-[#E2E8F0]',
  }[variant];

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium tracking-normal select-none ${variantStyles} ${className}`}
    >
      {children}
    </span>
  );
};
