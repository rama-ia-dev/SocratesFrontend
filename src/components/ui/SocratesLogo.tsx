import React from 'react';
import isotipo from '../../assets/socrates-isotipo.png';

interface SocratesLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  invertText?: boolean;
  darkBg?: boolean;
}

export const SocratesLogo: React.FC<SocratesLogoProps> = ({
  className = '',
  size = 'md',
  showText = true,
  invertText = false,
  darkBg,
}) => {
  const isDark = darkBg !== undefined ? darkBg : invertText;

  const sizeMap = {
    sm: { tile: 36, text: 'text-lg' },
    md: { tile: 44, text: 'text-xl' },
    lg: { tile: 56, text: 'text-2xl' },
    xl: { tile: 72, text: 'text-4xl' },
  };

  const dim = sizeMap[size];

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* El isotipo original tiene fondo blanco: va siempre sobre su recuadro blanco */}
      <div
        className={`flex items-center justify-center rounded-lg bg-white shrink-0 overflow-hidden ${
          isDark ? 'ring-1 ring-white/20' : 'border border-line'
        }`}
        style={{ width: dim.tile, height: dim.tile }}
      >
        <img
          src={isotipo}
          alt={showText ? '' : 'Sócrates'}
          width={dim.tile}
          height={dim.tile}
          className="w-full h-full object-contain"
          draggable={false}
        />
      </div>

      {showText && (
        <span
          className={`font-serif font-semibold tracking-tight ${dim.text} ${
            invertText ? 'text-white' : 'text-navy'
          }`}
        >
          Sócrates
        </span>
      )}
    </div>
  );
};
