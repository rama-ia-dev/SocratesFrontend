import React from 'react';

interface EmptyStateProps {
  message: string;
  /** Explica por qué no hay nada o qué se puede hacer. */
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  message,
  description,
  icon,
  action,
  className = '',
}) => {
  return (
    <div className={`rounded-xl border border-line bg-white px-6 py-12 text-center ${className}`}>
      <div className="max-w-md mx-auto flex flex-col items-center">
        {icon && (
          <div className="mb-4 w-11 h-11 rounded-full bg-fill-neutral text-ink-muted flex items-center justify-center">
            {icon}
          </div>
        )}
        <p className="text-[15px] font-semibold text-ink">{message}</p>
        {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
        {action && <div className="mt-5">{action}</div>}
      </div>
    </div>
  );
};

export const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({
  rows = 4,
  cols = 4,
}) => {
  return (
    <div className="w-full rounded-xl border border-line bg-white p-4 space-y-3">
      <div className="h-6 bg-tint rounded-md animate-pulse w-1/3 mb-4" />
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 items-center">
          {Array.from({ length: cols }).map((_, c) => (
            <div
              key={c}
              className="h-8 bg-fill-neutral rounded-md animate-pulse flex-1"
            />
          ))}
        </div>
      ))}
    </div>
  );
};
