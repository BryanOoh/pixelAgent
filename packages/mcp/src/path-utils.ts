import { resolve, relative, isAbsolute, normalize } from 'node:path';

export function assertWithinProject(projectRoot: string, filePath: string): string {
  const absoluteRoot = resolve(projectRoot);
  const absolutePath = isAbsolute(filePath) ? normalize(filePath) : resolve(absoluteRoot, filePath);

  const rel = relative(absoluteRoot, absolutePath);
  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error(`Path traversal blocked: ${filePath}`);
  }

  return absolutePath;
}
