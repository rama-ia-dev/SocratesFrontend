import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical } from 'lucide-react';

export interface ActionMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  /** Acción que borra o no se puede deshacer: va en rojo y separada de las demás. */
  danger?: boolean;
}

interface ActionMenuProps {
  items: ActionMenuItem[];
  /** Texto para lectores de pantalla, por ejemplo "Acciones de Ana Pérez". */
  label: string;
}

const MENU_WIDTH = 188;

/**
 * Menú ⋮ de una fila. Se dibuja sobre el resto de la página (portal con posición fija), así no
 * lo tapa la columna fija de la fila siguiente ni lo recorta el desplazamiento de la tabla.
 */
export const ActionMenu: React.FC<ActionMenuProps> = ({ items, label }) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  const close = () => setPosition(null);

  const toggle = () => {
    if (position) return close();
    const rect = buttonRef.current!.getBoundingClientRect();
    const menuHeight = items.length * 32 + 10 + (items.some((i) => i.danger) ? 9 : 0);
    // Abre hacia abajo; si no entra en la ventana, hacia arriba.
    const top = rect.bottom + 4 + menuHeight > window.innerHeight ? rect.top - 4 - menuHeight : rect.bottom + 4;
    setPosition({ top, left: Math.max(8, rect.right - MENU_WIDTH) });
  };

  useEffect(() => {
    if (!position) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) close();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    // Con la posición fija, el menú quedaría flotando si la página o la tabla se desplazan.
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [position]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
          position ? 'bg-fill-neutral text-ink' : 'text-ink-muted hover:text-ink hover:bg-fill-neutral'
        }`}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={Boolean(position)}
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {position &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ top: position.top, left: position.left, width: MENU_WIDTH }}
            className="fixed z-50 bg-white border border-line rounded-xl shadow-[0_8px_24px_-8px_rgba(15,31,61,0.25)] p-1 text-left pop-in"
          >
            {items.map((item, i) => (
              <React.Fragment key={item.label}>
                {item.danger && i > 0 && <div role="separator" className="my-1 border-t border-line" />}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    close();
                    item.onClick();
                  }}
                  className={`w-full flex items-center gap-2.5 px-2.5 h-8 rounded-lg text-sm cursor-pointer ${
                    item.danger ? 'text-danger hover:bg-danger-soft' : 'text-ink hover:bg-fill-neutral'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              </React.Fragment>
            ))}
          </div>,
          document.body
        )}
    </>
  );
};
