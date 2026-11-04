import { useCallback, useEffect, useRef, useState } from 'react';

// Duración del resaltado: coincide con la animación `row-highlight` de index.css (4 × 1,25 s)
const HIGHLIGHT_MS = 5000;

/**
 * Resaltado del registro recién creado en una lista paginada (SCRUM-609). Mientras dura, el
 * registro se muestra arriba de la página actual aunque por orden o página no le corresponda,
 * la lista se desplaza hasta él y su fila lleva la clase `row-highlight`.
 */
export function useHighlight<T>(getId: (item: T) => number) {
  const [item, setItem] = useState<T | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const highlight = useCallback((next: T) => {
    window.clearTimeout(timer.current);
    setItem(next);
    timer.current = window.setTimeout(() => setItem(null), HIGHLIGHT_MS);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  // Una vez dibujada la fila, se la trae a la vista
  useEffect(() => {
    if (!item) return;
    const id = window.setTimeout(() => {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      document.querySelector('tr.row-highlight')?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    }, 50);
    return () => window.clearTimeout(id);
  }, [item]);

  /** Las filas a mostrar: las de la página, con el resaltado fijado arriba si no estaba entre ellas */
  const withHighlighted = useCallback(
    (rows: T[]): T[] => {
      if (!item) return rows;
      const id = getId(item);
      return rows.some((r) => getId(r) === id) ? rows : [item, ...rows];
    },
    [item, getId]
  );

  const isHighlighted = useCallback((row: T) => item !== null && getId(row) === getId(item), [item, getId]);

  return { highlight, withHighlighted, isHighlighted };
}
