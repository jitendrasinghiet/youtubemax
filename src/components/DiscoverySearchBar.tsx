import { useEffect, useRef, useState } from 'react'
import { youtubeSearchUrl } from '../lib/api'

interface DiscoverySearchBarProps {
  query: string
  onQueryChange: (value: string) => void
  onSubmit: (query: string) => void
  loading: boolean
  isVoiceListening: boolean
  onToggleVoice: () => void
  history: string[]
  onHistorySelect: (query: string) => void
  onHistoryDelete: (query: string) => void
  onHistoryClear: () => void
  suggestions: string[]
  suggestionsLoading: boolean
  onSuggestionSelect: (query: string) => void
}

export function DiscoverySearchBar({
  query,
  onQueryChange,
  onSubmit,
  loading,
  isVoiceListening,
  onToggleVoice,
  history,
  onHistorySelect,
  onHistoryDelete,
  onHistoryClear,
  suggestions,
  suggestionsLoading,
  onSuggestionSelect,
}: DiscoverySearchBarProps) {
  const [showAssist, setShowAssist] = useState(false)
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (!wrapperRef.current?.contains(target)) {
        setShowAssist(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  const trimmedQuery = query.trim()
  const showHistoryAssist = showAssist && trimmedQuery.length === 0
  const showSuggestionAssist = showAssist && trimmedQuery.length > 0

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!loading) {
          setShowAssist(false)
          onSubmit(query.trim())
        }
      }}
      className="flex flex-col gap-2.5"
    >
      <div className="relative" ref={wrapperRef}>
        <div className="flex gap-2 sm:flex-row flex-col">
          <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onFocus={() => setShowAssist(true)}
            onClick={() => setShowAssist(true)}
            placeholder="Search YouTube for videos…"
            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-zinc-500 outline-none transition focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20"
            disabled={loading}
          />
          <button
            type="button"
            onClick={onToggleVoice}
            disabled={loading}
            className={`absolute right-10 top-1/2 -translate-y-1/2 text-sm transition ${
              isVoiceListening
                ? 'text-red-400 animate-pulse'
                : 'text-zinc-600 hover:text-zinc-400'
            }`}
            title="Voice search"
          >
            🎤
          </button>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 shrink-0"
          >
            {loading ? 'Searching…' : 'Search'}
          </button>
          {query.trim() && (
            <a
              href={youtubeSearchUrl(query)}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-400 transition hover:text-white hover:border-white/20 shrink-0"
            >
              YouTube
            </a>
          )}
        </div>

        {showHistoryAssist && history.length > 0 && (
          <div className="absolute z-20 mt-1.5 w-full rounded-lg border border-white/10 bg-zinc-950/95 p-2 shadow-2xl backdrop-blur">
            <div className="mb-2 flex items-center justify-between px-1">
              <div className="text-[11px] uppercase tracking-wide text-zinc-500">Recent searches</div>
              <button
                type="button"
                onClick={onHistoryClear}
                className="text-[11px] text-zinc-500 transition hover:text-red-300"
              >
                Clear all
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {history.map((item) => (
                <div
                  key={item}
                  className="inline-flex items-center overflow-hidden rounded-full border border-white/10 bg-white/5"
                >
                  <button
                    type="button"
                    onClick={() => {
                      onHistorySelect(item)
                      setShowAssist(false)
                    }}
                    className="px-2.5 py-1 text-xs text-zinc-300 transition hover:bg-white/10 hover:text-white"
                    title={`Search: ${item}`}
                  >
                    {item}
                  </button>
                  <button
                    type="button"
                    onClick={() => onHistoryDelete(item)}
                    className="border-l border-white/10 px-2 py-1 text-xs text-zinc-500 transition hover:bg-red-500/20 hover:text-red-300"
                    aria-label={`Delete ${item} from history`}
                    title="Delete from history"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {showSuggestionAssist && (
          <div className="absolute z-20 mt-1.5 w-full overflow-hidden rounded-lg border border-white/10 bg-zinc-950/95 shadow-2xl backdrop-blur">
            {suggestionsLoading ? (
              <div className="px-3 py-2 text-xs text-zinc-500">Loading suggestions…</div>
            ) : suggestions.length > 0 ? (
              <ul className="max-h-72 overflow-y-auto py-1">
                {suggestions.map((item) => (
                  <li key={item}>
                    <button
                      type="button"
                      onClick={() => {
                        onSuggestionSelect(item)
                        setShowAssist(false)
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-300 transition hover:bg-white/10 hover:text-white"
                    >
                      <span className="text-xs text-zinc-500">🔍</span>
                      <span>{item}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-3 py-2 text-xs text-zinc-500">No suggestions</div>
            )}
          </div>
        )}
      </div>
    </form>
  )
}
