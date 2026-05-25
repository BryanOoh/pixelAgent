#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { resolve } from 'node:path';
import { applyVisualDiff, getDesignTokens, resolveElement } from './tools.js';

const PROJECT_ROOT = resolve(process.env.PIXELAGENT_PROJECT_ROOT ?? process.cwd());

const ApplyPayloadSchema = z.object({
  schemaVersion: z.number().optional(),
  elementSelector: z.string(),
  sourceFile: z.string().nullable(),
  lineNumber: z.number().nullable(),
  targetScope: z.enum(['this-instance', 'all-instances']),
  state: z.enum(['normal', 'hover', 'focus', 'active', 'disabled']),
  stylingSystem: z.enum(['tailwind', 'css-modules', 'global-css', 'inline']),
  changes: z.array(
    z.object({
      property: z.string(),
      oldValue: z.string(),
      newValue: z.string(),
    })
  ),
});

const server = new Server(
  { name: '@pixelagent/mcp', version: '0.1.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'apply_visual_diff',
      description:
        'Apply a structured visual diff to a source file. Writes a surgical patch, never full file regeneration.',
      inputSchema: {
        type: 'object',
        properties: {
          payload: {
            type: 'object',
            description: 'ApplyPayload from PixelAgent edit panel',
          },
        },
        required: ['payload'],
      },
    },
    {
      name: 'resolve_element',
      description: 'Resolve a CSS selector to source file, line number, and component name.',
      inputSchema: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector from PixelAgent' },
          domPath: { type: 'string', description: 'Optional DOM path for disambiguation' },
        },
        required: ['selector'],
      },
    },
    {
      name: 'get_design_tokens',
      description: 'Read Tailwind config, CSS variables, and design tokens from the project.',
      inputSchema: {
        type: 'object',
        properties: {
          projectRoot: {
            type: 'string',
            description: 'Project root path (defaults to PIXELAGENT_PROJECT_ROOT or cwd)',
          },
        },
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'apply_visual_diff': {
        const { payload } = z.object({ payload: ApplyPayloadSchema }).parse(args);
        const result = await applyVisualDiff(PROJECT_ROOT, payload);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'resolve_element': {
        const { selector } = z.object({ selector: z.string() }).parse(args);
        const result = await resolveElement(PROJECT_ROOT, selector);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'get_design_tokens': {
        const root = z
          .object({ projectRoot: z.string().optional() })
          .parse(args ?? {}).projectRoot ?? PROJECT_ROOT;
        const result = await getDesignTokens(resolve(root));
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: { code: 'TOOL_ERROR', message, retryable: false },
          }),
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('PixelAgent MCP server failed:', error);
  process.exit(1);
});
