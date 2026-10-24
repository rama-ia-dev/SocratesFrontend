import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical } from 'lucide-react';

export interface ActionMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
}

interface ActionMenuProps {
  items: ActionMenuItem[];
  /** Texto para lectores de pantalla, por ejemplo "Acciones de Ana Pérez". */
  label: string;
}

const MENU_WIDTH = 160;

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
    const menuHeight = items.length * 36 + 8;
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
        className="p-1 rounded text-ink-muted hover:text-ink hover:bg-tint cursor-pointer"
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
            className="fixed z-50 bg-white border border-line rounded-lg shadow-lg py-1 text-left"
          >
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  close();
                  item.onClick();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-ink hover:bg-tint cursor-pointer"
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  );
};
