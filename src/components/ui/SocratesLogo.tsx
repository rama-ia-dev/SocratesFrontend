import React from 'react';
import isotipo from '../../assets/socrates-isotipo.svg';

interface SocratesLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  /** Texto en blanco, para fondos azules. El isotipo es el mismo en cualquier fondo. */
  invertText?: boolean;
}

const SIZES = {
  sm: { icon: 40, text: 'text-lg' },
  md: { icon: 48, text: 'text-xl' },
  lg: { icon: 60, text: 'text-2xl' },
  xl: { icon: 80, text: 'text-3xl' },
};

/** Isotipo y nombre en una línea: menú lateral y barra del celular. */
export const SocratesLogo: React.FC<SocratesLogoProps> = ({
  className = '',
  size = 'md',
  showText = true,
  invertText = false,
}) => {
  const dim = SIZES[size];

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      <img
        src={isotipo}
        alt={showText ? '' : 'Sócrates'}
        width={dim.icon}
        height={dim.icon}
        className="shrink-0"
        draggable={false}
      />

      {showText && (
        <span
          className={`font-serif font-bold tracking-[0.02em] leading-none ${dim.text} ${
            invertText ? 'text-white' : 'text-navy'
          }`}
        >
          {/* Como en el logo completo: en mayúsculas y con tilde */}
          SÓCRATES
        </span>
      )}
    </div>
  );
};

/** Logo completo: isotipo, nombre y "Gestor de proyectos", apilados. */
export const SocratesLockup: React.FC<{
  className?: string;
  invert?: boolean;
  iconSize?: number;
  /** Entrada animada: la columna aparece y las letras del nombre suben una por una. */
  animated?: boolean;
  hideIcon?: boolean;
}> = ({ className = '', invert = false, iconSize = 160, animated = false, hideIcon = false }) => (
  <div className={`flex flex-col items-center select-none ${className}`} role="img" aria-label="Sócrates, gestor de proyectos">
    {!hideIcon && (
      <img
        src={isotipo}
        alt=""
        width={iconSize}
        height={iconSize}
        draggable={false}
        className={animated ? 'enter-pop' : ''}
      />
    )}
    <span
      className={`mt-3 font-serif font-bold leading-none tracking-[0.01em] ${invert ? 'text-white' : 'text-navy'}`}
      style={{ fontSize: iconSize * 0.3 }}
    >
      {animated
        ? [...'SÓCRATES'].map((ch, i) => (
            <span key={i} className="letter-in" style={{ animationDelay: `${250 + i * 55}ms` }}>
              {ch}
            </span>
          ))
        : 'SÓCRATES'}
    </span>
    <span
      className={`mt-2 font-semibold leading-none tracking-[0.14em] ${invert ? 'text-accent' : 'text-primary'} ${
        animated ? 'enter-up' : ''
      }`}
      style={{ fontSize: iconSize * 0.088, animationDelay: animated ? '800ms' : undefined }}
    >
      GESTOR DE PROYECTOS
    </span>
  </div>
);
