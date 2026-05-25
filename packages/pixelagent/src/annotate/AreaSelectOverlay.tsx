interface AreaRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface AreaSelectOverlayProps {
  area: AreaRect | null;
  isDragging: boolean;
}

export function AreaSelectOverlay({ area, isDragging }: AreaSelectOverlayProps) {
  if (!area || area.width < 2 || area.height < 2) return null;

  return (
    <div
      className={`pa-area-select ${isDragging ? 'pa-area-select--dragging' : ''}`}
      style={{
        top: area.y,
        left: area.x,
        width: area.width,
        height: area.height,
      }}
      aria-hidden="true"
    />
  );
}