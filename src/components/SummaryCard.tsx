interface SummaryCardProps {
  summary: string
}

export function SummaryCard({ summary }: SummaryCardProps) {
  return (
    <section className="rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-5">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">
        Quick summary
      </h2>
      <p className="text-base leading-relaxed text-zinc-200">{summary}</p>
      <p className="mt-3 text-xs text-zinc-500">
        Extractive summary from the video transcript — no external AI API required.
      </p>
    </section>
  )
}
