import React from 'react';

interface EmptyStateProps {
  message: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  message,
  icon,
  action,
  className = '',
}) => {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-[#D6E4F7] bg-white p-8 text-center fluted-column-pattern ${className}`}
    >
      <div className="relative z-10 max-w-sm mx-auto flex flex-col items-center justify-center">
        {icon && <div className="text-[#1D4ED8] mb-2">{icon}</div>}
        <p className="text-sm font-medium text-[#51607A]">{message}</p>
        {action && <div className="mt-4">{action}</div>}
      </div>
    </div>
  );
};

export const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({
  rows = 4,
  cols = 4,
}) => {
  return (
    <div className="w-full rounded-xl border border-[#D6E4F7] bg-white p-4 space-y-3">
      <div className="h-6 bg-[#EFF6FF] rounded-md animate-pulse w-1/3 mb-4" />
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 items-center">
          {Array.from({ length: cols }).map((_, c) => (
            <div
              key={c}
              className="h-8 bg-[#F1F5F9] rounded-md animate-pulse flex-1"
            />
          ))}
        </div>
      ))}
    </div>
  );
};
