import React from 'react';
import { Button } from './Button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  total: number;
  limit: number;
  offset: number;
  onChangeOffset: (newOffset: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
  total,
  limit,
  offset,
  onChangeOffset,
}) => {
  if (total <= 0) return null;

  const start = offset + 1;
  const end = Math.min(offset + limit, total);
  const hasPrev = offset > 0;
  const hasNext = offset + limit < total;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-3 px-1 text-sm text-[#51607A]">
      <div>
        Mostrando <span className="font-medium text-[#0F1F3D]">{start}</span> a{' '}
        <span className="font-medium text-[#0F1F3D]">{end}</span> de{' '}
        <span className="font-medium text-[#0F1F3D]">{total}</span> registros
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={!hasPrev}
          onClick={() => onChangeOffset(Math.max(0, offset - limit))}
          aria-label="Página anterior"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Anterior
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!hasNext}
          onClick={() => onChangeOffset(offset + limit)}
          aria-label="Página siguiente"
        >
          Siguiente
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
};
