import { useState } from 'react'
import {
  FILTER_TAXONOMY,
  dimensionItemCount,
  filterItemValue,
  type FilterDimensionKey,
  type FilterGroup,
  type FilterItem,
} from '../lib/filterTaxonomy'
import { isEvergreenEligible, isFilterSelected, type SelectedFilter } from '../lib/searchFilters'

interface FilterMenuProps {
  selected: SelectedFilter[]
  onToggle: (dimension: FilterDimensionKey, label: string, icon: string, group?: string) => void
  onSelectEvergreen: (item: FilterItem) => void
  onToggleSlider: (dimension: FilterDimensionKey, group: string, item: FilterItem) => void
  /** How many cached videos match each filter value -- see src/lib/api.ts's
   *  fetchFacetCounts. Keyed by filterItemValue(item), not the label (the
   *  two differ for some items -- e.g. Era's "2010s" is both, but a few
   *  items send a different search term than what's shown). Missing/empty
   *  while the first fetch is in flight -- chips render without a count
   *  rather than a misleading "0" in that window. */
  facetCounts: Record<string, number>
}

/** A small "(N)" badge next to a chip's label -- omitted (not "(0)") while
 *  counts haven't loaded yet, since undefined at this point means "not
 *  fetched," not "zero matches." */
function CountBadge({ count }: { count: number | undefined }) {
  if (count === undefined) return null
  return <span className="text-[9px] text-zinc-500">({count})</span>
}

// Audience leads the rail — "who" before "what," matching the funnel model
// (docs/FILTER_ROADMAP.md item 2). Vibe (mood/context) leads even further —
// it's the one dimension built for someone who can't read the others.
const DIMENSION_ORDER: FilterDimensionKey[] = ['vibe', 'audience', 'category', 'language', 'channel']

function ItemChip({
  item,
  active,
  onClick,
  accent = 'red',
  count,
}: {
  item: FilterItem
  active: boolean
  onClick: () => void
  accent?: 'red' | 'emerald'
  count?: number
}) {
  const activeClass =
    accent === 'emerald' ? 'border-emerald-500/60 bg-emerald-500/15 text-white' : 'border-red-500/60 bg-red-500/15 text-white'
  return (
    <button
      type="button"
      onClick={onClick}
      title={accent === 'emerald' ? item.value ?? item.label : undefined}
      className={`flex flex-col items-center gap-0.5 rounded-md border px-1 py-1.5 text-center transition ${
        active ? activeClass : 'border-white/10 bg-black/20 text-zinc-300 hover:border-white/20 hover:bg-white/[0.06]'
      }`}
    >
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-[10px] leading-none">
        {item.icon}
      </span>
      <span className="line-clamp-2 text-[10px] leading-tight">{item.label}</span>
      <CountBadge count={count} />
    </button>
  )
}

