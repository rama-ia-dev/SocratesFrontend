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
      <div className="min-w-0">
        {/* La serif del título es el toque académico; el resto de la interfaz va en Inter */}
        <h1 className="font-serif font-semibold text-[28px] leading-tight text-navy tracking-tight">
          {title}
        </h1>
        {subtitle && <p className="mt-1.5 text-sm text-ink-muted">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0 w-full sm:w-auto">{action}</div>}
    </div>
  );
};
