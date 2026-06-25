import type { Chapter } from '../types'
import { formatTimestamp } from '../lib/api'

interface ChapterListProps {
  chapters: Chapter[]
  activeStart: number
  onSelect: (start: number) => void
}

const SOURCE_LABEL: Record<Chapter['source'], string> = {
  description: 'From description',
  transcript: 'Auto-generated',
  api: 'YouTube API',
}

export function ChapterList({ chapters, activeStart, onSelect }: ChapterListProps) {
  if (chapters.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-400">
        No chapters detected. Try a video with captions or timestamped description.
      </div>
    )
  }

  const source = chapters[0]?.source

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Chapters
        </h2>
        {source && (
          <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-zinc-500">
            {SOURCE_LABEL[source]}
          </span>
        )}
      </div>
      <ul className="flex flex-col gap-1">
        {chapters.map((chapter, i) => {
          const isActive = activeStart === chapter.start
          return (
            <li key={`${chapter.start}-${i}`}>
              <button
                type="button"
                onClick={() => onSelect(chapter.start)}
                className={`group flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                  isActive
                    ? 'bg-red-500/15 text-white ring-1 ring-red-500/30'
                    : 'text-zinc-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span
                  className={`shrink-0 font-mono text-xs tabular-nums ${
                    isActive ? 'text-red-400' : 'text-zinc-500 group-hover:text-red-400'
                  }`}
                >
                  {formatTimestamp(chapter.start)}
                </span>
                <span className="text-sm leading-snug">{chapter.title}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
