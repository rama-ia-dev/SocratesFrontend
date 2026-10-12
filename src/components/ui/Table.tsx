import React from 'react';

export const Table: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => {
  return (
    <div className="w-full overflow-x-auto rounded-xl border border-[#D6E4F7] bg-white shadow-2xs">
      <table className={`w-full text-left border-collapse text-sm text-[#0F1F3D] ${className}`}>
        {children}
      </table>
    </div>
  );
};

export const TableHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <thead className="bg-[#EFF6FF] border-b border-[#D6E4F7] text-[12px] font-semibold text-[#51607A] uppercase tracking-wider select-none">
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
      className={`h-14 border-b border-[#D6E4F7] last:border-b-0 hover:bg-[#E0F2FE]/40 transition-colors ${
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
  return <th className={`px-4 py-3 font-semibold text-[12px] ${className}`}>{children}</th>;
};

export const TableCell: React.FC<{
  children: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}> = ({ children, className = '', onClick }) => {
  return (
    <td onClick={onClick} className={`px-4 py-3.5 align-middle ${className}`}>
      {children}
    </td>
  );
};

export const InitialsAvatar: React.FC<{
  name: string;
  size?: 'sm' | 'md';
  className?: string;
}> = ({ name, size = 'md', className = '' }) => {
  const parts = name.trim().split(/\s+/);
  const initials =
    parts.length > 1
      ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      : `${parts[0]?.[0] || '?'}`.toUpperCase();

  const sizeClass = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-xs';

  return (
    <div
      className={`rounded-full bg-[#E0F2FE] text-[#1D4ED8] font-semibold flex items-center justify-center shrink-0 border border-[#BAE6FD] ${sizeClass} ${className}`}
    >
      {initials}
    </div>
  );
};
