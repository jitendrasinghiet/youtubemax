import { youtubeSearchUrl } from '../lib/api'

interface DiscoverySearchBarProps {
  query: string
  onQueryChange: (value: string) => void
  onSubmit: (query: string) => void
  loading: boolean
  isVoiceListening: boolean
  onToggleVoice: () => void
}

export function DiscoverySearchBar({
  query,
  onQueryChange,
  onSubmit,
  loading,
  isVoiceListening,
  onToggleVoice,
}: DiscoverySearchBarProps) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (query.trim() && !loading) {
          onSubmit(query.trim())
        }
      }}
      className="flex flex-col gap-2.5"
    >
      <div className="flex gap-2 sm:flex-row flex-col">
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
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
          disabled={loading || !query.trim()}
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
    </form>
  )
}
