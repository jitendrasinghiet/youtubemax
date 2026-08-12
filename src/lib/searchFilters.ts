import { FILTER_TAXONOMY, filterItemValue, type FilterDimensionKey } from './filterTaxonomy'

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

export function isFilterSelected(
  current: SelectedFilter[],
  dimension: FilterDimensionKey,
  label: string,
): boolean {
  return current.some((f) => f.dimension === dimension && f.label === label)
}

/**
 * Selected filters are implicitly folded into every search unless the user
 * removes the chip or clears all. This builds the actual string sent to the
 * search API: filter terms first (they act as a standing scope), then
 * whatever the user typed.
 */
export function buildEffectiveQuery(typedQuery: string, filters: SelectedFilter[]): string {
  const filterTerms = filters.map((f) => f.value).join(' ')
  return [filterTerms, typedQuery.trim()].filter(Boolean).join(' ').trim()
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
