import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { createExecTool } from '../src/tools/exec.js'

async function setupWorkspace() {
  return mkdtemp(join(tmpdir(), 'microclaw-exec-guard-'))
}

describe('exec safety deny patterns', () => {
  it('blocks destructive rm -rf command', async () => {
    const workspace = await setupWorkspace()
    const execTool = createExecTool(5)

    const result = await execTool.execute(
      { command: 'rm -rf /tmp/something' },
      { workspace, channel: 'telegram', chatId: 'c1' }
    )

    expect(result).toContain('Error: command blocked by safety policy')
  })

  it('blocks shutdown command', async () => {
    const workspace = await setupWorkspace()
    const execTool = createExecTool(5)

    const result = await execTool.execute(
      { command: 'shutdown now' },
      { workspace, channel: 'telegram', chatId: 'c1' }
    )

    expect(result).toContain('Error: command blocked by safety policy')
  })

  it('allows safe command execution', async () => {
    const workspace = await setupWorkspace()
    const execTool = createExecTool(5)

    const result = await execTool.execute(
      { command: 'echo ok' },
      { workspace, channel: 'telegram', chatId: 'c1' }
    )

    expect(result).toContain('ok')
  })
})
