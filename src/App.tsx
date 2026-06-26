import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChapterList } from './components/ChapterList'
import { KeywordMasterList } from './components/KeywordMasterList'
import { SearchBar } from './components/SearchBar'
import { SummaryCard } from './components/SummaryCard'
import { TranscriptPanel } from './components/TranscriptPanel'
import { VideoPlayer } from './components/VideoPlayer'
import { WarningsBanner } from './components/WarningsBanner'
import { useKeywordMasterList } from './hooks/useKeywordMasterList'
import { analyzeVideo, appendSearchTerm, parseSearchTerms, removeSearchTerm, searchVideos, formatViewCount, youtubeSearchUrl } from './lib/api'
import type { AnalyzeResult, SearchResultItem } from './types'

function App() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AnalyzeResult | null>(null)
  const [playStart, setPlayStart] = useState(0)
  const [clipMode, setClipMode] = useState(false)
  const [clipIndex, setClipIndex] = useState(0)
  const clipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [showFilteredChapters, setShowFilteredChapters] = useState(false)
  const [activeTab, setActiveTab] = useState<'discovery' | 'viewer'>('discovery')
  const [showSummary, setShowSummary] = useState(true)
  const [showTranscript, setShowTranscript] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [searchSoftWarning, setSearchSoftWarning] = useState<string | null>(null)
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([])

  const {
    keywords: masterKeywords,
    ingestFromAnalysis,
    removeKeyword,
    clearKeywords,
  } = useKeywordMasterList()

  const runAnalysis = useCallback(
    async (input: string) => {
      setLoading(true)
      setError(null)
      setResult(null)
      setPlayStart(0)
      setActiveTab('viewer')

      try {
        const data = await analyzeVideo(input)
        setResult(data)
        ingestFromAnalysis(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      } finally {
        setLoading(false)
      }
    },
    [ingestFromAnalysis],
  )

  const handleVideoSearch = useCallback(async (input: string) => {
    setSearchLoading(true)
    setSearchError(null)
    setSearchSoftWarning(null)
    setSearchResults([])

    try {
      const { results, warning } = await searchVideos(input)
      setSearchResults(results)
      if (warning) setSearchSoftWarning(warning)
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setSearchLoading(false)
    }
  }, [])

  const handleKeywordSelect = useCallback((term: string) => {
    setSearchQuery((prev) => {
      const terms = parseSearchTerms(prev)
      if (terms.includes(term.toLowerCase())) {
        return removeSearchTerm(prev, term)
      }
      return appendSearchTerm(prev, term)
    })
  }, [])

  const handleSearchFromDiscovery = useCallback(
    (query: string) => {
      setSearchQuery(query)
      handleVideoSearch(query)
      setActiveTab('discovery')
    },
    [handleVideoSearch],
  )

  const handleSelectSearchResult = useCallback(
    (videoId: string) => {
      runAnalysis(videoId)
      setActiveTab('viewer')
    },
    [runAnalysis],
  )

  const filteredChapters = useMemo(() => {
    if (!result) return []
    const terms = parseSearchTerms(searchQuery)
    if (terms.length === 0) return result.chapters
    return result.chapters.filter((ch) =>
      terms.some((term) => ch.title.toLowerCase().includes(term)),
    )
  }, [result, searchQuery])

  const displayedChapters = showFilteredChapters ? filteredChapters : result?.chapters ?? []

  const handleStartClips = useCallback(() => {
    if (displayedChapters.length === 0) return
    setClipMode(true)
    setClipIndex(0)
  }, [displayedChapters.length])

  const handleStopClips = useCallback(() => {
    setClipMode(false)
    if (clipTimerRef.current) clearTimeout(clipTimerRef.current)
  }, [])

  const handleChapterSelect = useCallback(
    (start: number) => {
      if (clipMode) {
        const idx = displayedChapters.findIndex((ch) => ch.start === start)
        if (idx !== -1) {
          setClipIndex(idx)
          return
        }
      }
      setPlayStart(start)
    },
    [clipMode, displayedChapters],
  )

  useEffect(() => {
    if (!clipMode) return
    if (displayedChapters.length === 0) {
      setClipMode(false)
      return
    }

    const validIndex = Math.min(clipIndex, displayedChapters.length - 1)
    if (validIndex !== clipIndex) {
      setClipIndex(validIndex)
      return
    }

    if (clipTimerRef.current) clearTimeout(clipTimerRef.current)

    const current = displayedChapters[validIndex]
    setPlayStart(current.start)

    const next = displayedChapters[validIndex + 1]
    if (!next) {
      // Last clip - continue playing it indefinitely until user stops
      return
    }

    // Calculate duration until next filtered clip starts
    const duration = Math.max((next.start - current.start) * 1000, 3000)
    clipTimerRef.current = setTimeout(() => {
      setClipIndex((i) => i + 1)
    }, duration)

    return () => {
      if (clipTimerRef.current) clearTimeout(clipTimerRef.current)
    }
  }, [clipMode, clipIndex, displayedChapters])

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 top-0 h-96 w-96 rounded-full bg-red-600/10 blur-3xl" />
        <div className="absolute -right-40 bottom-0 h-96 w-96 rounded-full bg-red-900/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 py-3 sm:px-6 sm:py-4">
        <header className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex items-center gap-1.5 shrink-0">
            <div>
              <h1 className="text-sm font-bold tracking-tight sm:text-base">
                YouTube<span className="text-red-500">Max</span>
              </h1>              
            </div>
          </div>
          <div className="flex-1">
            <SearchBar onSearch={runAnalysis} loading={loading} />
          </div>
        </header>

        <div className="flex flex-col gap-1">
          {/* Discovery Search Bar (outside tabs) */}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (searchQuery.trim() && !searchLoading) {
                handleSearchFromDiscovery(searchQuery.trim())
              }
            }}
            className="flex flex-col gap-2.5"
          >
            <div className="flex gap-2 sm:flex-row flex-col">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search YouTube for videos…"
                  className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-zinc-500 outline-none transition focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20"
                  disabled={searchLoading}
                />
              </div>
              <button
                type="submit"
                disabled={searchLoading || !searchQuery.trim()}
                className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 shrink-0"
              >
                {searchLoading ? 'Searching…' : 'Search'}
              </button>
              {searchQuery.trim() && (
                <a
                  href={youtubeSearchUrl(searchQuery)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-400 transition hover:text-white hover:border-white/20 shrink-0"
                >
                  YouTube
                </a>
              )}
            </div>
          </form>


          {searchError && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {searchError}
            </div>
          )}

          {searchSoftWarning && (
            <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-200">
              {searchSoftWarning}
            </div>
          )}

          {/* Tabs Container with Master List Overlay */}
          <div className="relative">
            {/* Master List - Floating Overlay */}
            {masterKeywords.length > 0 && (
              <div className="absolute top-0 left-0 right-0 z-20 rounded-lg border border-white/10 bg-black/60 backdrop-blur-sm p-2 max-h-16 hover:max-h-96 overflow-hidden hover:overflow-y-auto opacity-60 hover:opacity-100 transition-all duration-200 group">
                <KeywordMasterList
                  keywords={masterKeywords}
                  activeVideoId={result?.meta.videoId}
                  searchQuery={searchQuery}
                  onSelect={handleKeywordSelect}
                  onRemove={removeKeyword}
                  onClear={clearKeywords}
                />
              </div>
            )}

            {/* Tab Navigation */}
            <div className="flex border-b border-white/10 pt-18">
              <button
                onClick={() => setActiveTab('discovery')}
                className={`px-4 py-2 text-sm font-medium transition ${
                  activeTab === 'discovery'
                    ? 'border-b-2 border-red-500 text-white'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Discovery
              </button>
              {result && (
                <button
                  onClick={() => setActiveTab('viewer')}
                  className={`px-4 py-2 text-sm font-medium transition ${
                    activeTab === 'viewer'
                      ? 'border-b-2 border-red-500 text-white'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Viewer
                </button>
              )}
            </div>

            {/* Tab Content */}
            <div className="min-h-96">
            {/* Discovery Tab - Results Grid */}
              {activeTab === 'discovery' && (
                <div className="flex flex-col gap-3">
                  {searchResults.length > 0 ? (
                    <div>
                      <p className="text-xs text-zinc-500 mb-2">
                        Found {searchResults.length} video{searchResults.length !== 1 ? 's' : ''}
                      </p>
                      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                        {searchResults.map((video) => (
                          <button
                            key={video.videoId}
                            type="button"
                            onClick={() => handleSelectSearchResult(video.videoId)}
                            className="group rounded-lg border border-white/10 bg-black/20 overflow-hidden transition hover:border-red-500/30 hover:bg-white/5"
                          >
                            <img
                              src={video.thumbnail}
                              alt=""
                              className="w-full h-32 object-cover"
                            />
                            <div className="p-3">
                              <p className="line-clamp-2 text-xs font-medium text-white group-hover:text-red-200">
                                {video.title}
                              </p>
                              <p className="mt-1 text-[10px] text-zinc-500">{video.channel}</p>
                              <div className="mt-1.5 flex flex-wrap gap-1 text-sm text-zinc-600">
                                {video.viewCount && <span>{formatViewCount(video.viewCount)}</span>}
                                {video.duration && <span>·</span>}
                                {video.duration && <span>{video.duration}</span>}
                                {video.publishedAt && <span>·</span>}
                                {video.publishedAt && <span>{video.publishedAt}</span>}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-white/10 bg-white/5 p-6 text-center">
                      <p className="text-sm text-zinc-400">
                        {searchQuery.trim() ? 'No videos found. Try a different search.' : 'Enter a search query above to discover videos.'}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Viewer Tab */}
              {activeTab === 'viewer' && result && (
                <div className="flex flex-col gap-3">
                  <WarningsBanner warnings={result.warnings} />
                  <div className="grid gap-4 lg:grid-cols-[1fr_280px] relative group">
                    <div className="flex flex-col gap-2">
                      {clipMode && displayedChapters[clipIndex] && (
                        <div className="flex items-center gap-3 rounded-lg bg-emerald-500/[0.08] px-3 py-2 text-xs ring-1 ring-emerald-500/20">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                          <span className="text-zinc-400">Clip</span>
                          <span className="font-semibold text-emerald-300">
                            {clipIndex + 1} / {displayedChapters.length}
                          </span>
                          <span className="truncate text-zinc-300 text-xs">
                            {displayedChapters[clipIndex].title}
                          </span>
                          <button
                            type="button"
                            onClick={handleStopClips}
                            className="ml-auto shrink-0 text-xs text-zinc-500 transition hover:text-white"
                          >
                            ✕ Stop
                          </button>
                        </div>
                      )}
                      <VideoPlayer videoId={result.meta.videoId} startAt={playStart} />
                    </div>
                    {/* Chapters - Right sidebar */}
                    <aside className="rounded-lg border border-white/10 bg-white/[0.03] p-2 lg:max-h-[min(70vh,480px)] lg:overflow-y-auto">
                      <ChapterList
                        chapters={displayedChapters}
                        allChapters={result.chapters}
                        filteredCount={filteredChapters.length}
                        allCount={result.chapters.length}
                        showFiltered={showFilteredChapters}
                        onToggleFilter={() => setShowFilteredChapters((v) => !v)}
                        filterTerms={parseSearchTerms(searchQuery)}
                        activeStart={playStart}
                        onSelect={handleChapterSelect}
                        clipMode={clipMode}
                        clipIndex={clipIndex}
                        onPlayClips={handleStartClips}
                        onStopClips={handleStopClips}
                      />
                    </aside>

                  </div>
                </div>
              )}

              {/* Empty state */}
              {!result && !loading && activeTab === 'viewer' && (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-16 text-center">
                  <p className="text-lg text-zinc-300">No video loaded</p>
                  <p className="mt-2 text-sm text-zinc-500">Search or paste a YouTube link to start</p>
                </div>
              )}
            </div>
          </div>

          {/* Error state */}
          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-200">
              {error}
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div className="flex flex-col items-center gap-4 py-20 text-zinc-400">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-700 border-t-red-500" />
              <p>Fetching transcript and building chapters…</p>
            </div>
          )}


        </div>

        {/* Collapsible Summary & Transcript */}
        {result && (
          <div className="flex flex-col gap-3 mt-8">
            {/* Summary */}
            <div className="rounded-lg border border-white/10 bg-white/[0.03]">
              <button
                onClick={() => setShowSummary(!showSummary)}
                className="flex w-full items-center justify-between px-4 py-3 hover:bg-white/[0.05] transition"
              >
                <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
                  Summary
                </h3>
                <span className={`text-xs text-zinc-500 transition ${showSummary ? 'rotate-180' : ''}`}>
                  ▼
                </span>
              </button>
              {showSummary && (
                <div className="border-t border-white/5 px-4 py-3">
                  <SummaryCard summary={result.summary} />
                </div>
              )}
            </div>

            {/* Transcript */}
            <div className="rounded-lg border border-white/10 bg-white/[0.03]">
              <button
                onClick={() => setShowTranscript(!showTranscript)}
                className="flex w-full items-center justify-between px-4 py-3 hover:bg-white/[0.05] transition"
              >
                <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
                  Transcript
                </h3>
                <span className={`text-xs text-zinc-500 transition ${showTranscript ? 'rotate-180' : ''}`}>
                  ▼
                </span>
              </button>
              {showTranscript && (
                <div className="border-t border-white/5 px-4 py-3">
                  <TranscriptPanel segments={result.transcript} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>


    </div>
  )
}

export default App
