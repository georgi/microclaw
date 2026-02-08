import { appendFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

export interface TranscriptLoggerOptions {
  enabled: boolean
  path: string
}

/**
 * Optional JSONL transcript logger for local debugging.
 *
 * Logging is opt-in and disabled by default.
 */
export class TranscriptLogger {
  constructor(private readonly options: TranscriptLoggerOptions) {}

  /** Appends one JSON line if logging is enabled. */
  async log(conversationKey: string, payload: Record<string, unknown>): Promise<void> {
    if (!this.options.enabled) return

    await mkdir(dirname(this.options.path), { recursive: true })
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      conversationKey,
      ...payload
    })
    await appendFile(this.options.path, `${line}\n`, 'utf-8')
  }
}
