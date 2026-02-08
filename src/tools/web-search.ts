import { z } from 'zod/v4'

import type { ToolDefinition } from '../core/tool-registry.js'

/** Creates a Brave Search-backed web search tool. */
export function createWebSearchTool(apiKey?: string): ToolDefinition {
  return {
    name: 'web_search',
    description: 'Search the web and return top result snippets.',
    inputSchema: {
      query: z.string(),
      count: z.number().int().min(1).max(10).optional()
    },
    async execute(input) {
      try {
        const parsed = z
          .object({
            query: z.string(),
            count: z.number().int().min(1).max(10).optional()
          })
          .parse(input)

        if (!apiKey) return 'Error: MICROCLAW_WEB_SEARCH_API_KEY not configured'
        const count = parsed.count ?? 5

        const url = new URL('https://api.search.brave.com/res/v1/web/search')
        url.searchParams.set('q', parsed.query)
        url.searchParams.set('count', String(count))

        const response = await fetch(url, {
          headers: {
            Accept: 'application/json',
            'X-Subscription-Token': apiKey
          }
        })

        if (!response.ok) return `Error: web search failed (${response.status})`

        const data = (await response.json()) as {
          web?: { results?: Array<{ title?: string; url?: string; description?: string }> }
        }
        const results = data.web?.results ?? []
        if (!results.length) return `No results for: ${parsed.query}`

        return results
          .slice(0, count)
          .map(
            (item, i) =>
              `${i + 1}. ${item.title ?? '(no title)'}\n${item.url ?? ''}\n${item.description ?? ''}`
          )
          .join('\n\n')
      } catch (error) {
        return `Error: ${error instanceof Error ? error.message : String(error)}`
      }
    }
  }
}
