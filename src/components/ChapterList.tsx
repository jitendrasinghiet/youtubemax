import type { ReactNode } from 'react'
import type { Chapter } from '../types'
import { formatChapterRange } from '../lib/api'

interface ChapterListProps {
  chapters: Chapter[]
  allChapters: Chapter[]
  filteredCount: number
  allCount: number
  showFiltered: boolean
  onToggleFilter: () => void
  filterTerms: string[]
  activeStart: number
  onSelect: (start: number) => void
  clipMode: boolean
  clipIndex: number
  onPlayClips: () => void
  onStopClips: () => void
}

function highlightTerms(text: string, terms: string[]): ReactNode {
  if (!terms.length) return text
  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const parts = text.split(new RegExp(`(${escaped.join('|')})`, 'gi'))
  const lowerTerms = terms.map((t) => t.toLowerCase())
  return parts.map((part, i) =>
    lowerTerms.includes(part.toLowerCase()) ? (
      <mark key={i} className="rounded bg-yellow-500/30 px-0.5 text-yellow-200 not-italic">
        {part}
      </mark>
    ) : (
      part
    ),
  )
}

export function ChapterList({
  chapters,
  allChapters,
  filteredCount,
  allCount,
  showFiltered,
  onToggleFilter,
  filterTerms,
  activeStart,
  onSelect,
  clipMode,
  clipIndex,
  onPlayClips,
  onStopClips,
}: ChapterListProps) {
  if (chapters.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        {filteredCount < allCount && (
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
              Chapters{' '}
              <span className="text-xs font-normal normal-case text-zinc-500">
                {showFiltered ? `0 match` : `0 / ${allCount}`}
              </span>
            </h2>
            <button
              type="button"
              onClick={onToggleFilter}
              className="rounded-full bg-white/5 px-2 py-0.5 text-xs transition hover:bg-white/10"
            >
              {showFiltered ? `Show all (${allCount})` : `Filter (${filteredCount})`}
            </button>
          </div>
        )}
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-400">
          {showFiltered
            ? 'No chapters match the selected keywords.'
            : 'No chapters detected. Try a video with captions or timestamped description.'}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Chapters
          {showFiltered && filteredCount < allCount && (
            <span className="ml-2 text-xs font-normal normal-case text-zinc-500">
              {filteredCount} match
            </span>
          )}
        </h2>
        <div className="flex items-center gap-2">
          {filteredCount < allCount && (
            <button
              type="button"
              onClick={onToggleFilter}
              className="rounded-full bg-white/5 px-2.5 py-0.5 text-xs transition hover:bg-white/10"
            >
              {showFiltered ? `Show all (${allCount})` : `Filter (${filteredCount})`}
            </button>
          )}
          {chapters.length > 1 &&
            (clipMode ? (
              <button
                type="button"
                onClick={onStopClips}
                className="flex items-center gap-1.5 rounded-full bg-red-500/15 px-3 py-1 text-xs text-red-300 ring-1 ring-red-500/30 transition hover:bg-red-500/25"
              >
                ⏹ Stop
              </button>
            ) : (
              <button
                type="button"
                onClick={onPlayClips}
                className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs text-emerald-300 ring-1 ring-emerald-500/30 transition hover:bg-emerald-500/25"
              >
                ▶ Play clips
              </button>
            ))}
        </div>
      </div>
      <ul className="flex flex-col gap-1">
        {chapters.map((chapter, i) => {
          const isActive = activeStart === chapter.start
          const isClipActive = clipMode && clipIndex === i
          // Find next chapter from ALL chapters for consistent duration calculation
          const nextChapterInAll = allChapters.find((c) => c.start > chapter.start)
          const timeRange = formatChapterRange(chapter.start, nextChapterInAll?.start, true)
          return (
            <li key={`${chapter.start}-${i}`}>
              <button
                type="button"
                onClick={() => onSelect(chapter.start)}
                className={`group flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                  isClipActive
                    ? 'bg-emerald-500/15 text-white ring-1 ring-emerald-500/30'
                    : isActive
                      ? 'bg-red-500/15 text-white ring-1 ring-red-500/30'
                      : 'text-zinc-300 hover:bg-white/5 hover:text-white'
                }`}
              >
              <div className="flex flex-col gap-1">
                <span
                  className={`font-mono text-xs tabular-nums leading-snug ${
                    isClipActive
                      ? 'text-emerald-400'
                      : isActive
                        ? 'text-red-400'
                        : 'text-zinc-500 group-hover:text-red-400'
                  }`}
                >
                  {timeRange}
                </span>
                <span className="text-sm leading-snug">
                  {highlightTerms(chapter.title, filterTerms)}
                </span>
              </div>
                {isClipActive && (
                  <span className="ml-auto shrink-0 animate-pulse text-xs text-emerald-400">
                    ▶
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
