import type { AnnotationSessionState } from './types.js';

export const ANNOTATION_SESSION_KEY = 'pixelagent:annotations';

export function loadAnnotationSession(): AnnotationSessionState | null {
  if (typeof sessionStorage === 'undefined') return null;

  try {
    const raw = sessionStorage.getItem(ANNOTATION_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AnnotationSessionState;
    if (!Array.isArray(parsed.annotations)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveAnnotationSession(state: AnnotationSessionState): void {
  if (typeof sessionStorage === 'undefined') return;

  try {
    sessionStorage.setItem(ANNOTATION_SESSION_KEY, JSON.stringify(state));
  } catch {
    // Quota exceeded or private browsing — ignore
  }
}

export function clearAnnotationSession(): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem(ANNOTATION_SESSION_KEY);
}
