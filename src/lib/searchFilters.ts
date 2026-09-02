import { FILTER_TAXONOMY, filterItemValue, type FilterDimensionKey, type FilterItem } from './filterTaxonomy'

export interface SelectedFilter {
  dimension: FilterDimensionKey
  /** Only set when the dimension is grouped (currently just `category`). */
  group?: string
  /** Matches FilterItem.label — used as the identity for toggling on/off. */
  label: string
  value: string
  icon: string
}

export const SELECTED_FILTERS_KEY = 'youtubemax.selectedFilters'

export function filterKey(f: Pick<SelectedFilter, 'dimension' | 'label'>): string {
  return `${f.dimension}:${f.label}`
}

export function toggleFilter(
  current: SelectedFilter[],
  next: SelectedFilter,
): SelectedFilter[] {
  const exists = current.some((f) => filterKey(f) === filterKey(next))
  if (exists) {
    return current.filter((f) => filterKey(f) !== filterKey(next))
  }
  return [...current, next]
}

export function removeFilter(
  current: SelectedFilter[],
  target: Pick<SelectedFilter, 'dimension' | 'label'>,
): SelectedFilter[] {
  return current.filter((f) => filterKey(f) !== filterKey(target))
}

/**
 * For slider groups (Era, Grade): unlike normal chip toggling, a slider
 * represents one point on a scale, so selecting a new value replaces
 * whatever was previously selected in that same group rather than adding
 * alongside it. Selecting the currently-selected value again clears it.
 */
export function toggleSliderFilter(current: SelectedFilter[], next: SelectedFilter): SelectedFilter[] {
  const alreadySelected = current.some(
    (f) => f.dimension === next.dimension && f.group === next.group && f.label === next.label,
  )
  const withoutGroup = current.filter((f) => !(f.dimension === next.dimension && f.group === next.group))
  return alreadySelected ? withoutGroup : [...withoutGroup, next]
}

/** Build a SelectedFilter from a slider group's FilterItem (Era, Grade). */
export function makeSliderFilter(dimension: FilterDimensionKey, group: string, item: FilterItem): SelectedFilter {
  return { dimension, group, label: item.label, icon: item.icon, value: filterItemValue(item) }
}

export function isFilterSelected(
  current: SelectedFilter[],
  dimension: FilterDimensionKey,
  label: string,
): boolean {
  return current.some((f) => f.dimension === dimension && f.label === label)
}

/** Vibe (mood/context) terms are soft nudges, never search-narrowing
 * criteria — capped regardless of how many are selected. */
const MAX_VIBE_TERMS = 2

/**
 * Selected filters are implicitly folded into every search unless the user
 * removes the chip or clears all. This builds the actual string sent to the
 * search API: topical filter terms first (they act as a standing scope),
 * then whatever the user typed, then — last, and capped at MAX_VIBE_TERMS —
 * any selected Vibe (mood/context) terms.
 *
 * Vibe is deliberately excluded from the plain concatenation the other
 * dimensions use. Tapping several mood/context icons at once is a normal,
 * expected interaction for the audience Vibe is built for (see
 * filterTaxonomy.ts), but literally appending every one of those terms to
 * the query would over-narrow it and quietly filter out otherwise-good
 * results — the cap plus "last, not first" ordering keeps Vibe acting as a
 * gentle bias on top of the real search, never the thing that defines it.
 */
/** A grouped-dimension filter's parent group label (e.g. selecting the
 *  "Bhajan" item under Category's "devotional" group also surfaces the
 *  group's own display label, "Devotional") -- extra disambiguating
 *  context pulled from the taxonomy itself ("master data"), not just the
 *  one term the selected leaf item carries. Reported directly wanting
 *  richer context for search disambiguation, not only the literal chip
 *  clicked. */
function groupLabelFor(filter: SelectedFilter): string | null {
  if (!filter.group) return null
  const dim = FILTER_TAXONOMY[filter.dimension]
  if (dim.type !== 'grouped') return null
  return dim.groups[filter.group]?.label ?? null
}

export function buildEffectiveQuery(typedQuery: string, filters: SelectedFilter[]): string {
  const topical = filters.filter((f) => f.dimension !== 'vibe')
  const vibe = filters.filter((f) => f.dimension === 'vibe')

  const groupTerms = [...new Set(topical.map(groupLabelFor).filter((g): g is string => g !== null))]
  const topicalTerms = [...topical.map((f) => f.value), ...groupTerms].join(' ')
  const vibeTerms = vibe.slice(0, MAX_VIBE_TERMS).map((f) => f.value).join(' ')

  return [topicalTerms, typedQuery.trim(), vibeTerms].filter(Boolean).join(' ').trim()
}

export function loadStoredFilters(): SelectedFilter[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(SELECTED_FILTERS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (f): f is SelectedFilter =>
        f && typeof f === 'object' && typeof f.dimension === 'string' && typeof f.label === 'string',
    )
  } catch {
    return []
  }
}

