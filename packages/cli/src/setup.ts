import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

interface McpServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

interface McpConfig {
  mcpServers: Record<string, McpServerConfig>;
}

const MCP_SERVER_NAME = 'pixelagent';

const SKILL_PROMPT = `# PixelAgent MCP Integration

When you receive a PixelAgent Apply payload or annotation markdown:

## Apply payload (JSON)
- Patch ONLY the declared \`changes[]\` properties
- Respect \`targetScope\`: "this-instance" vs "all-instances"
- Use \`apply_visual_diff\` MCP tool for auto-write
- Use \`resolve_element\` when source file is missing
- Use \`get_design_tokens\` for Tailwind scale snapping

## Annotation markdown (pipe-separated)
- Format: \`selector | context | "note"\`
- Use selector + source hint to find the exact element
- Never regenerate entire files — write surgical patches only
`;

async function readJsonFile<T>(path: string): Promise<T | null> {
  try {
    const content = await readFile(path, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

async function writeJsonFile(path: string, data: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

function getMcpServerEntry(projectRoot: string): McpServerConfig {
  // Run the published MCP server via npx so the config has no fragile path
  // into node_modules — npx prefers a local install and falls back to
  // fetching on demand. @pixelagent/mcp is therefore not a dependency of
  // this CLI; it is only pulled in when the MCP client actually launches it.
  return {
    command: 'npx',
    args: ['-y', '@pixelagent/mcp'],
    env: {
      PIXELAGENT_PROJECT_ROOT: projectRoot,
    },
  };
}

async function setupMcpConfig(
  configPath: string,
  projectRoot: string
): Promise<'created' | 'updated' | 'skipped'> {
  const existing = await readJsonFile<McpConfig>(configPath);
  const entry = getMcpServerEntry(projectRoot);

  if (existing?.mcpServers?.[MCP_SERVER_NAME]) {
    const current = existing.mcpServers[MCP_SERVER_NAME];
    if (JSON.stringify(current) === JSON.stringify(entry)) {
      return 'skipped';
    }
  }

  const config: McpConfig = {
    mcpServers: {
      ...(existing?.mcpServers ?? {}),
      [MCP_SERVER_NAME]: entry,
    },
  };

  await writeJsonFile(configPath, config);
  return existing ? 'updated' : 'created';
}

async function setupSkillPrompt(projectRoot: string): Promise<void> {
  const skillDir = join(projectRoot, '.claude', 'skills', 'pixelagent-mcp');
  const skillPath = join(skillDir, 'SKILL.md');
  await mkdir(skillDir, { recursive: true });
  await writeFile(skillPath, SKILL_PROMPT, 'utf-8');
}

export async function runSetup(projectRoot: string = process.cwd()): Promise<void> {
  const root = resolve(projectRoot);
  const results: string[] = [];

  const claudeMcp = join(root, '.claude', 'mcp.json');
  const cursorMcp = join(root, '.cursor', 'mcp.json');

  const claudeResult = await setupMcpConfig(claudeMcp, root);
  results.push(`Claude Code MCP (${claudeMcp}): ${claudeResult}`);

  const cursorResult = await setupMcpConfig(cursorMcp, root);
  results.push(`Cursor MCP (${cursorMcp}): ${cursorResult}`);

  await setupSkillPrompt(root);
  results.push(`Skill prompt: .claude/skills/pixelagent-mcp/SKILL.md`);

  console.log('PixelAgent setup complete:\n');
  for (const line of results) {
    console.log(`  ✓ ${line}`);
  }
  console.log('\nNext: import <PixelAgent /> in your app layout (dev only).');
}
