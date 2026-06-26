import type { MasterKeyword } from '../types'
import { parseSearchTerms } from '../lib/api'

const SOURCE_STYLES: Record<MasterKeyword['source'], string> = {
  title: 'border-red-500/40 bg-red-500/10 text-red-200',
  chapter: 'border-indigo-500/40 bg-indigo-500/10 text-indigo-200',
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
      <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.02] px-3 py-4 text-center text-xs text-zinc-500">
        Analyze a video to build a keyword master list.
      </div>
    )
  }

  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Keywords
          </h2>
          <p className="text-[10px] text-zinc-500">
            · Click to filter · Toggle selected
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="text-[10px] text-zinc-500 transition hover:text-zinc-300"
        >
          Clear
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {keywords.map((kw) => {
          const isInSearch = activeTerms.includes(kw.term.toLowerCase())
          const isFromActive = activeVideoId === kw.fromVideoId
          return (
            <span key={kw.term} className="group relative inline-flex">
              <button
                type="button"
                onClick={() => onSelect(kw.term)}
                className={`inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-xs transition ${
                  isInSearch
                    ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-100 ring-1 ring-emerald-500/30'
                    : SOURCE_STYLES[kw.source]
                } ${isFromActive ? 'ring-1 ring-white/20' : ''}`}
                title={`From: ${kw.fromTitle}`}
              >
                <span>{kw.term}</span>
              </button>
              <button
                type="button"
                onClick={() => onRemove(kw.term)}
                className="absolute -right-1 -top-1 hidden h-3 w-3 items-center justify-center rounded-full bg-zinc-700 text-[8px] text-zinc-300 group-hover:flex"
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
