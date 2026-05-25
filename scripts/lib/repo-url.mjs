/**
 * Override before publish if the GitHub remote differs:
 *   PIXELAGENT_REPO_URL=https://github.com/you/pixelAgent.git
 */
export const REPO_URL =
  process.env.PIXELAGENT_REPO_URL ?? 'https://github.com/pixelagent/pixelagent.git';

export function repositoryField(directory) {
  return {
    type: 'git',
    url: REPO_URL,
    directory,
  };
}
