import { useCallback, useEffect, useRef, useState } from 'react';
import type { AnnotationEntry } from '@pixelagent/shared';
import { loadAnnotationSession, saveAnnotationSession } from '@pixelagent/shared';

export function useAnnotationSession() {
  const restored = useRef(loadAnnotationSession());
  const [annotations, setAnnotations] = useState<AnnotationEntry[]>(
    () => restored.current?.annotations ?? []
  );

  useEffect(() => {
    saveAnnotationSession({ annotations });
  }, [annotations]);

  const updateAnnotation = useCallback((id: string, patch: Partial<AnnotationEntry>) => {
    setAnnotations((prev) =>
      prev.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry))
    );
  }, []);

  const removeAnnotation = useCallback((id: string) => {
    setAnnotations((prev) => prev.filter((entry) => entry.id !== id));
  }, []);

  return {
    annotations,
    setAnnotations,
    updateAnnotation,
    removeAnnotation,
  };
}
