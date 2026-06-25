import { useState, type FormEvent } from 'react'

interface SearchBarProps {
  onSearch: (input: string) => void
  loading: boolean
  initialValue?: string
}

export function SearchBar({ onSearch, loading, initialValue = '' }: SearchBarProps) {
  const [value, setValue] = useState(initialValue)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!value.trim() || loading) return
    onSearch(value.trim())
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3 sm:flex-row">
      <div className="relative flex-1">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Paste YouTube URL or video ID…"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 pr-12 text-white placeholder:text-zinc-500 outline-none transition focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20"
          disabled={loading}
        />
        <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600">
          ▶
        </div>
      </div>
      <button
        type="submit"
        disabled={loading || !value.trim()}
        className="rounded-xl bg-red-600 px-6 py-3.5 font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50 sm:shrink-0"
      >
        {loading ? 'Analyzing…' : 'Analyze'}
      </button>
    </form>
  )
}
