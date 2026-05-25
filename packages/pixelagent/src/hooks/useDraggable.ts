import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';

interface Position {
  x: number;
  y: number;
}

interface UseDraggableOptions {
  /** Initial position; null = computed on first layout */
  defaultPosition?: Position | null;
  /** Custom default placement when position is not set */
  computeDefaultPosition?: (rect: DOMRect) => Position;
}

export function useDraggable({
  defaultPosition = null,
  computeDefaultPosition,
}: UseDraggableOptions = {}) {
  const [position, setPosition] = useState<Position | null>(defaultPosition);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const elementRef = useRef<HTMLDivElement>(null);

  const initDefaultPosition = useCallback(() => {
    if (position !== null) return;
    const el = elementRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    setPosition(
      computeDefaultPosition
        ? computeDefaultPosition(rect)
        : {
            x: (window.innerWidth - rect.width) / 2,
            y: window.innerHeight - rect.height - 24,
          }
    );
  }, [position, computeDefaultPosition]);

  useEffect(() => {
    initDefaultPosition();
  }, [initDefaultPosition]);

  useEffect(() => {
    const onResize = () => {
      setPosition((prev) => {
        if (!prev || !elementRef.current) return prev;
        const rect = elementRef.current.getBoundingClientRect();
        return {
          x: Math.min(prev.x, window.innerWidth - rect.width),
          y: Math.min(prev.y, window.innerHeight - rect.height),
        };
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;

      const el = elementRef.current;
      if (!el) return;

      let origin = position;
      if (!origin) {
        const rect = el.getBoundingClientRect();
        origin = { x: rect.left, y: rect.top };
        setPosition(origin);
      }

      dragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        originX: origin.x,
        originY: origin.y,
      };
      setIsDragging(true);
      e.currentTarget.setPointerCapture(e.pointerId);
      e.preventDefault();
    },
    [position]
  );

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return;

    const el = elementRef.current;
    const width = el?.offsetWidth ?? 320;
    const height = el?.offsetHeight ?? 48;

    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;

    const x = Math.max(8, Math.min(window.innerWidth - width - 8, dragRef.current.originX + dx));
    const y = Math.max(8, Math.min(window.innerHeight - height - 8, dragRef.current.originY + dy));

    setPosition({ x, y });
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return;
    dragRef.current = null;
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // already released
    }
  }, []);

  const style: CSSProperties | undefined =
    position !== null
      ? {
          position: 'fixed',
          left: position.x,
          top: position.y,
          transform: 'none',
          marginLeft: 0,
          bottom: 'auto',
        }
      : undefined;

  return {
    elementRef,
    position,
    isDragging,
    style,
    dragHandleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
    },
  };
}
