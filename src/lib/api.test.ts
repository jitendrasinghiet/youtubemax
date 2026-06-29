import { describe, it, expect } from 'vitest'
import {
  parseSearchTerms,
  appendSearchTerm,
  removeSearchTerm,
} from './api'

describe('parseSearchTerms', () => {
  it('splits on whitespace and lowercases', () => {
    expect(parseSearchTerms('  Hello   World ')).toEqual(['hello', 'world'])
  })
  it('returns empty array for blank input', () => {
    expect(parseSearchTerms('   ')).toEqual([])
  })
})

describe('appendSearchTerm', () => {
  it('appends a new term', () => {
    expect(appendSearchTerm('react', 'hooks')).toBe('react hooks')
  })
  it('does not duplicate an existing term (case-insensitive)', () => {
    expect(appendSearchTerm('react hooks', 'Hooks')).toBe('react hooks')
  })
  it('handles empty base query', () => {
    expect(appendSearchTerm('', 'react')).toBe('react')
  })
  it('ignores empty term', () => {
    expect(appendSearchTerm('react', '   ')).toBe('react')
  })
})

describe('removeSearchTerm', () => {
  it('removes the matching term case-insensitively', () => {
    expect(removeSearchTerm('react hooks redux', 'Hooks')).toBe('react redux')
  })
  it('leaves query unchanged when term is absent', () => {
    expect(removeSearchTerm('react redux', 'vue')).toBe('react redux')
  })
})
