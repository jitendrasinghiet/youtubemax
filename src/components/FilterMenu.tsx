import { useState } from 'react'
import {
  FILTER_TAXONOMY,
  dimensionItemCount,
  type FilterDimensionKey,
  type FilterItem,
} from '../lib/filterTaxonomy'
import { isEvergreenEligible, isFilterSelected, type SelectedFilter } from '../lib/searchFilters'

interface FilterMenuProps {
  selected: SelectedFilter[]
  onToggle: (dimension: FilterDimensionKey, label: string, icon: string, group?: string) => void
  onSelectEvergreen: (item: FilterItem) => void
}

// Audience leads the rail — "who" before "what," matching the funnel model
// (docs/FILTER_ROADMAP.md item 2). Category still opens by default below;
// this only changes tab order, not which tab is active on open.
const DIMENSION_ORDER: FilterDimensionKey[] = ['audience', 'category', 'language', 'channel']

export function FilterMenu({ selected, onToggle, onSelectEvergreen }: FilterMenuProps) {
  const [activeDim, setActiveDim] = useState<FilterDimensionKey>('category')
  // Evergreen renders first in the Category group rail (see filterTaxonomy.ts)
  // so it's the first thing shown when someone opens Category — the whole
  // point of one-tap combos is being seen before the manual browse groups.
  const [activeGroup, setActiveGroup] = useState<string>('evergreen')

  const dim = FILTER_TAXONOMY[activeDim]
  const isEvergreen = dim.type === 'grouped' && activeGroup === 'evergreen'

  const rawItems = dim.type === 'grouped' ? dim.groups[activeGroup]?.items ?? [] : dim.items
  const items = isEvergreen ? rawItems.filter((item) => isEvergreenEligible(item, selected)) : rawItems

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
              onClick={() => {
                setActiveDim(key)
                if (FILTER_TAXONOMY[key].type === 'grouped') {
                  setActiveGroup(Object.keys((FILTER_TAXONOMY[key] as { groups: object }).groups)[0])
                }
              }}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
                isActive
                  ? 'border-red-500/50 bg-red-500/15 text-white'
                  : 'border-white/10 bg-black/20 text-zinc-400 hover:border-white/20 hover:text-zinc-200'
              }`}
            >
              <span aria-hidden>{d.icon}</span>
              {d.label}
              <span className="rounded-full bg-white/10 px-1.5 text-[10px] text-zinc-400">
                {dimensionItemCount(d)}
              </span>
            </button>
          )
        })}
      </div>

      {/* Group sub-rail, only for the grouped Category dimension */}
      {dim.type === 'grouped' && (
        <div className="mb-3 flex gap-1.5 overflow-x-auto border-b border-white/10 pb-2">
          {Object.entries(dim.groups).map(([gKey, g]) => {
            const isActive = gKey === activeGroup
            const isEvergreenTab = gKey === 'evergreen'
            const count =
              isEvergreenTab && selected.length > 0
                ? g.items.filter((item) => isEvergreenEligible(item, selected)).length
                : g.items.length
            return (
              <button
                key={gKey}
                type="button"
                onClick={() => setActiveGroup(gKey)}
                className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                  isActive
                    ? isEvergreenTab
                      ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-100'
                      : 'border-amber-500/50 bg-amber-500/10 text-amber-100'
                    : 'border-white/10 bg-black/20 text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <span aria-hidden className="text-xs">
                  {g.icon}
                </span>
                {g.label}
                <span className="text-[10px] text-zinc-600">{count}</span>
              </button>
            )
          })}
        </div>
      )}

      {isEvergreen && items.length === 0 && (
        <div className="rounded-md border border-dashed border-white/10 bg-black/20 px-3 py-4 text-center text-[11px] text-zinc-500">
          No evergreen combos match your current filters — remove one to see more.
        </div>
      )}

      {/* Item grid */}
      <div className="grid grid-cols-4 gap-1 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
        {items.map((item) => {
          const active = isFilterSelected(selected, activeDim, item.label)
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                if (isEvergreen) {
                  onSelectEvergreen(item)
                } else {
                  onToggle(activeDim, item.label, item.icon, dim.type === 'grouped' ? activeGroup : undefined)
                }
              }}
              title={isEvergreen ? item.value ?? item.label : undefined}
              className={`flex flex-col items-center gap-0.5 rounded-md border px-1 py-1.5 text-center transition ${
                active
                  ? isEvergreen
                    ? 'border-emerald-500/60 bg-emerald-500/15 text-white'
                    : 'border-red-500/60 bg-red-500/15 text-white'
                  : 'border-white/10 bg-black/20 text-zinc-300 hover:border-white/20 hover:bg-white/[0.06]'
              }`}
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-[10px] leading-none">
                {item.icon}
              </span>
              <span className="line-clamp-2 text-[10px] leading-tight">{item.label}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
