import { readFile, writeFile } from 'node:fs/promises'

import { z } from 'zod/v4'

import type { ToolDefinition } from '../core/tool-registry.js'
import { resolveWorkspacePath } from './path-guard.js'

/** Performs a guarded single-occurrence text replacement inside a file. */
export const editFileTool: ToolDefinition = {
  name: 'edit_file',
  description: 'Replace old_text with new_text in a file. Warns on ambiguous matches.',
  inputSchema: {
    path: z.string(),
    old_text: z.string(),
    new_text: z.string()
  },
  async execute(input, ctx) {
    try {
      const parsed = z
        .object({ path: z.string(), old_text: z.string(), new_text: z.string() })
        .parse(input)

      const target = resolveWorkspacePath(ctx.workspace, parsed.path)
      const current = await readFile(target, 'utf-8')
      const count = current.split(parsed.old_text).length - 1

      if (count === 0) return 'Error: old_text not found'
      if (count > 1) return `Warning: old_text appears ${count} times`

      const updated = current.replace(parsed.old_text, parsed.new_text)
      await writeFile(target, updated, 'utf-8')
      return `Edited ${target}`
    } catch (error) {
      return `Error: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}
