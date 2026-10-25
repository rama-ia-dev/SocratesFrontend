import React, { useEffect, useRef } from 'react';

const S = 34; // medio ancho de la tapa del bloque
const HS = S / 2; // medio alto: proporción 2:1, como la columna del logo
const BASE = 9; // altura mínima del bloque
const STEP = 0.5; // de a cuánto sube un bloque, en píxeles

const Z_MAX = 48; // más de lo que sube un bloque con el puntero encima y una onda a la vez
const CELL_W = S * 2 + 2; // un píxel de margen a cada lado para el borde
const CELL_H = HS * 2 + BASE + Z_MAX + 2;
const SHEET_COLS = 10;

/**
 * Todas las alturas de un bloque dibujadas una vez, en una sola hoja. Por cuadro solo se copian
 * recortes de esa hoja, que la placa de video hace de un tirón; dibujar las miles de caras en cada
 * cuadro trababa la pantalla en placas integradas.
 */
const blockSheet = (ratio: number) => {
  const count = Z_MAX / STEP + 1;
  const sheet = document.createElement('canvas');
  sheet.width = Math.ceil(SHEET_COLS * CELL_W * ratio);
  sheet.height = Math.ceil(Math.ceil(count / SHEET_COLS) * CELL_H * ratio);
  const g = sheet.getContext('2d')!;
  g.scale(ratio, ratio);
  for (let i = 0; i < count; i++) {
    g.save();
    g.translate((i % SHEET_COLS) * CELL_W, Math.floor(i / SHEET_COLS) * CELL_H);
    drawBlock(g, i * STEP);
    g.restore();
  }
  return sheet;
};

/** Un bloque de altura z, con el pie apoyado en el borde de abajo de su celda. */
const drawBlock = (g: CanvasRenderingContext2D, z: number) => {
  const e = Math.min(1, z / 30);
  const x = S + 1;
  const top = CELL_H - 1 - HS - BASE - z;
  const bottom = top + BASE + z;

  // Cara superior
  g.beginPath();
  g.moveTo(x, top - HS);
  g.lineTo(x + S, top);
  g.lineTo(x, top + HS);
  g.lineTo(x - S, top);
  g.closePath();
  g.fillStyle = `rgb(${24 + e * 50},${58 + e * 90},${140 + e * 100})`;
  g.fill();
  g.strokeStyle = `rgba(125,211,252,${0.18 + e * 0.6})`;
  g.lineWidth = 1;
  g.stroke();
  // Cara izquierda
  g.beginPath();
  g.moveTo(x - S, top);
  g.lineTo(x, top + HS);
  g.lineTo(x, bottom + HS);
  g.lineTo(x - S, bottom);
  g.closePath();
  g.fillStyle = `rgb(${10 + e * 14},${28 + e * 30},${74 + e * 50})`;
  g.fill();
  // Cara derecha, la más oscura
  g.beginPath();
  g.moveTo(x + S, top);
  g.lineTo(x, top + HS);
  g.lineTo(x, bottom + HS);
  g.lineTo(x + S, bottom);
  g.closePath();
  g.fillStyle = `rgb(${6 + e * 8},${18 + e * 18},${50 + e * 34})`;
  g.fill();
};

/**
 * Fondo de las pantallas sin sesión: un campo de bloques con la perspectiva isométrica del logo.
 * Los bloques se levantan cerca del puntero, un clic manda una onda y, sin puntero, el campo
 * ondula despacio. Con "reducir movimiento" activado queda un cuadro fijo.
 */
