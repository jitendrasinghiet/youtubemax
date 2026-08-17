import { formatViewCount } from '../lib/api'
import type { PlaylistSection } from '../types'

interface PlaylistSectionsProps {
  sections: PlaylistSection[]
  loading: boolean
  onSelectVideo: (videoId: string, playlistId: string) => void
}

export function PlaylistSections({ sections, loading, onSelectVideo }: PlaylistSectionsProps) {
  return (
    <div className="flex flex-col gap-4">
      {sections.map((section) => (
        <div
          key={section.playlistId}
          className="rounded-xl border border-white/10 bg-white/[0.02] p-3"
        >
          <div className="mb-2 flex items-center gap-2">
            <span>{section.icon}</span>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
              {section.label}
            </h3>
            {loading && (
              <span className="text-[10px] text-zinc-500">loading…</span>
            )}
          </div>

          {section.warning && (
            <p className="mb-2 text-xs text-yellow-300/80">{section.warning}</p>
          )}

          {section.results.length === 0 && !loading && !section.warning && (
            <p className="text-xs text-zinc-500">No items in this playlist right now.</p>
          )}

          {section.results.length > 0 && (
            <div className="flex gap-3 overflow-x-auto pb-1">
              {section.results.map((video) => (
                <button
                  key={video.videoId}
                  type="button"
                  onClick={() => onSelectVideo(video.videoId, section.playlistId)}
                  className="group w-40 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black/20 text-left transition hover:border-red-500/30 hover:bg-white/5"
                >
                  <img src={video.thumbnail} alt="" className="h-24 w-full object-cover" />
                  <div className="p-2">
                    <p className="line-clamp-2 text-[11px] font-medium text-white group-hover:text-red-200">
                      {video.title}
                    </p>
                    <p className="mt-1 text-[10px] text-zinc-500">{video.channel}</p>
                    {video.viewCount && (
                      <p className="mt-0.5 text-[10px] text-zinc-600">
                        {formatViewCount(video.viewCount)}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
