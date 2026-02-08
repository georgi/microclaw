import { describe, expect, it } from 'vitest'

import { configSchema } from '../src/config/schema.js'

describe('config schema defaults', () => {
  it('defaults transcript logging to disabled', () => {
    const parsed = configSchema.parse({
      model: 'claude-sonnet-4-5',
      workspace: '/tmp/workspace',
      channels: {
        telegram: { enabled: false, token: '', allowFrom: [] },
        discord: { enabled: false, token: '', allowFrom: [] }
      },
      tools: {
        execTimeoutSec: 60
      },
      sessionStorePath: '/tmp/sessions.json'
    })

    expect(parsed.transcriptLog.enabled).toBe(false)
  })
})
