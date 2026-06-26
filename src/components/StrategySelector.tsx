interface StrategySelectorProps {
  value: 'jdepoix' | 'direct' | 'proxy'
  onChange: (strategy: 'jdepoix' | 'direct' | 'proxy') => void
  disabled?: boolean
  usedStrategy?: 'jdepoix' | 'direct' | 'proxy'
  compact?: boolean
}

export function StrategySelector({
  value,
  onChange,
  disabled = false,
  usedStrategy,
  compact = false,
}: StrategySelectorProps) {
  const strategies: Array<{
    id: 'jdepoix' | 'direct' | 'proxy'
    label: string
    description: string
  }> = [
    {
      id: 'jdepoix',
      label: 'youtube-transcript',
      description: 'Fast HTML scraping (recommended - no proxy needed)',
    },
    {
      id: 'direct',
      label: 'Direct (InnerTube)',
      description: 'Browser headers only (faster if works)',
    },
    {
      id: 'proxy',
      label: 'Proxy (InnerTube)',
      description: 'Uses residential proxy (most reliable)',
    },
  ]

  if (compact) {
    // Compact horizontal layout for header
    return (
      <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-white/10 bg-white/[0.02]">
        <span className="text-xs font-medium text-zinc-400 shrink-0">Strategy:</span>
        <div className="flex gap-1">
          {strategies.map((strategy) => (
            <button
              key={strategy.id}
              onClick={() => onChange(strategy.id)}
              disabled={disabled}
              title={strategy.description}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                value === strategy.id
                  ? 'bg-red-500/20 border border-red-500 text-red-300'
                  : 'bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:border-white/20'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {strategy.label.split(' ')[0]}
            </button>
          ))}
        </div>
        {usedStrategy && (
          <span className="text-xs text-emerald-400 ml-1.5 shrink-0">✓ {usedStrategy}</span>
        )}
      </div>
    )
  }

  // Full layout for viewer tab
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="text-sm font-semibold text-white">Transcript Strategy</h3>
          <p className="text-xs text-zinc-400 mt-0.5">Choose how to fetch video transcripts</p>
        </div>
        {usedStrategy && (
          <span className="inline-block px-2.5 py-1 text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded">
            ✓ Using: {usedStrategy}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {strategies.map((strategy) => (
          <button
            key={strategy.id}
            onClick={() => onChange(strategy.id)}
            disabled={disabled}
            className={`p-2.5 rounded-lg text-left transition-colors ${
              value === strategy.id
                ? 'bg-red-500/20 border-2 border-red-500 text-white'
                : 'bg-white/5 border border-white/10 text-zinc-300 hover:text-white hover:border-white/20'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <div className="flex items-center gap-2">
              <input
                type="radio"
                name="strategy"
                value={strategy.id}
                checked={value === strategy.id}
                onChange={() => onChange(strategy.id)}
                disabled={disabled}
                className="w-4 h-4 accent-red-500"
              />
              <span className="text-sm font-medium text-white">{strategy.label}</span>
            </div>
            <p className="text-xs text-zinc-400 mt-1.5 ml-6">{strategy.description}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
