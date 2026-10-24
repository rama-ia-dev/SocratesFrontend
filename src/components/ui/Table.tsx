import React from 'react';

export const Table: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => {
  return (
    <div className="w-full overflow-x-auto rounded-xl border border-line bg-white">
      <table className={`w-full text-left border-collapse text-sm text-ink ${className}`}>
        {children}
      </table>
    </div>
  );
};

export const TableHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <thead className="bg-canvas border-b border-line text-[13px] font-medium text-ink-muted select-none">
      {children}
    </thead>
  );
};

export const TableRow: React.FC<{
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}> = ({ children, className = '', onClick }) => {
  return (
    <tr
      onClick={onClick}
      className={`group h-[52px] border-b border-line last:border-b-0 hover:bg-canvas transition-colors duration-150 ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
    >
      {children}
    </tr>
  );
};

export const TableHead: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  return <th className={`px-4 h-10 font-medium ${className}`}>{children}</th>;
};

export const TableCell: React.FC<{
  children: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}> = ({ children, className = '', onClick }) => {
  return (
    <td onClick={onClick} className={`px-4 py-2.5 align-middle ${className}`}>
      {children}
    </td>
  );
};

export const InitialsAvatar: React.FC<{
  name: string;
  size?: 'sm' | 'md' | 'lg';
  // Reemplaza los colores por defecto; si se pasaran en className competirían con ellos.
  colors?: string;
  className?: string;
}> = ({ name, size = 'md', colors = 'bg-tint text-navy border-tint-strong', className = '' }) => {
  const parts = name.trim().split(/\s+/);
  const initials =
    parts.length > 1
      ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      : `${parts[0]?.[0] || '?'}`.toUpperCase();

  const sizeClass = {
    sm: 'w-7 h-7 text-[11px]',
    md: 'w-9 h-9 text-xs',
    lg: 'w-14 h-14 text-lg',
  }[size];

  return (
    <div
      className={`rounded-full font-semibold flex items-center justify-center shrink-0 border ${colors} ${sizeClass} ${className}`}
    >
      {initials}
    </div>
  );
};
