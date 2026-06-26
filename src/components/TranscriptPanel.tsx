import { useState } from 'react'
import type { TranscriptSegment } from '../types'
import { formatTimestamp } from '../lib/api'

interface TranscriptPanelProps {
  segments: TranscriptSegment[]
}

export function TranscriptPanel({ segments }: TranscriptPanelProps) {
  const [open, setOpen] = useState(false)

  if (segments.length === 0) return null

  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.03]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 hover:bg-white/[0.05] transition"
      >
        <span className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Transcript ({segments.length} segments)
        </span>
        <span className={`text-xs text-zinc-500 transition ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>
      {open && (
        <div className="max-h-80 overflow-y-auto border-t border-white/10 px-4 py-3">
          <ul className="flex flex-col gap-2">
            {segments.map((seg, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="shrink-0 font-mono text-xs tabular-nums text-zinc-500">
                  {formatTimestamp(seg.start)}
                </span>
                <span className="text-zinc-300">{seg.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
