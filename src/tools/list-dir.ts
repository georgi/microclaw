import { readdir } from 'node:fs/promises'

import { z } from 'zod/v4'

import type { ToolDefinition } from '../core/tool-registry.js'
import { resolveWorkspacePath } from './path-guard.js'

/** Lists files/directories under a workspace-relative path. */
export const listDirTool: ToolDefinition = {
  name: 'list_dir',
  description: 'List directory contents at a given path.',
  inputSchema: {
    path: z.string()
  },
  async execute(input, ctx) {
    try {
      const parsed = z.object({ path: z.string() }).parse(input)
      const target = resolveWorkspacePath(ctx.workspace, parsed.path)
      const entries = await readdir(target, { withFileTypes: true })
      if (!entries.length) return '(empty)'

      return entries
        .map((entry) => `${entry.isDirectory() ? 'DIR ' : 'FILE'} ${entry.name}`)
        .join('\n')
    } catch (error) {
      return `Error: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}
