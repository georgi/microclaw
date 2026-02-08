import { describe, expect, it } from 'vitest'

import { webFetchTool } from '../src/tools/web-fetch.js'

const ctx = { workspace: '/tmp', channel: 'telegram' as const, chatId: 'c1' }

describe('web_fetch SSRF protection', () => {
  it('blocks localhost URLs', async () => {
    const result = await webFetchTool.execute(
      { url: 'http://localhost/secret' },
      ctx
    )
    expect(result).toContain('Error: URL targets a blocked internal/private network address')
  })

  it('blocks 127.x.x.x URLs', async () => {
    const result = await webFetchTool.execute(
      { url: 'http://127.0.0.1/admin' },
      ctx
    )
    expect(result).toContain('blocked internal/private')
  })

  it('blocks 169.254.x.x (link-local / cloud metadata) URLs', async () => {
    const result = await webFetchTool.execute(
      { url: 'http://169.254.169.254/latest/meta-data/' },
      ctx
    )
    expect(result).toContain('blocked internal/private')
  })

  it('blocks 10.x.x.x private network URLs', async () => {
    const result = await webFetchTool.execute(
      { url: 'http://10.0.0.1/internal' },
      ctx
    )
    expect(result).toContain('blocked internal/private')
  })

  it('blocks 192.168.x.x private network URLs', async () => {
    const result = await webFetchTool.execute(
      { url: 'http://192.168.1.1/' },
      ctx
    )
    expect(result).toContain('blocked internal/private')
  })

  it('blocks 172.16-31.x.x private network URLs', async () => {
    const result = await webFetchTool.execute(
      { url: 'http://172.16.0.1/' },
      ctx
    )
    expect(result).toContain('blocked internal/private')
  })

  it('blocks metadata.google.internal', async () => {
    const result = await webFetchTool.execute(
      { url: 'http://metadata.google.internal/computeMetadata/v1/' },
      ctx
    )
    expect(result).toContain('blocked internal/private')
  })

  it('blocks IPv6 loopback', async () => {
    const result = await webFetchTool.execute(
      { url: 'http://[::1]/secret' },
      ctx
    )
    expect(result).toContain('blocked internal/private')
  })

  it('returns error string on invalid URL', async () => {
    const result = await webFetchTool.execute(
      { url: 'not-a-url' },
      ctx
    )
    expect(result).toContain('Error:')
  })
})
