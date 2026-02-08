import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

import { z } from 'zod/v4'

import type { ToolDefinition } from '../core/tool-registry.js'
import { resolveWorkspacePath } from './path-guard.js'

/** Writes UTF-8 content to a workspace file, creating directories as needed. */
export const writeFileTool: ToolDefinition = {
  name: 'write_file',
  description: 'Write UTF-8 content to a file and create parent directories if needed.',
  inputSchema: {
    path: z.string(),
    content: z.string()
  },
  async execute(input, ctx) {
    try {
      const parsed = z.object({ path: z.string(), content: z.string() }).parse(input)
      const target = resolveWorkspacePath(ctx.workspace, parsed.path)
      await mkdir(dirname(target), { recursive: true })
      await writeFile(target, parsed.content, 'utf-8')
      return `Wrote ${parsed.content.length} chars to ${target}`
    } catch (error) {
      return `Error: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}
