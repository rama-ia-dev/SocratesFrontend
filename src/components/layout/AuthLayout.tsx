import React, { useEffect, useRef } from 'react';
import { SocratesLockup } from '../ui/SocratesLogo';
import { IsometricField } from '../auth/IsometricField';
import isotipo from '../../assets/socrates-isotipo.svg';

type Props = { title: string; subtitle?: string; children: React.ReactNode };

/** Título, subtítulo y formulario; entran uno detrás del otro después del logo. */
const Form: React.FC<Props> = ({ title, subtitle, children }) => {
  const delay = (ms: number) => ({ animationDelay: `${600 + ms}ms` });
  return (
    <>
      <h1 className="enter-up font-serif font-semibold text-[26px] leading-tight text-navy" style={delay(0)}>
        {title}
      </h1>
      {subtitle && (
        <p className="enter-up mt-1.5 text-sm text-ink-muted" style={delay(80)}>
          {subtitle}
        </p>
      )}
      <div className="enter-up mt-7" style={delay(160)}>
        {children}
      </div>
    </>
  );
};

/** Tarjeta del formulario: su borde se ilumina del lado donde está el puntero. */
const SpotCard: React.FC<{ className?: string; children: React.ReactNode }> = ({ className = '', children }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);
  return (
    <div
      ref={ref}
      className={`spot-card bg-white rounded-2xl shadow-[0_30px_80px_-24px_rgba(2,8,30,0.7)] ${className}`}
    >
      {children}
    </div>
  );
};

/**
 * La columna del logo en grande: se inclina en 3D siguiendo al puntero y, si el puntero está
 * quieto o no hay (celular), gira y flota sola, despacio, sobre su sombra.
 */
const TiltColumn: React.FC<{ className?: string }> = ({ className = '' }) => {
  const ref = useRef<HTMLDivElement>(null);
  const shadow = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    let last = performance.now();
    const cur = { x: 0, y: 0 };
    const tgt = { x: 0, y: 0 };
    let moved = 0;
    const tick = (now: number) => {
      // Suavizado por tiempo, no por cuadro: igual de rápido en pantallas de cualquier frecuencia
      const k = 1 - Math.exp(-(now - last) / 140);
      last = now;
      const idle = Math.min(1, Math.max(0, (now - moved - 1500) / 1500));
      const ix = Math.sin(now / 2600) * 0.35;
      const iy = Math.sin(now / 3400) * 0.2;
      cur.x += (tgt.x * (1 - idle) + ix * idle - cur.x) * k;
      cur.y += (tgt.y * (1 - idle) + iy * idle - cur.y) * k;
      const lift = Math.sin(now / 1800) * 6;
      if (ref.current)
        ref.current.style.transform = `translateY(${lift}px) rotateX(${cur.y * -18}deg) rotateY(${cur.x * 24}deg)`;
      if (shadow.current) shadow.current.style.transform = `translateX(-50%) scale(${1 - lift / 60})`;
      raf = requestAnimationFrame(tick);
    };
    const onMove = (e: PointerEvent) => {
      tgt.x = e.clientX / window.innerWidth - 0.5;
      tgt.y = e.clientY / window.innerHeight - 0.5;
      moved = performance.now();
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
    };
  }, []);
  return (
    <div className={`relative [perspective:900px] ${className}`}>
      <div className="absolute inset-[12%] rounded-full bg-accent-strong/35 blur-[70px]" aria-hidden="true" />
      <div ref={ref} className="relative [transform-style:preserve-3d] will-change-transform">
        <img src={isotipo} alt="" draggable={false} className="enter-pop w-full drop-shadow-[0_40px_50px_rgba(2,8,30,0.6)]" />
      </div>
      {/* Sombra en el piso: se achica cuando la columna sube */}
      <div
        ref={shadow}
        aria-hidden="true"
        className="absolute left-1/2 -bottom-[6%] h-[7%] w-[62%] -translate-x-1/2 rounded-[50%] bg-black/45 blur-[14px]"
      />
    </div>
  );
};

/**
 * Pantallas sin sesión (login y contraseña): la columna 3D con el nombre a un lado y el formulario
 * al otro, sobre el campo isométrico. En celular, la columna chica arriba de la tarjeta.
 */
export const AuthLayout: React.FC<Props> = (p) => (
  <div className="auth-page relative min-h-screen overflow-hidden bg-navy-deep flex flex-col lg:flex-row items-center justify-center gap-6 lg:gap-24 px-4 py-10">
    <IsometricField />
    {/* Viñeta: oscurece los bordes del campo para que el contenido se lea */}
    <div
      className="absolute inset-0 pointer-events-none"
      aria-hidden="true"
      style={{ background: 'radial-gradient(80% 80% at 50% 45%, rgba(4,13,34,0) 30%, rgba(4,13,34,0.7))' }}
    />
    <div className="relative flex flex-col items-center">
      <TiltColumn className="w-[136px] lg:w-[380px]" />
      <SocratesLockup iconSize={200} hideIcon invert animated className="mt-1 hidden lg:flex" />
      <SocratesLockup iconSize={112} hideIcon invert animated className="lg:hidden" />
      <p
        className="hidden lg:block mt-8 enter-up text-xs font-medium tracking-wide text-accent-light/60"
        style={{ animationDelay: '1100ms' }}
      >
        UTN · Facultad Regional Córdoba
      </p>
    </div>
    <SpotCard className="relative enter-up w-full max-w-[420px] px-6 py-8 sm:px-9">
      <Form {...p} />
    </SpotCard>
  </div>
);
