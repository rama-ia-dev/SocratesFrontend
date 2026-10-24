import React from 'react';

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
    sm: { icon: 28, text: 'text-lg' },
    md: { icon: 36, text: 'text-xl' },
    lg: { icon: 48, text: 'text-2xl' },
    xl: { icon: 64, text: 'text-4xl' },
  };

  const dim = sizeMap[size];

  // En fondo oscuro, la figura arquitectónica usa trazos blancos y celestes brillantes
  // para que resalte con nitidez, elegancia y luminosidad en lugar de verse apagada u oscura.
  const primaryStroke = isDark ? 'stroke-white' : 'stroke-navy';
  const secondaryStroke = isDark ? 'stroke-accent-strong' : 'stroke-primary';
  const accentStroke = 'stroke-accent';

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* Emblema clásico arquitectónico Sócrates */}
      <div
        className={`flex items-center justify-center rounded-lg shadow-xs shrink-0 transition-colors ${
          isDark
            ? 'bg-navy-deep border border-white/15 text-white'
            : 'bg-white border border-line text-navy'
        }`}
        style={{ width: dim.icon + 12, height: dim.icon + 12 }}
      >
        <svg
          width={dim.icon}
          height={dim.icon}
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Frontispicio de templo y columna clásica griega */}
          <path
            d="M6 13L20 6L34 13"
            className={primaryStroke}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M8 15H32"
            className={secondaryStroke}
            strokeWidth="2"
            strokeLinecap="round"
          />
          {/* Fustes acanalados clásicos */}
          <path
            d="M12 17V30"
            className={primaryStroke}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M17.33 17V30"
            className={accentStroke}
            strokeWidth="1.75"
            strokeLinecap="round"
          />
          <path
            d="M22.67 17V30"
            className={accentStroke}
            strokeWidth="1.75"
            strokeLinecap="round"
          />
          <path
            d="M28 17V30"
            className={primaryStroke}
            strokeWidth="2"
            strokeLinecap="round"
          />
          {/* Estilóbato / Base */}
          <path
            d="M8 32H32"
            className={secondaryStroke}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M5 34H35"
            className={primaryStroke}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
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
