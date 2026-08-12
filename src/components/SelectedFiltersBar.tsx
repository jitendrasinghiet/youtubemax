import type { SelectedFilter } from '../lib/searchFilters'

interface SelectedFiltersBarProps {
  filters: SelectedFilter[]
  onRemove: (filter: SelectedFilter) => void
  onClearAll: () => void
  filtersOpen: boolean
  onToggleFilters: () => void
}

export function SelectedFiltersBar({
  filters,
  onRemove,
  onClearAll,
  filtersOpen,
  onToggleFilters,
}: SelectedFiltersBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2">
      <button
        type="button"
        onClick={onToggleFilters}
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
          filtersOpen
            ? 'border-red-500/50 bg-red-500/15 text-red-200'
            : 'border-white/10 bg-black/30 text-zinc-300 hover:border-white/20 hover:text-white'
        }`}
      >
        <span aria-hidden>🎛️</span>
        Filters
        {filters.length > 0 && (
          <span className="rounded-full bg-white/15 px-1.5 text-[10px] font-semibold">
            {filters.length}
          </span>
        )}
      </button>

      {filters.length === 0 ? (
        <span className="text-xs italic text-zinc-500">
          No filters applied — every search covers everything
        </span>
      ) : (
        <>
          <span className="text-xs text-zinc-500">applied to every search:</span>
          {filters.map((f) => (
            <span
              key={`${f.dimension}:${f.label}`}
              className="group inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 py-0.5 pl-1 pr-0.5 text-xs text-red-100"
              title={`${f.dimension}${f.group ? ` · ${f.group}` : ''}`}
            >
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/10 text-[10px] leading-none">
                {f.icon}
              </span>
              <span className="max-w-[9rem] truncate">{f.label}</span>
              <button
                type="button"
                onClick={() => onRemove(f)}
                className="flex h-4 w-4 items-center justify-center rounded-full text-red-300/80 transition hover:bg-red-500/30 hover:text-white"
                aria-label={`Remove ${f.label} filter`}
              >
                ×
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={onClearAll}
            className="text-xs text-zinc-500 transition hover:text-red-300"
          >
            Clear all
          </button>
        </>
      )}
    </div>
  )
}
