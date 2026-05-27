export type TargetScope = 'this-instance' | 'all-instances';

export type ElementState = 'normal' | 'hover' | 'focus' | 'active' | 'disabled';

export type StylingSystem = 'tailwind' | 'css-modules' | 'global-css' | 'inline';

export type SourceConfidence = 'high' | 'medium' | 'low';

export type SourceMethod = 'babel-plugin' | 'heuristic';

export interface StyleChange {
  property: string;
  oldValue: string;
  newValue: string;
}

export interface ApplyPayload {
  schemaVersion?: number;
  elementSelector: string;
  sourceFile: string | null;
  lineNumber: number | null;
  targetScope: TargetScope;
  state: ElementState;
  stylingSystem: StylingSystem;
  changes: StyleChange[];
}

export type AnnotateCaptureMode = 'element' | 'area' | 'multi';

export interface AnnotationEntry {
  id: string;
  selector: string;
  note: string;
  position?: { x: number; y: number };
  /** User-highlighted text within the element (US-07). */
  selectedText?: string;
  /** Auto-captured element text when available. */
  elementText?: string;
  bbox?: { x: number; y: number; width: number; height: number };
  /** Drag-selected empty-space region (area annotate). */
  areaBbox?: { x: number; y: number; width: number; height: number };
  domPath?: string;
  computedStyles?: Record<string, string>;
  sourceFile?: string | null;
  lineNumber?: number | null;
  componentName?: string | null;
  /** Multi-element annotate: additional selectors beyond primary. */
  selectors?: string[];
  createdAt: number;
}

export interface AnnotationSessionState {
  annotations: AnnotationEntry[];
}

export interface ResolveElementResult {
  sourceFile: string | null;
  lineNumber: number | null;
  componentName: string | null;
  confidence: SourceConfidence;
  method: SourceMethod;
}

export interface ApplyVisualDiffResult {
  success: boolean;
  patchedFile: string;
  linesChanged: number[];
  warnings?: string[];
  /** Extra files written outside the primary source (e.g. inline-state sidecars). */
  sidecarFiles?: string[];
}

export interface DesignTokens {
  tailwindConfig?: Record<string, unknown>;
  cssVariables?: Record<string, string>;
  scale?: Record<string, string[]>;
}

export interface McpError {
  code: string;
  message: string;
  retryable: boolean;
}