// Bigger tap targets than the standard ItemChip — Vibe is built for people
// who can't read the rest of this menu, so the emoji does the work and the
// hit area is generous (roughly 64px, near the common child/motor-impaired
// touch-target minimum) rather than the dense grid used everywhere else.
function VibeChip({
  item,
  active,
  onClick,
  count,
}: {
  item: FilterItem
  active: boolean
  onClick: () => void
  count?: number
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-center transition ${
        active
          ? 'border-red-500/60 bg-red-500/15 text-white'
          : 'border-white/10 bg-black/20 text-zinc-300 hover:border-white/20 hover:bg-white/[0.06]'
      }`}
    >
      <span className="text-2xl leading-none" aria-hidden>
        {item.icon}
      </span>
      <span className="text-[11px] font-medium leading-tight">{item.label}</span>
      <CountBadge count={count} />
    </button>
  )
}

function SliderRow({
  label,
  items,
  groupKey,
  dimension,
  selected,
  onToggleSlider,
  facetCounts,
}: {
  label: string
  items: FilterItem[]
  groupKey: string
  dimension: FilterDimensionKey
  selected: SelectedFilter[]
  onToggleSlider: FilterMenuProps['onToggleSlider']
  facetCounts: Record<string, number>
}) {
  return (
    <div className="mb-3">
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {items.map((item) => {
          const active = selected.some((f) => f.dimension === dimension && f.group === groupKey && f.label === item.label)
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => onToggleSlider(dimension, groupKey, item)}
              className={`flex shrink-0 flex-col items-center gap-0.5 rounded-md border px-2.5 py-1.5 text-center transition ${
                active
                  ? 'border-sky-500/60 bg-sky-500/15 text-white'
                  : 'border-white/10 bg-black/20 text-zinc-300 hover:border-white/20 hover:bg-white/[0.06]'
              }`}
            >
              <span className="text-[10px] font-semibold leading-none">{item.icon}</span>
              <span className="text-[9px] leading-tight text-zinc-400">{item.label}</span>
              <CountBadge count={facetCounts[filterItemValue(item)]} />
            </button>
          )
        })}
      </div>
    </div>
  )
}

function CategoryGroupSection({
  groupKey,
  group,
  selected,
  onToggle,
  onSelectEvergreen,
  onToggleSlider,
  expanded,
  onToggleExpanded,
  facetCounts,
}: {
  groupKey: string
  group: FilterGroup
  selected: SelectedFilter[]
  onToggle: FilterMenuProps['onToggle']
  onSelectEvergreen: FilterMenuProps['onSelectEvergreen']
  onToggleSlider: FilterMenuProps['onToggleSlider']
  expanded: boolean
  onToggleExpanded: () => void
  facetCounts: Record<string, number>
}) {
  const isEvergreen = groupKey === 'evergreen'
  const rawItems = group.items
  const eligible = isEvergreen ? rawItems.filter((item) => isEvergreenEligible(item, selected)) : rawItems
  const eligibleLabels = new Set(eligible.map((i) => i.label))

  // Cluster coverage is validated in dev (validateClusterCoverage), so this
  // fallback should stay empty in practice — it exists as a safety net, not
  // an expected code path.
  const clusteredLabels = new Set((group.clusters ?? []).flatMap((c) => c.itemLabels))
  const unclustered = rawItems.filter((i) => !clusteredLabels.has(i.label) && eligibleLabels.has(i.label))

  const count = isEvergreen && selected.length > 0 ? eligible.length : rawItems.length + (group.sliderItems?.length ?? 0)

  return (
    <div className="rounded-md border border-white/10">
      <button
        type="button"
        onClick={onToggleExpanded}
        className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs font-medium transition ${
          isEvergreen ? 'text-emerald-100' : 'text-zinc-200'
        } ${expanded ? 'bg-white/[0.04]' : 'hover:bg-white/[0.03]'}`}
      >
        <span aria-hidden>{group.icon}</span>
        <span className="flex-1">{group.label}</span>
        <span className="rounded-full bg-white/10 px-1.5 text-[10px] text-zinc-400">{count}</span>
        <span className="text-zinc-500">{expanded ? '−' : '+'}</span>
      </button>

      {expanded && (
        <div className="border-t border-white/10 px-2.5 py-2.5">
          {group.sliderItems && group.sliderItems.length > 0 && (
            <SliderRow
              label={group.label === 'Education' ? 'Grade' : group.label}
              items={group.sliderItems}
              groupKey={groupKey}
              dimension="category"
              selected={selected}
              onToggleSlider={onToggleSlider}
              facetCounts={facetCounts}
            />
          )}

          {isEvergreen && eligible.length === 0 && (
            <div className="rounded-md border border-dashed border-white/10 bg-black/20 px-3 py-4 text-center text-[11px] text-zinc-500">
              No evergreen combos match your current filters — remove one to see more.
            </div>
          )}

          {(group.clusters ?? []).map((cluster) => {
            const items = cluster.itemLabels
              .map((label) => rawItems.find((i) => i.label === label))
              .filter((i): i is FilterItem => !!i && eligibleLabels.has(i.label))
            if (items.length === 0) return null
            return (
              <div key={cluster.label} className="mb-2.5 last:mb-0">
                <div className="mb-1 text-[10px] font-medium text-zinc-500">{cluster.label}</div>
                <div className="grid grid-cols-4 gap-1 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
                  {items.map((item) => (
                    <ItemChip
                      key={item.label}
                      item={item}
                      accent={isEvergreen ? 'emerald' : 'red'}
                      active={isFilterSelected(selected, 'category', item.label)}
                      onClick={() =>
                        isEvergreen ? onSelectEvergreen(item) : onToggle('category', item.label, item.icon, groupKey)
                      }
                      count={facetCounts[filterItemValue(item)]}
                    />
                  ))}
                </div>
              </div>
            )
          })}

          {unclustered.length > 0 && (
            <div className="grid grid-cols-4 gap-1 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
              {unclustered.map((item) => (
                <ItemChip
                  key={item.label}
                  item={item}
                  accent={isEvergreen ? 'emerald' : 'red'}
                  active={isFilterSelected(selected, 'category', item.label)}
                  onClick={() => (isEvergreen ? onSelectEvergreen(item) : onToggle('category', item.label, item.icon, groupKey))}
                  count={facetCounts[filterItemValue(item)]}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function FilterMenu({ selected, onToggle, onSelectEvergreen, onToggleSlider, facetCounts }: FilterMenuProps) {
  const [activeDim, setActiveDim] = useState<FilterDimensionKey>('category')
  // Evergreen open by default — the whole point of one-tap combos is being
  // seen before the manual browse groups, and single-view means everything
  // else is still one tap away below it rather than hidden behind a tab.
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['evergreen']))

  const dim = FILTER_TAXONOMY[activeDim]

  const toggleExpanded = (groupKey: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupKey)) next.delete(groupKey)
      else next.add(groupKey)
      return next
    })
  }

  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
      {/* Dimension rail */}
      <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
        {DIMENSION_ORDER.map((key) => {
          const d = FILTER_TAXONOMY[key]
          const isActive = key === activeDim
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveDim(key)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
                isActive
                  ? 'border-red-500/50 bg-red-500/15 text-white'
                  : 'border-white/10 bg-black/20 text-zinc-400 hover:border-white/20 hover:text-zinc-200'
              }`}
            >
              <span aria-hidden>{d.icon}</span>
              {d.label}
              <span className="rounded-full bg-white/10 px-1.5 text-[10px] text-zinc-400">{dimensionItemCount(d)}</span>
            </button>
          )
        })}
      </div>

      {/* Category: single-view accordion — every sub-category visible at
          once as an expand/collapse section, not a group of tabs. */}
      {dim.type === 'grouped' && activeDim === 'category' && (
        <div className="flex flex-col gap-1.5">
          {Object.entries(dim.groups).map(([groupKey, group]) => (
            <CategoryGroupSection
              key={groupKey}
              groupKey={groupKey}
              group={group}
              selected={selected}
              onToggle={onToggle}
              onSelectEvergreen={onSelectEvergreen}
              onToggleSlider={onToggleSlider}
              expanded={expandedGroups.has(groupKey)}
              onToggleExpanded={() => toggleExpanded(groupKey)}
              facetCounts={facetCounts}
            />
          ))}
        </div>
      )}

      {/* Vibe: two small always-open groups (Mood, Context), big tap
          targets, no accordion/eligibility logic — this dimension is
          deliberately the simplest thing in the menu. */}
      {dim.type === 'grouped' && activeDim === 'vibe' && (
        <div className="flex flex-col gap-3">
          {Object.entries(dim.groups).map(([groupKey, group]) => (
            <div key={groupKey}>
              <div className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                <span aria-hidden>{group.icon}</span>
                {group.label}
              </div>
              <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6 md:grid-cols-8">
                {group.items.map((item) => (
                  <VibeChip
                    key={item.label}
                    item={item}
                    active={isFilterSelected(selected, 'vibe', item.label)}
                    onClick={() => onToggle('vibe', item.label, item.icon, groupKey)}
                    count={facetCounts[filterItemValue(item)]}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Language / Audience / Channel: unchanged flat grid. */}
      {dim.type === 'flat' && (
        <div className="grid grid-cols-4 gap-1 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
          {dim.items.map((item) => (
            <ItemChip
              key={item.label}
              item={item}
              active={isFilterSelected(selected, activeDim, item.label)}
              onClick={() => onToggle(activeDim, item.label, item.icon)}
              count={facetCounts[filterItemValue(item)]}
            />
          ))}
        </div>
      )}
    </section>
  )
}
