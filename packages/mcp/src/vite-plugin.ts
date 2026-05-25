import type { IncomingMessage } from 'node:http';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import type { ApplyPayload } from '@pixelagent/shared';
import { applyVisualDiff } from './tools.js';

export const PIXELAGENT_APPLY_PATH = '/__pixelagent/apply';

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolvePromise, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf-8');
        resolvePromise(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

export interface PixelagentVitePluginOptions {
  /** Monorepo / app root for apply_visual_diff (defaults to Vite config root). */
  projectRoot?: string;
}

/**
 * Dev-only Vite middleware: POST ApplyPayload JSON → apply_visual_diff result.
 * Wire `applyEndpoint={PIXELAGENT_APPLY_PATH}` on `<PixelAgent />` in local apps.
 */
export function pixelagentVitePlugin(options: PixelagentVitePluginOptions = {}): Plugin {
  return {
    name: 'pixelagent-mcp-apply',
    apply: 'serve',
    configureServer(server) {
      const projectRoot = resolve(options.projectRoot ?? server.config.root);

      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith(PIXELAGENT_APPLY_PATH)) {
          next();
          return;
        }

        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method not allowed');
          return;
        }

        try {
          const body = (await readJsonBody(req)) as { payload?: ApplyPayload };
          const payload = body.payload ?? (body as ApplyPayload);
          const result = await applyVisualDiff(projectRoot, payload);
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify(result));
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 500;
          res.end(JSON.stringify({ success: false, error: message }));
        }
      });
    },
  };
}
