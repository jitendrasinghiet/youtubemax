/** Maps a Language filter's label (filterTaxonomy.ts's `language`
 *  dimension) to the hl (interface/relevance language) + gl (region)
 *  pair YouTube's own search actually understands -- a real API-level
 *  signal, not just another word mixed into the query text the way a
 *  selected filter's `value` already gets folded in (searchFilters.ts's
 *  buildEffectiveQuery). Reported directly wanting a selected language
 *  filter passed through to the search itself.
 *
 *  Several of these (Haryanvi, Bhojpuri) have no ISO 639-1 code YouTube
 *  recognizes as a distinct interface language -- falls back to Hindi's
 *  `hl` for those, since `gl: 'IN'` (present for every entry here) is
 *  the stronger, always-applicable part of the signal regardless of
 *  whether the specific `hl` value is one YouTube has real UI strings
 *  for. */
const LANGUAGE_TO_LOCALE: Record<string, { hl: string; gl: string }> = {
  Hindi: { hl: 'hi', gl: 'IN' },
  English: { hl: 'en', gl: 'US' },
  Tamil: { hl: 'ta', gl: 'IN' },
  Telugu: { hl: 'te', gl: 'IN' },
  Marathi: { hl: 'mr', gl: 'IN' },
  Bengali: { hl: 'bn', gl: 'IN' },
  Punjabi: { hl: 'pa', gl: 'IN' },
  Kannada: { hl: 'kn', gl: 'IN' },
  Malayalam: { hl: 'ml', gl: 'IN' },
  Urdu: { hl: 'ur', gl: 'IN' },
  Odia: { hl: 'or', gl: 'IN' },
  Assamese: { hl: 'as', gl: 'IN' },
  Haryanvi: { hl: 'hi', gl: 'IN' },
  Bhojpuri: { hl: 'hi', gl: 'IN' },
  Sanskrit: { hl: 'sa', gl: 'IN' },
}

/** The first selected `language` filter's locale, if any -- multiple
 *  language chips can be selected at once (it's a flat multi-select
 *  dimension, not a slider), but a single search can only carry one
 *  hl/gl pair, so the first one picked wins rather than guessing which
 *  of several to prefer. */
export function localeForFilters(filters: { dimension: string; label: string }[]): { hl: string; gl: string } | undefined {
  const languageFilter = filters.find((f) => f.dimension === 'language')
  if (!languageFilter) return undefined
  return LANGUAGE_TO_LOCALE[languageFilter.label]
}
