import { appendFile, mkdir, rename, stat } from 'node:fs/promises'
import { dirname } from 'node:path'

export interface TranscriptLoggerOptions {
  enabled: boolean
  path: string
  maxBytes?: number
  maxFiles?: number
}

const DEFAULT_MAX_BYTES = 1_000_000
const DEFAULT_MAX_FILES = 3

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

    await this.rotateIfNeeded(Buffer.byteLength(`${line}\n`, 'utf-8'))
    await appendFile(this.options.path, `${line}\n`, 'utf-8')
  }

  private async rotateIfNeeded(incomingBytes: number): Promise<void> {
    const maxBytes = this.options.maxBytes ?? DEFAULT_MAX_BYTES
    const maxFiles = Math.max(1, this.options.maxFiles ?? DEFAULT_MAX_FILES)

    const currentSize = await this.getFileSize(this.options.path)
    if (currentSize + incomingBytes <= maxBytes) return

    for (let i = maxFiles; i >= 1; i -= 1) {
      const src = i === 1 ? this.options.path : `${this.options.path}.${i - 1}`
      const dest = `${this.options.path}.${i}`

      try {
        await rename(src, dest)
      } catch {
        // Missing source is fine during rotation.
      }
    }
  }

  private async getFileSize(path: string): Promise<number> {
    try {
      const file = await stat(path)
      return file.size
    } catch {
      return 0
    }
  }
}