export const IsometricField: React.FC<{ className?: string }> = ({ className = '' }) => {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let w = 0;
    let h = 0;
    let raf = 0;
    // Puntero suavizado: los bloques lo siguen con un poco de inercia
    const target = { x: -9999, y: -9999 };
    const p = { x: -9999, y: -9999 };
    const waves: { x: number; y: number; t: number }[] = [];
    // Altura de cada bloque, suavizada por separado para que el campo "respire"
    let heights = new Float32Array(0);
    // Hoja con los bloques; se rehace si cambia la densidad de píxeles de la pantalla
    let sheet: HTMLCanvasElement | null = null;
    let sheetRatio = 0;

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * ratio);
      canvas.height = Math.round(h * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      if (ratio !== sheetRatio) {
        sheet = blockSheet(ratio);
        sheetRatio = ratio;
      }
    };

    const draw = (now: number, dt: number) => {
      const cols = Math.ceil(w / (S * 2)) + 2;
      const rows = Math.ceil(h / HS) + 4;
      if (heights.length !== cols * rows) heights = new Float32Array(cols * rows);
      const reach = 230;
      const k = reduced ? 1 : 1 - Math.exp(-dt / 160);
      ctx.clearRect(0, 0, w, h);
      // De atrás hacia adelante: cada fila tapa a la anterior
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          // Filas alternadas corridas medio bloque: la grilla queda en rombos
          const x = c * S * 2 + (r % 2 ? S : 0) - S;
          const y = r * HS - HS * 2;
          const d = Math.hypot(x - p.x, y - p.y);
          let lift = d < reach ? Math.pow(1 - d / reach, 1.6) * 34 : 0;
          for (const wv of waves) {
            const front = (now - wv.t) * 0.5;
            const q = Math.abs(Math.hypot(x - wv.x, y - wv.y) - front);
            if (q < 60) lift = Math.max(lift, (1 - q / 60) * 22 * Math.max(0, 1 - front / 1100));
          }
          // Ondulación lenta de fondo, para que el campo nunca esté del todo quieto
          lift += reduced ? 0 : (Math.sin(now / 1400 + c * 0.55 + r * 0.32) + 1) * 2.2;
          const i = r * cols + c;
          heights[i] += (lift - heights[i]) * k;
          // El pie del bloque queda siempre en y + HS: el recorte se apoya ahí, sea cual sea su altura
          const n = Math.min(Z_MAX / STEP, Math.max(0, Math.round(heights[i] / STEP)));
          const sx = (n % SHEET_COLS) * CELL_W * sheetRatio;
          const sy = Math.floor(n / SHEET_COLS) * CELL_H * sheetRatio;
          ctx.drawImage(
            sheet!,
            sx, sy, CELL_W * sheetRatio, CELL_H * sheetRatio,
            x - S - 1, y + HS + 1 - CELL_H, CELL_W, CELL_H
          );
        }
      }
    };

    let last = performance.now();
    const frame = (now: number) => {
      // Todo se mueve por tiempo, no por cuadro: igual en pantallas de 30, 60 o 144 Hz
      const dt = Math.min(64, Math.max(0, now - last));
      last = now;
      const k = 1 - Math.exp(-dt / 90);
      p.x += (target.x - p.x) * k;
      p.y += (target.y - p.y) * k;
      for (let i = waves.length - 1; i >= 0; i--) if (now - waves[i].t > 2200) waves.splice(i, 1);
      draw(now, dt);
      if (!reduced) raf = requestAnimationFrame(frame);
    };

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      target.x = e.clientX - rect.left;
      target.y = e.clientY - rect.top;
      if (p.x < -9000) {
        p.x = target.x;
        p.y = target.y;
      }
    };
    const onLeave = () => {
      target.x = -9999;
      target.y = -9999;
    };
    const onDown = (e: PointerEvent) => {
      if (reduced) return;
      const rect = canvas.getBoundingClientRect();
      waves.push({ x: e.clientX - rect.left, y: e.clientY - rect.top, t: performance.now() });
    };
    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && !reduced) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };

    resize();
    raf = requestAnimationFrame(frame);
    const ro = new ResizeObserver(() => {
      resize();
      if (reduced) frame(performance.now());
    });
    ro.observe(canvas);
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return <canvas ref={ref} aria-hidden="true" className={`absolute inset-0 h-full w-full ${className}`} />;
};
