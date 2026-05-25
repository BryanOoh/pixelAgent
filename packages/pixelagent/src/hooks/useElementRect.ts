import { useEffect, useState } from 'react';

export function useElementRect(target: Element | null): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!target) {
      setRect(null);
      return;
    }

    const update = () => setRect(target.getBoundingClientRect());

    update();

    const observer = new ResizeObserver(update);
    observer.observe(target);
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [target]);

  return rect;
}
