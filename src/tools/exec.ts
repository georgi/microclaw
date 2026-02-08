import { exec as execCb } from 'node:child_process'
import { promisify } from 'node:util'

import { z } from 'zod/v4'

import type { ToolDefinition } from '../core/tool-registry.js'
import { resolveWorkingDir } from './path-guard.js'

const exec = promisify(execCb)

const DENY_PATTERNS: RegExp[] = [
  /\brm\s+-[\w-]*r[\w-]*f?[\w-]*/i,
  /\bshutdown\b/i,
  /\breboot\b/i,
  /\bpoweroff\b/i,
  /\bdd\s+if=/i,
  /\bmkfs\b/i,
  /\bformat\b/i,
  /\bchmod\s+[0-7]{3,4}\s+\//i,
  /\bchown\s+/i,
  /\bfind\b.*\s-delete\b/i,
  /\bcurl\b.*\|\s*\bsh\b/i,
  /\bwget\b.*\|\s*\bsh\b/i,
  /:\(\)\s*\{.*\|.*&\s*\}\s*;/,
  />\s*\/dev\/(?:[sh]d|nvme|vd|xvd|loop)/i,
  /\bnc\s+-[\w]*l/i
]

function isCommandBlocked(command: string): boolean {
  return DENY_PATTERNS.some((pattern) => pattern.test(command))
}

/** Builds the shell execution tool with a configurable timeout. */
export function createExecTool(timeoutSec: number): ToolDefinition {
  return {
    name: 'exec',
    description: 'Execute a shell command and return stdout/stderr output.',
    inputSchema: {
      command: z.string(),
      working_dir: z.string().optional()
    },
    async execute(input, ctx) {
      try {
        const parsed = z
          .object({
            command: z.string(),
            working_dir: z.string().optional()
          })
          .parse(input)

        if (isCommandBlocked(parsed.command)) {
          return 'Error: command blocked by safety policy'
        }

        const cwd = resolveWorkingDir(ctx.workspace, parsed.working_dir)

        const { stdout, stderr } = await exec(parsed.command, {
          cwd,
          timeout: timeoutSec * 1000,
          maxBuffer: 1024 * 1024
        })

        return [stdout.trim(), stderr.trim() ? `STDERR:\n${stderr.trim()}` : '']
          .filter(Boolean)
          .join('\n') || '(no output)'
      } catch (error) {
        return `Error: ${error instanceof Error ? error.message : String(error)}`
      }
    }
  }
}
