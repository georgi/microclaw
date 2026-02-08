import { config as loadEnv } from 'dotenv'

import { configSchema, type MicroclawConfig } from './schema.js'

/** Parses comma-separated allow-list env values. */
function parseCsv(input: string | undefined): string[] {
  if (!input) return []
  return input
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * Loads runtime configuration from environment and validates shape/types.
 */
export function loadConfig(): MicroclawConfig {
  loadEnv()

  return configSchema.parse({
    model: process.env.MICROCLAW_MODEL ?? 'claude-sonnet-4-5',
    workspace: process.env.MICROCLAW_WORKSPACE ?? process.cwd(),
    channels: {
      telegram: {
        enabled: process.env.MICROCLAW_TELEGRAM_ENABLED === 'true',
        token: process.env.MICROCLAW_TELEGRAM_TOKEN ?? '',
        allowFrom: parseCsv(process.env.MICROCLAW_TELEGRAM_ALLOW_FROM)
      },
      discord: {
        enabled: process.env.MICROCLAW_DISCORD_ENABLED === 'true',
        token: process.env.MICROCLAW_DISCORD_TOKEN ?? '',
        allowFrom: parseCsv(process.env.MICROCLAW_DISCORD_ALLOW_FROM)
      }
    },
    tools: {
      execTimeoutSec: Number(process.env.MICROCLAW_EXEC_TIMEOUT_SEC ?? 60),
      webSearchApiKey: process.env.MICROCLAW_WEB_SEARCH_API_KEY
    },
    transcriptLog: {
      enabled: process.env.MICROCLAW_TRANSCRIPT_LOG_ENABLED === 'true',
      path:
        process.env.MICROCLAW_TRANSCRIPT_LOG_PATH ?? `${process.cwd()}/data/transcript.jsonl`
    },
    sessionStorePath:
      process.env.MICROCLAW_SESSION_STORE_PATH ?? `${process.cwd()}/data/sessions.json`,
    maxToolIterations: Number(process.env.MICROCLAW_MAX_TOOL_ITERATIONS ?? 20)
  })
}
