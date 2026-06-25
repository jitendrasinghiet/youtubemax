import { useCallback, useState } from 'react'
import { ChapterList } from './components/ChapterList'
import { KeywordMasterList } from './components/KeywordMasterList'
import { SearchBar } from './components/SearchBar'
import { SummaryCard } from './components/SummaryCard'
import { TranscriptPanel } from './components/TranscriptPanel'
import { VideoDiscoveryPanel } from './components/VideoDiscoveryPanel'
import { VideoPlayer } from './components/VideoPlayer'
import { WarningsBanner } from './components/WarningsBanner'
import { useKeywordMasterList } from './hooks/useKeywordMasterList'
import { analyzeVideo, appendSearchTerm, searchVideos } from './lib/api'
import type { AnalyzeResult, SearchResultItem } from './types'

function App() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AnalyzeResult | null>(null)
  const [playStart, setPlayStart] = useState(0)

  const [searchQuery, setSearchQuery] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [searchSoftWarning, setSearchSoftWarning] = useState<string | null>(null)
  const [searchUrl, setSearchUrl] = useState<string | null>(null)
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
    setSearchUrl(null)
    setSearchResults([])

    try {
      const { results, searchUrl: url, warning } = await searchVideos(input)
      setSearchResults(results)
      setSearchUrl(url)
      if (warning) setSearchSoftWarning(warning)
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setSearchLoading(false)
    }
  }, [])

  const handleKeywordSelect = useCallback((term: string) => {
    setSearchQuery((prev) => appendSearchTerm(prev, term))
  }, [])

  const handleSearchFromDiscovery = useCallback(
    (query: string) => {
      setSearchQuery(query)
      handleVideoSearch(query)
    },
    [handleVideoSearch],
  )

  const handleSelectSearchResult = useCallback(
    (videoId: string) => {
      runAnalysis(videoId)
    },
    [runAnalysis],
  )

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 top-0 h-96 w-96 rounded-full bg-red-600/10 blur-3xl" />
        <div className="absolute -right-40 bottom-0 h-96 w-96 rounded-full bg-red-900/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <header className="mb-10">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-600 text-lg font-bold shadow-lg shadow-red-600/30">
              Y
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                YouTube<span className="text-red-500">Max</span>
              </h1>
              <p className="text-sm text-zinc-400">
                Chapters, summaries & keyword-driven video discovery
              </p>
            </div>
          </div>
          <SearchBar onSearch={runAnalysis} loading={loading} />
        </header>

        <div className="mb-8 flex flex-col gap-6">
          <KeywordMasterList
            keywords={masterKeywords}
            activeVideoId={result?.meta.videoId}
            searchQuery={searchQuery}
            onSelect={handleKeywordSelect}
            onRemove={removeKeyword}
            onClear={clearKeywords}
          />
          <VideoDiscoveryPanel
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            onSearch={handleSearchFromDiscovery}
            onSelectVideo={handleSelectSearchResult}
            results={searchResults}
            loading={searchLoading}
            error={searchError}
            searchUrl={searchUrl}
            softWarning={searchSoftWarning}
          />
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-200">
            {error}
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center gap-4 py-20 text-zinc-400">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-700 border-t-red-500" />
            <p>Fetching transcript and building chapters…</p>
          </div>
        )}

        {!loading && !result && !error && (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-16 text-center">
            <p className="text-lg text-zinc-300">Paste any YouTube link to get started</p>
            <p className="mt-2 text-sm text-zinc-500">
              Keywords from each video feed the master list for discovery search
            </p>
          </div>
        )}

        {result && (
          <div className="flex flex-col gap-8">
            <WarningsBanner warnings={result.warnings} />

            <div className="flex flex-col gap-2">
              <h2 className="text-xl font-semibold leading-tight sm:text-2xl">
                {result.meta.title}
              </h2>
              <p className="text-sm text-zinc-400">{result.meta.author}</p>
            </div>

            <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
              <VideoPlayer
                videoId={result.meta.videoId}
                startAt={playStart}
              />
              <aside className="rounded-xl border border-white/10 bg-white/[0.03] p-4 lg:max-h-[min(70vh,520px)] lg:overflow-y-auto">
                <ChapterList
                  chapters={result.chapters}
                  activeStart={playStart}
                  onSelect={setPlayStart}
                />
              </aside>
            </div>

            <SummaryCard summary={result.summary} />
            <TranscriptPanel segments={result.transcript} />
          </div>
        )}
      </div>

      <footer className="relative border-t border-white/5 py-6 text-center text-xs text-zinc-600">
        Uses YouTube oEmbed & caption APIs · Deploy to Vercel with zero config
      </footer>
    </div>
  )
}

export default App
