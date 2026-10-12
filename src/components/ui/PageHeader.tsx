import React from 'react';

interface PageHeaderProps {
  title: string;
  action?: React.ReactNode;
  subtitle?: string;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  action,
  subtitle,
  className = '',
}) => {
  return (
    <div className={`mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 ${className}`}>
      <div>
        <h1 className="font-serif font-semibold text-2xl sm:text-3xl text-[#0B2A66] tracking-tight">
          {title}
        </h1>
        <div className="title-line mt-2" />
        {subtitle && (
          <p className="mt-2 text-sm text-[#51607A]">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
};
