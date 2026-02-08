import { z } from 'zod/v4'

import type { ToolDefinition } from '../core/tool-registry.js'

const BLOCKED_HOSTNAME_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^0\./,
  /^169\.254\./,
  /^\[::1\]$/,
  /^\[fd/i,
  /^\[fe80:/i,
  /^metadata\.google\.internal$/i
]

function isBlockedUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr)
    return BLOCKED_HOSTNAME_PATTERNS.some((p) => p.test(parsed.hostname))
  } catch {
    return true
  }
}

/** Fetches raw text content from a URL with a bounded response size. */
export const webFetchTool: ToolDefinition = {
  name: 'web_fetch',
  description: 'Fetch a URL and return text content up to maxChars.',
  inputSchema: {
    url: z.string().url(),
    maxChars: z.number().int().min(100).max(200000).optional()
  },
  async execute(input) {
    try {
      const parsed = z
        .object({
          url: z.string().url(),
          maxChars: z.number().int().min(100).max(200000).optional()
        })
        .parse(input)

      if (isBlockedUrl(parsed.url)) {
        return 'Error: URL targets a blocked internal/private network address'
      }

      const response = await fetch(parsed.url)
      if (!response.ok) return `Error: fetch failed (${response.status})`

      const text = await response.text()
      return text.slice(0, parsed.maxChars ?? 50000)
    } catch (error) {
      return `Error: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}
