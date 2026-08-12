import { useState } from 'react'
import {
  FILTER_TAXONOMY,
  dimensionItemCount,
  type FilterDimensionKey,
} from '../lib/filterTaxonomy'
import { isFilterSelected, type SelectedFilter } from '../lib/searchFilters'

interface FilterMenuProps {
  selected: SelectedFilter[]
  onToggle: (dimension: FilterDimensionKey, label: string, icon: string, group?: string) => void
}

const DIMENSION_ORDER: FilterDimensionKey[] = ['language', 'category', 'audience', 'channel']

export function FilterMenu({ selected, onToggle }: FilterMenuProps) {
  const [activeDim, setActiveDim] = useState<FilterDimensionKey>('category')
  const [activeGroup, setActiveGroup] = useState<string>('entertainment')

  const dim = FILTER_TAXONOMY[activeDim]

  const items =
    dim.type === 'grouped' ? dim.groups[activeGroup]?.items ?? [] : dim.items

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
            return (
              <button
                key={gKey}
                type="button"
                onClick={() => setActiveGroup(gKey)}
                className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                  isActive
                    ? 'border-amber-500/50 bg-amber-500/10 text-amber-100'
                    : 'border-white/10 bg-black/20 text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <span aria-hidden className="text-xs">
                  {g.icon}
                </span>
                {g.label}
                <span className="text-[10px] text-zinc-600">{g.items.length}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Item grid */}
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-6">
        {items.map((item) => {
          const active = isFilterSelected(selected, activeDim, item.label)
          return (
            <button
              key={item.label}
              type="button"
              onClick={() =>
                onToggle(
                  activeDim,
                  item.label,
                  item.icon,
                  dim.type === 'grouped' ? activeGroup : undefined,
                )
              }
              className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-center transition ${
                active
                  ? 'border-red-500/60 bg-red-500/15 text-white'
                  : 'border-white/10 bg-black/20 text-zinc-300 hover:border-white/20 hover:bg-white/[0.06]'
              }`}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-sm">
                {item.icon}
              </span>
              <span className="text-[11px] leading-tight">{item.label}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
