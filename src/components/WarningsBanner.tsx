interface WarningsBannerProps {
  warnings: string[]
}

export function WarningsBanner({ warnings }: WarningsBannerProps) {
  if (warnings.length === 0) return null

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
      <p className="mb-2 text-sm font-medium text-amber-200">Notes</p>
      <ul className="flex flex-col gap-1 text-sm text-amber-100/80">
        {warnings.map((w, i) => (
          <li key={i}>{w}</li>
        ))}
      </ul>
    </div>
  )
}
