import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { createExecTool } from '../src/tools/exec.js'
import { readFileTool } from '../src/tools/read-file.js'
import { writeFileTool } from '../src/tools/write-file.js'

async function setupWorkspace() {
  const root = await mkdtemp(join(tmpdir(), 'microclaw-workspace-'))
  const sibling = `${root}-outside`
  await writeFile(join(root, 'inside.txt'), 'safe', 'utf-8')
  await writeFile(sibling, 'outside', 'utf-8')
  return { root, sibling }
}

describe('tool safety guardrails', () => {
  it('blocks read_file outside workspace', async () => {
    const { root, sibling } = await setupWorkspace()

    const result = await readFileTool.execute(
      { path: sibling },
      { workspace: root, channel: 'telegram', chatId: 'c1' }
    )

    expect(result.startsWith('Error:')).toBe(true)
  })

  it('blocks write_file outside workspace', async () => {
    const { root, sibling } = await setupWorkspace()

    const result = await writeFileTool.execute(
      { path: sibling, content: 'new' },
      { workspace: root, channel: 'telegram', chatId: 'c1' }
    )

    expect(result.startsWith('Error:')).toBe(true)
  })

  it('blocks exec when working_dir is outside workspace', async () => {
    const { root } = await setupWorkspace()
    const execTool = createExecTool(5)

    const result = await execTool.execute(
      { command: 'pwd', working_dir: '/' },
      { workspace: root, channel: 'telegram', chatId: 'c1' }
    )

    expect(result).toContain('Error: working_dir must be inside workspace')
  })
})
