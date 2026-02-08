import { readFile } from 'node:fs/promises'

import { z } from 'zod/v4'

import type { ToolDefinition } from '../core/tool-registry.js'
import { resolveWorkspacePath } from './path-guard.js'

/** Reads UTF-8 file content from the configured workspace root. */
export const readFileTool: ToolDefinition = {
  name: 'read_file',
  description: 'Read the contents of a UTF-8 text file from the workspace.',
  inputSchema: {
    path: z.string().describe('Path relative to workspace or absolute path')
  },
  async execute(input, ctx) {
    try {
      const parsed = z.object({ path: z.string() }).parse(input)
      const target = resolveWorkspacePath(ctx.workspace, parsed.path)
      return await readFile(target, 'utf-8')
    } catch (error) {
      return `Error: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}
