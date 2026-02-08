import { describe, expect, it } from 'vitest'

import { chunkText } from '../src/core/text-chunk.js'

describe('chunkText', () => {
  it('throws when maxLen is zero', () => {
    expect(() => chunkText('hello', 0)).toThrow('maxLen must be greater than zero')
  })

  it('throws when maxLen is negative', () => {
    expect(() => chunkText('hello', -1)).toThrow('maxLen must be greater than zero')
  })

  it('returns single chunk for text within limit', () => {
    expect(chunkText('hello', 10)).toEqual(['hello'])
  })

  it('splits text at newline boundaries', () => {
    const result = chunkText('line1\nline2\nline3', 11)
    expect(result.length).toBeGreaterThanOrEqual(2)
    expect(result.join('\n')).toContain('line1')
  })
})