export function persistFilters(filters: SelectedFilter[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(SELECTED_FILTERS_KEY, JSON.stringify(filters))
}

/** Build a SelectedFilter from a taxonomy leaf item. */
export function makeSelectedFilter(
  dimension: FilterDimensionKey,
  label: string,
  icon: string,
  group?: string,
): SelectedFilter {
  const dim = FILTER_TAXONOMY[dimension]
  const item =
    dim.type === 'grouped' && group
      ? dim.groups[group]?.items.find((i) => i.label === label)
      : dim.type === 'flat'
        ? dim.items.find((i) => i.label === label)
        : undefined

  return {
    dimension,
    group,
    label,
    icon,
    value: item ? filterItemValue(item) : label,
  }
}

/**
 * Evergreen items are hidden (not just disabled) once they conflict with a
 * filter already selected in another dimension. "Agnostic" (no tag for that
 * dimension) always passes; a populated tag list must overlap the current
 * selection to remain eligible. Evergreen's own group is excluded from the
 * category check so combos never hide each other.
 */
export function isEvergreenEligible(item: FilterItem, selected: SelectedFilter[]): boolean {
  const implied = item.impliedFilters

  const selLanguage = selected.filter((f) => f.dimension === 'language')
  if (selLanguage.length > 0) {
    const tags = implied?.language ?? []
    if (tags.length > 0 && !tags.some((t) => selLanguage.some((s) => s.label === t))) return false
  }

  const selAudience = selected.filter((f) => f.dimension === 'audience')
  if (selAudience.length > 0) {
    const tags = implied?.audience ?? []
    if (tags.length > 0 && !tags.some((t) => selAudience.some((s) => s.label === t))) return false
  }

  const selChannel = selected.filter((f) => f.dimension === 'channel')
  if (selChannel.length > 0) {
    const tags = implied?.channel ?? []
    if (tags.length > 0 && !tags.some((t) => selChannel.some((s) => s.label === t))) return false
  }

  // 'evergreen' excluded so combos never hide each other; 'era' excluded
  // because Era is deliberately not a filter-criteria dimension — an Era
  // selection should never narrow which Evergreen combos are eligible (see
  // FilterGroup.sliderItems doc comment in filterTaxonomy.ts).
  const selCategory = selected.filter(
    (f) => f.dimension === 'category' && f.group !== 'evergreen' && f.group !== 'era',
  )
  if (selCategory.length > 0) {
    const tags = implied?.category ?? []
    if (
      tags.length > 0 &&
      !tags.some((t) => selCategory.some((s) => s.label === t.label && s.group === t.group))
    )
      return false
  }

  return true
}

function lookupFlatItem(dimension: 'language' | 'audience' | 'channel', label: string): FilterItem | undefined {
  const dim = FILTER_TAXONOMY[dimension]
  return dim.type === 'flat' ? dim.items.find((i) => i.label === label) : undefined
}

function lookupCategoryItem(group: string, label: string): FilterItem | undefined {
  const cat = FILTER_TAXONOMY.category
  return cat.type === 'grouped' ? cat.groups[group]?.items.find((i) => i.label === label) : undefined
}

/**
 * Selecting an Evergreen item adds its own chip, then — for each dimension
 * the user hasn't touched yet — adds ALL of that item's implied tags as
 * independent, individually removable chips (fill-all, not fill-first).
 * Toggling the combo back off only removes the combo's own chip; auto-filled
 * chips are left in place (no cascade-delete), and vice versa.
 */
export function applyEvergreenSelection(current: SelectedFilter[], item: FilterItem): SelectedFilter[] {
  const alreadySelected = current.some(
    (f) => f.dimension === 'category' && f.group === 'evergreen' && f.label === item.label,
  )
  if (alreadySelected) {
    return current.filter((f) => !(f.dimension === 'category' && f.group === 'evergreen' && f.label === item.label))
  }

  const next: SelectedFilter[] = [
    ...current,
    {
      dimension: 'category',
      group: 'evergreen',
      label: item.label,
      icon: item.icon,
      value: filterItemValue(item),
    },
  ]

  const implied = item.impliedFilters
  if (!implied) return next

  if (implied.language && !next.some((f) => f.dimension === 'language')) {
    for (const label of implied.language) {
      const src = lookupFlatItem('language', label)
      if (src) next.push({ dimension: 'language', label: src.label, icon: src.icon, value: filterItemValue(src) })
    }
  }

  if (implied.audience && !next.some((f) => f.dimension === 'audience')) {
    for (const label of implied.audience) {
      const src = lookupFlatItem('audience', label)
      if (src) next.push({ dimension: 'audience', label: src.label, icon: src.icon, value: filterItemValue(src) })
    }
  }

  if (implied.channel && !next.some((f) => f.dimension === 'channel')) {
    for (const label of implied.channel) {
      const src = lookupFlatItem('channel', label)
      if (src) next.push({ dimension: 'channel', label: src.label, icon: src.icon, value: filterItemValue(src) })
    }
  }

  if (implied.category && !next.some((f) => f.dimension === 'category' && f.group !== 'evergreen')) {
    for (const ref of implied.category) {
      const src = lookupCategoryItem(ref.group, ref.label)
      if (src) {
        next.push({
          dimension: 'category',
          group: ref.group,
          label: src.label,
          icon: src.icon,
          value: filterItemValue(src),
        })
      }
    }
  }

  return next
}
