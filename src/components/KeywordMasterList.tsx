import type { MasterKeyword } from '../types'
import { parseSearchTerms } from '../lib/api'

const SOURCE_STYLES: Record<MasterKeyword['source'], string> = {
  title: 'border-red-500/40 bg-red-500/10 text-red-200',
  summary: 'border-amber-500/30 bg-amber-500/10 text-amber-100',
  transcript: 'border-zinc-600/50 bg-zinc-800/80 text-zinc-300',
}

interface KeywordMasterListProps {
  keywords: MasterKeyword[]
  activeVideoId?: string
  searchQuery: string
  onSelect: (term: string) => void
  onRemove: (term: string) => void
  onClear: () => void
}

export function KeywordMasterList({
  keywords,
  activeVideoId,
  searchQuery,
  onSelect,
  onRemove,
  onClear,
}: KeywordMasterListProps) {
  const activeTerms = parseSearchTerms(searchQuery)

  if (keywords.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-center text-sm text-zinc-500">
        Analyze a video to build a keyword master list from its transcript and summary.
      </div>
    )
  }

  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
            Keyword master list
          </h2>
          <p className="text-xs text-zinc-500">
            Click to add to search · accumulates across analyzed videos
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-zinc-500 transition hover:text-zinc-300"
        >
          Clear all
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {keywords.map((kw) => {
          const isInSearch = activeTerms.includes(kw.term.toLowerCase())
          const isFromActive = activeVideoId === kw.fromVideoId
          return (
            <span key={kw.term} className="group relative inline-flex">
              <button
                type="button"
                onClick={() => onSelect(kw.term)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${
                  isInSearch
                    ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-100 ring-1 ring-emerald-500/30'
                    : SOURCE_STYLES[kw.source]
                } ${isFromActive ? 'ring-1 ring-white/20' : ''}`}
                title={`From: ${kw.fromTitle}`}
              >
                <span>{kw.term}</span>
                {isFromActive && (
                  <span className="text-[10px] uppercase tracking-wide opacity-60">new</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => onRemove(kw.term)}
                className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-zinc-700 text-[10px] text-zinc-300 group-hover:flex"
                aria-label={`Remove ${kw.term}`}
              >
                ×
              </button>
            </span>
          )
        })}
      </div>
    </section>
  )
}
