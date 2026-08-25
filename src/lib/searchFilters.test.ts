import { describe, expect, it } from 'vitest'
import { buildEffectiveQuery, type SelectedFilter } from './searchFilters'

function filter(dimension: SelectedFilter['dimension'], label: string, value: string): SelectedFilter {
  return { dimension, label, value, icon: '•' }
}

describe('buildEffectiveQuery', () => {
  it('joins topical filter terms with the typed query when there are no vibe filters', () => {
    const filters = [filter('language', 'Hindi', 'Hindi'), filter('category', 'Comedy', 'Comedy')]
    expect(buildEffectiveQuery('funny clips', filters)).toBe('Hindi Comedy funny clips')
  })

  it('falls back to just the typed query when there are no filters', () => {
    expect(buildEffectiveQuery('trending', [])).toBe('trending')
  })

  it('appends vibe terms last, after topical filters and the typed query', () => {
    const filters = [
      filter('vibe', 'Calm', 'relaxing'),
      filter('language', 'Hindi', 'Hindi'),
    ]
    expect(buildEffectiveQuery('songs', filters)).toBe('Hindi songs relaxing')
  })

  it('caps vibe terms at 2 regardless of how many are selected', () => {
    const filters = [
      filter('vibe', 'Happy', 'feel good'),
      filter('vibe', 'Study', 'study'),
      filter('vibe', 'Bedtime', 'bedtime'),
      filter('vibe', 'Party', 'party'),
    ]
    expect(buildEffectiveQuery('', filters)).toBe('feel good study')
  })

  it('does not let vibe alone dominate when combined with a typed query', () => {
    const filters = [filter('vibe', 'Focused', 'focus'), filter('vibe', 'Study', 'study')]
    expect(buildEffectiveQuery('react tutorial', filters)).toBe('react tutorial focus study')
  })
})
