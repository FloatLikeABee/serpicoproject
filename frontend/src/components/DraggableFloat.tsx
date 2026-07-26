import React, { useCallback, useEffect, useRef, useState } from 'react';

interface DraggableFloatProps {
  storageKey?: string;
  initial?: { x: number; y: number };
  className?: string;
  children: React.ReactNode;
  /** Element that starts a drag (e.g. header bar). */
  dragHandleClassName?: string;
}

/**
 * Absolutely-positioned floating shell the player can drag around the map.
 * Position is clamped to the parent and optionally remembered per key.
 */
const DraggableFloat: React.FC<DraggableFloatProps> = ({
  storageKey,
  initial = { x: 12, y: 12 },
  className = '',
  children,
  dragHandleClassName = 'drag-handle',
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(() => {
    if (storageKey && typeof window !== 'undefined') {
      try {
        const raw = sessionStorage.getItem(storageKey);
        if (raw) return JSON.parse(raw) as { x: number; y: number };
      } catch {
        /* ignore */
      }
    }
    return initial;
  });
  const dragRef = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    pointerId: number;
  } | null>(null);

  const clampToParent = useCallback((x: number, y: number) => {
    const el = rootRef.current;
    const parent = el?.offsetParent as HTMLElement | null;
    if (!el || !parent) return { x, y };
    const maxX = Math.max(0, parent.clientWidth - el.offsetWidth);
    const maxY = Math.max(0, parent.clientHeight - el.offsetHeight);
    return {
      x: Math.min(Math.max(0, x), maxX),
      y: Math.min(Math.max(0, y), maxY),
    };
  }, []);

  useEffect(() => {
    setPos((p) => clampToParent(p.x, p.y));
  }, [clampToParent]);

  useEffect(() => {
    if (!storageKey) return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(pos));
    } catch {
      /* ignore */
    }
  }, [pos, storageKey]);

  const onPointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest(`.${dragHandleClassName}`)) return;
    if ((target as HTMLElement).closest('button, a, input, textarea, select')) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: pos.x,
      origY: pos.y,
      pointerId: e.pointerId,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    const next = clampToParent(
      drag.origX + (e.clientX - drag.startX),
      drag.origY + (e.clientY - drag.startY)
    );
    setPos(next);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (dragRef.current?.pointerId === e.pointerId) {
      dragRef.current = null;
    }
  };

  return (
    <div
      ref={rootRef}
      className={`absolute z-[1200] pointer-events-auto ${className}`}
      style={{ left: pos.x, top: pos.y, touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {children}
    </div>
  );
};

export default DraggableFloat;
