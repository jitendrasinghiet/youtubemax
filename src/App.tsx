import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChapterList } from './components/ChapterList'
import { DiscoverySearchBar } from './components/DiscoverySearchBar'
import { FilterMenu } from './components/FilterMenu'
import { KeywordMasterList } from './components/KeywordMasterList'
import { SearchBar } from './components/SearchBar'
import { SearchResultsGrid } from './components/SearchResultsGrid'
import { SelectedFiltersBar } from './components/SelectedFiltersBar'
import { SummaryCard } from './components/SummaryCard'
import { TranscriptPanel } from './components/TranscriptPanel'
import { VideoPlayer } from './components/VideoPlayer'
import { WarningsBanner } from './components/WarningsBanner'
import { useClipMode } from './hooks/useClipMode'
import { useKeywordMasterList } from './hooks/useKeywordMasterList'
import { useVoiceSearch } from './hooks/useVoiceSearch'
import {
  analyzeVideo,
  appendSearchTerm,
  browseCachedResults,
  fetchFacetCounts,
  fetchPlaylistResults,
  fetchSearchSuggestions,
  parseSearchTerms,
  removeSearchTerm,
  searchVideos,
} from './lib/api'
import { allFilterItemValues, type FilterDimensionKey, type FilterItem } from './lib/filterTaxonomy'
import {
  applyEvergreenSelection,
  buildEffectiveQuery,
  loadStoredFilters,
  makeSelectedFilter,
  makeSliderFilter,
  persistFilters,
  removeFilter,
  toggleFilter,
  toggleSliderFilter,
  type SelectedFilter,
} from './lib/searchFilters'
import {
  declutterMadeForKids,
  hasKidsFilterActive,
  loadStoredSortType,
  persistSortType,
  sortSearchResults,
  type SearchSortType,
} from './lib/searchSort'
import { parsePlaylistId } from './lib/youtubeUrl'
import { CURATED_PLAYLISTS } from './lib/curatedPlaylists'
import { PlaylistSections } from './components/PlaylistSections'
import { PlaylistManagerPanel } from './dev/PlaylistManagerPanel'
import type { AnalyzeResult, SearchResultItem, PlaylistSection } from './types'

const CACHE_PAGE_SIZE = 24
const SEARCH_HISTORY_KEY = 'youtubemax.discoverySearchHistory'
const SEARCH_HISTORY_LIMIT = 5
const VIEWER_PREFS_KEY = 'youtubemax.viewerPrefs'
const POPUP_PAUSE_KEY = 'youtubemax.viewerPauseRequest'

const MIN_VIEWER_WIDTH = 216
const MIN_VIEWER_HEIGHT = 156
const MID_VIEWER_WIDTH = MIN_VIEWER_WIDTH * 2
const MID_VIEWER_HEIGHT = MIN_VIEWER_HEIGHT * 2
const VIEWER_MARGIN = 16
const POP_WINDOW_BOTTOM_OFFSET = 72
const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 2] as const

// Docked mode: a full-width bar pinned to the very top of the viewport,
// like YouTube's own mobile "now playing" video with results scrollable
// beneath it -- the initial view the very first time a video plays in a
// session (docs/STATUS.md has the full design writeup).
//
// Tied to the video's own real height, not an arbitrary vh figure --
// reported directly (and confirmed live: 115px of dead black space on a
// tablet-width viewport, 226px on a phone-width one) that a fixed
// `min(58vh, 620px)` panel height leaves growing unused space below the
// video as the viewport narrows, since the *video* is 100%-width/16:9
// (so its own real height shrinks a lot faster than 58vh does) while the
// panel's height didn't track that at all. `100vw * 9 / 16` is the
// video's actual rendered height at any width; +64px covers the header
// row (~45px, measured) plus the scrollable body's own small padding.
// The `min(..., 70vh)` cap still applies on a short/desktop-ish window,
// where the calc() value would otherwise exceed the viewport -- the
// video scrolls internally there exactly as it already did.
const TOP_PANEL_HEIGHT = 'min(calc(100vw * 9 / 16 + 64px), 70vh)'
// How far a downward drag on the docked top bar has to travel before it
// detaches into the free-floating window -- short enough to feel
// immediate, long enough that clicking one of the header's own buttons
// (S/M/L/PiP/CC/rate/fullscreen/close) never accidentally undocks it.
const TOP_TO_FLOAT_DRAG_THRESHOLD = 56
// How close to the top edge a drag has to end for a floating window to
// redock, mirroring the same "drag/swipe to the top" gesture in reverse.
const FLOAT_TO_TOP_DROP_ZONE = 64

type ViewerMode = 'top' | 'floating'
type ViewerSizePreset = 'S' | 'M' | 'L' | 'custom'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

type DocumentPictureInPictureApi = {
  requestWindow: (options?: { width?: number; height?: number }) => Promise<Window>
}

function parsePlaybackRate(value: string | null): number {
  if (!value) return 1
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 1
  return PLAYBACK_RATES.includes(parsed as (typeof PLAYBACK_RATES)[number]) ? parsed : 1
}

function clampViewerSize(size: { width: number; height: number }) {
  if (typeof window === 'undefined') return size

  return {
    width: Math.min(
      Math.max(MIN_VIEWER_WIDTH, size.width),
      Math.max(MIN_VIEWER_WIDTH, window.innerWidth - VIEWER_MARGIN * 2),
    ),
    height: Math.min(
      Math.max(MIN_VIEWER_HEIGHT, size.height),
      Math.max(MIN_VIEWER_HEIGHT, window.innerHeight - VIEWER_MARGIN * 2),
    ),
  }
}

function clampViewerPosition(
  position: { x: number; y: number },
  size: { width: number; height: number },
) {
  if (typeof window === 'undefined') return position

  const maxX = Math.max(VIEWER_MARGIN, window.innerWidth - size.width - VIEWER_MARGIN)
  const maxY = Math.max(VIEWER_MARGIN, window.innerHeight - size.height - VIEWER_MARGIN)

  return {
    x: Math.min(Math.max(VIEWER_MARGIN, position.x), maxX),
    y: Math.min(Math.max(VIEWER_MARGIN, position.y), maxY),
  }
}

function isLikelyMobileWindow() {
  if (typeof window === 'undefined') return false
  const touchPoints = typeof navigator !== 'undefined' ? navigator.maxTouchPoints : 0
  const narrowViewport = window.innerWidth <= 900
  return touchPoints > 1 && narrowViewport
}

/** Appends `incoming` onto `existing`, deduped by videoId -- the same
 *  video legitimately shows up under several different cache pages, and
 *  this is what keeps the infinite-scroll feed from repeating itself as
 *  more pages load in. */
function mergeUniqueResults(
  existing: SearchResultItem[],
  incoming: SearchResultItem[],
): SearchResultItem[] {
  const seen = new Set(existing.map((r) => r.videoId))
  const merged = existing.slice()
  for (const item of incoming) {
    if (seen.has(item.videoId)) continue
    seen.add(item.videoId)
    merged.push(item)
  }
  return merged
}

function isStandaloneDisplayMode() {
  if (typeof window === 'undefined') return false
  const iosStandalone = Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  return window.matchMedia('(display-mode: standalone)').matches || iosStandalone
}

function App() {
  const searchParams = useMemo(() => {
    if (typeof window === 'undefined') return new URLSearchParams()
    return new URLSearchParams(window.location.search)
  }, [])

  // A `?videoId=` on the URL means two different things depending on
  // `?popout=1`: with it, the floating popout player (isPopoutMode below);
  // without it, "also play this inline in the main view" -- used together
  // with `?discover=` by the sibling DEKHO project's detail pane, for a
  // *confirmed* videoId (docs/SEARCH_CACHE.md), so the same link that
  // pre-fills search results also starts the right one playing.
  const requestedVideoId = searchParams.get('videoId')?.trim() ?? ''
  const popoutPlaylistId = searchParams.get('list')?.trim() || null
  const popoutStartAt = Number(searchParams.get('start') ?? '0') || 0
  const isPopoutMode = searchParams.get('popout') === '1' && Boolean(requestedVideoId)
  // Pre-fill + auto-run Discovery search from an external link -- e.g. the
  // sibling DEKHO project's detail pane, for a title with no confirmed
  // videoId yet (docs/SEARCH_CACHE.md). Deliberately just seeds the normal
  // search flow, same as a typed query would -- no separate code path.
  const discoverQuery = searchParams.get('discover')?.trim() ?? ''
  const [windowSessionId] = useState(() => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AnalyzeResult | null>(null)
  const [showAnalyzeInput, setShowAnalyzeInput] = useState(false)
  const [showChaptersPanel, setShowChaptersPanel] = useState(false)
  const [showSummaryPanel, setShowSummaryPanel] = useState(false)
  const [showTranscriptPanel, setShowTranscriptPanel] = useState(false)
  const [showDebugMessages, setShowDebugMessages] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [devPlaylistManagerOpen, setDevPlaylistManagerOpen] = useState(false)
  const [showFilteredChapters, setShowFilteredChapters] = useState(false)
  const [showSummary, setShowSummary] = useState(true)
  const [viewerOpen, setViewerOpen] = useState(false)
  // Which of the two visual states the viewer is in -- 'top' (docked,
  // full-width bar at the top of the page, the results grid scrollable
  // beneath it) or 'floating' (the draggable/resizable corner window).
  // Starts 'floating' -- reported directly as the wanted default
  // (an M-size window in the bottom-right corner, same as
  // viewerPosition/viewerSizePreset's own defaults just below, which
  // already computed a bottom-right/M-size window and only needed this
  // mode default to match). 'top'/dock stays fully available -- the
  // explicit dock button, or dragging a floating window's header up to
  // the top edge, both still switch to it same as before. Restored from
  // sessionStorage below (the effect reading VIEWER_PREFS_KEY) once a
  // video's been played and this got explicitly set at least once in
  // the current browser session -- covers "position stays as per user
  // pref," including picking 'top' again if that's what was last set.
  const [viewerMode, setViewerMode] = useState<ViewerMode>('floating')
  const [viewerPosition, setViewerPosition] = useState(() => {
    if (typeof window === 'undefined') return { x: VIEWER_MARGIN, y: VIEWER_MARGIN }
    return {
      x: window.innerWidth - MID_VIEWER_WIDTH - VIEWER_MARGIN,
      y: window.innerHeight - MID_VIEWER_HEIGHT - VIEWER_MARGIN,
    }
  })
  const [viewerSize, setViewerSize] = useState({ width: MID_VIEWER_WIDTH, height: MID_VIEWER_HEIGHT })
  const [viewerSizePreset, setViewerSizePreset] = useState<ViewerSizePreset>('M')
  const [captionsEnabled, setCaptionsEnabled] = useState(
    () => searchParams.get('cc') === '1',
  )
  const [playbackRate, setPlaybackRate] = useState<number>(
    () => parsePlaybackRate(searchParams.get('rate')),
  )
  const [viewerCurrentTime, setViewerCurrentTime] = useState(0)
  const [pauseSignal, setPauseSignal] = useState(0)
  const [popoutSizePreset, setPopoutSizePreset] = useState<ViewerSizePreset>('M')
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isStandaloneApp, setIsStandaloneApp] = useState(() => isStandaloneDisplayMode())
  const [isFullscreen, setIsFullscreen] = useState(
    () => typeof document !== 'undefined' && Boolean(document.fullscreenElement),
  )

  const [searchQuery, setSearchQuery] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [searchSoftWarning, setSearchSoftWarning] = useState<string | null>(null)
  const [searchHistory, setSearchHistory] = useState<string[]>([])
  const [querySuggestions, setQuerySuggestions] = useState<string[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  // The cache-backed default feed -- every locally-cached result (or, with
  // filters selected, just the matching ones), paginated for infinite
  // scroll. This is what's on screen before any live search runs, and what
  // filters narrow directly (see the cache-feed effect below).
  const [cacheResults, setCacheResults] = useState<SearchResultItem[]>([])
  const [cacheOffset, setCacheOffset] = useState(0)
  const [cacheTotal, setCacheTotal] = useState(0)
  const [cacheLoading, setCacheLoading] = useState(false)
  const cacheGenerationRef = useRef(0)
  const cacheSentinelRef = useRef<HTMLDivElement | null>(null)
  // An explicit, manual search's results -- shown in their own section
  // pinned above the cache feed, distinct from it rather than merged in,
  // so it's always visually clear what just came from typing a search vs.
  // what was already in the local library.
  const [liveResults, setLiveResults] = useState<SearchResultItem[]>([])
  const [liveQuery, setLiveQuery] = useState<string | null>(null)
  const [searchSortType, setSearchSortType] = useState<SearchSortType>(() => loadStoredSortType())
  const [defaultsLoaded, setDefaultsLoaded] = useState(false)
  const [selectedFilters, setSelectedFilters] = useState<SelectedFilter[]>(() => loadStoredFilters())
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [facetCounts, setFacetCounts] = useState<Record<string, number>>({})

  const {
    keywords: masterKeywords,
    ingestFromAnalysis,
    removeKeyword,
    clearKeywords,
  } = useKeywordMasterList()

  const filteredChapters = useMemo(() => {
    if (!result) return []
    const terms = parseSearchTerms(searchQuery)
    if (terms.length === 0) return result.chapters
    return result.chapters.filter((ch) =>
      terms.some((term) => ch.title.toLowerCase().includes(term)),
    )
  }, [result, searchQuery])

  const displayedChapters = useMemo(
    () => (showFilteredChapters ? filteredChapters : result?.chapters ?? []),
    [showFilteredChapters, filteredChapters, result],
  )

  const {
    playStart,
    setPlayStart,
    clipMode,
    clipIndex,
    startClips,
    stopClips,
    selectChapter,
  } = useClipMode(displayedChapters)

  // Playlist context for whatever's in the viewer right now, from either an
  // analyze-by-URL &list= paste or a click into a curated-playlist section
  // below. Purely a VideoPlayer prop — never touches searchQuery/filters.
  const [analyzedPlaylistId, setAnalyzedPlaylistId] = useState<string | null>(null)

  // Curated static playlists: separate, order-preserving selection state.
  // Deliberately NOT a SelectedFilter — see lib/searchFilters.ts docblock on
  // buildEffectiveQuery. A playlist has no search-query value; selecting one
  // fetches its real items and renders a pinned section, it never narrows
  // or extends the keyword search below it.
  const [selectedPlaylists, setSelectedPlaylists] = useState<string[]>([])
  const [playlistSections, setPlaylistSections] = useState<PlaylistSection[]>([])
  const [playlistsLoading, setPlaylistsLoading] = useState(false)

  const togglePlaylist = useCallback((playlistId: string) => {
    setSelectedPlaylists((current) =>
      current.includes(playlistId)
        ? current.filter((id) => id !== playlistId)
        : [...current, playlistId],
    )
  }, [])

  useEffect(() => {
    if (selectedPlaylists.length === 0) {
      setPlaylistSections([])
      return
    }

    let cancelled = false
    setPlaylistsLoading(true)

    Promise.all(
      selectedPlaylists.map(async (playlistId): Promise<PlaylistSection> => {
        const meta = CURATED_PLAYLISTS.find((p) => p.id === playlistId)
        try {
          const { results, warning } = await fetchPlaylistResults(playlistId)
          return { playlistId, label: meta?.label ?? playlistId, icon: meta?.icon ?? '🎵', results, warning }
        } catch (err) {
          return {
            playlistId,
            label: meta?.label ?? playlistId,
            icon: meta?.icon ?? '🎵',
            results: [],
            warning: err instanceof Error ? err.message : 'Failed to load playlist',
          }
        }
      }),
    ).then((sections) => {
      if (cancelled) return
      // Re-order to match selectedPlaylists (selection order), not
      // Promise.all's resolution order — they're usually the same, but
      // don't rely on it.
      const byId = new Map(sections.map((s) => [s.playlistId, s]))
      setPlaylistSections(selectedPlaylists.map((id) => byId.get(id)!).filter(Boolean))
      setPlaylistsLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [selectedPlaylists])

  const runAnalysis = useCallback(
    async (input: string, playlistIdOverride?: string | null) => {
      setLoading(true)
      setError(null)
      setResult(null)
      setPlayStart(0)
      setViewerOpen(true)
      setAnalyzedPlaylistId(playlistIdOverride !== undefined ? playlistIdOverride : parsePlaylistId(input))

      try {
        const data = await analyzeVideo(input, {
          includeTranscript: showTranscriptPanel,
          includeSummary: showSummaryPanel,
          includeChapters: showChaptersPanel,
        })
        setResult(data)
        ingestFromAnalysis(data)
      } catch (err) {
        setViewerOpen(false)
        setError(err instanceof Error ? err.message : 'Something went wrong')
      } finally {
        setLoading(false)
      }
    },
    [ingestFromAnalysis, setPlayStart, showChaptersPanel, showSummaryPanel, showTranscriptPanel],
  )

  const playVideoFromPlaylist = useCallback(
    (videoId: string, playlistId: string) => {
      runAnalysis(videoId, playlistId)
    },
    [runAnalysis],
  )

  const handleVideoSearch = useCallback(async (input: string) => {
    setSearchLoading(true)
    setSearchError(null)
    setSearchSoftWarning(null)
    setSearchSortType('relevance')

    try {
      // Filters are folded in implicitly; if there's neither typed text nor
      // any filter selected, fall back to a default browse query.
      const effectiveQuery = buildEffectiveQuery(input, selectedFilters) || 'trending'
      const { results, warning } = await searchVideos(effectiveQuery)
      // A fresh manual search replaces the live section (not the cache
      // feed below it, and not accumulated with a previous search) -- see
      // the liveResults section in the render below.
      setLiveResults(results)
      setLiveQuery(input.trim() || effectiveQuery)
      if (warning) setSearchSoftWarning(warning)
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setSearchLoading(false)
    }
  }, [selectedFilters])

  const dismissLiveResults = useCallback(() => {
    setLiveResults([])
    setLiveQuery(null)
  }, [])

  // Editing the search box (typing, or clearing it) after a live search
  // has landed should drop that now-stale pinned result set rather than
  // leaving it on screen until the user finds the separate dismiss
  // button -- the cache feed below already re-pages itself on every
  // searchQuery change (see the effect below), so only liveResults was
  // going stale. Tied to the text field's own onChange, not a derived
  // effect on searchQuery, so a filter-only search (which never touches
  // this field, and can leave searchQuery at '' the whole time) doesn't
  // get its own live results dismissed the instant they land.
  const handleSearchQueryChange = useCallback(
    (value: string) => {
      setSearchQuery(value)
      if (liveResults.length > 0) dismissLiveResults()
    },
    [liveResults.length, dismissLiveResults],
  )

  // Persist selected filters (in selection order) so they survive a reload.
  useEffect(() => {
    persistFilters(selectedFilters)
  }, [selectedFilters])

  // Same "survive a reload" treatment for the sort order -- reported
  // directly alongside filters, same gap.
  useEffect(() => {
    persistSortType(searchSortType)
  }, [searchSortType])

  // Floating "back to top" affordance -- the results feed is a plain
  // window-scrolled list (no inner overflow container), and it now
  // routinely runs into the thousands of cached items, so getting back
  // to the sticky search/filter bar without a long manual scroll matters.
  useEffect(() => {
    if (isPopoutMode) return
    const THRESHOLD = 600
    const handleScroll = () => setShowScrollTop(window.scrollY > THRESHOLD)
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [isPopoutMode])

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  // One batched fetch for the whole taxonomy's worth of chip counts
  // ("Romance (23)," not just "Romance") -- server/searchCache.ts's
  // getFacetCounts() computes this from the same local cache the default
  // feed already reads, memoized there, so this is cheap even though it
  // covers ~275 terms. Fetched once on load (not gated behind opening the
  // filter menu) so the numbers are already there the first time it opens.
  useEffect(() => {
    if (isPopoutMode) return
    let active = true
    fetchFacetCounts(allFilterItemValues()).then((counts) => {
      if (active) setFacetCounts(counts)
    })
    return () => {
      active = false
    }
  }, [isPopoutMode])

  // The cache-backed default feed: browses the *entire* local search-cache
  // -- no live YouTube fetch, ever, for this effect. This is "search the
  // cache first" as the default view itself, not just a lookup bolted onto
  // filter clicks: toggling a filter, or typing in the Discovery search
  // box, both re-page the *same* feed against a narrower match set (folded
  // together -- see browseCache's `keywords`/`query`), and clearing
  // filters/the search box goes back to browsing everything. Typing is
  // debounced (250ms of no keystrokes) so it doesn't re-scan the cache on
  // every character; a bare filter-chip change (no typed text) still fires
  // immediately, matching the original instant-filter feel. Always
  // re-fetches page 0 fresh on a change (a new browsing context) rather
  // than merging onto whatever was already on screen. `cacheGenerationRef`
  // guards against a slow page-0 fetch landing after a newer change (or a
  // loadMoreCache page landing after that) -- see loadMoreCache below.
  //
  // This never fires a live YouTube search on its own -- that only ever
  // happens on an explicit submit (handleVideoSearch), which shows its
  // results in the separate, pinned liveResults section instead.
  useEffect(() => {
    if (isPopoutMode) return
    const keywords = selectedFilters.map((f) => f.value).filter(Boolean)
    const query = searchQuery.trim()
    const timeoutId = setTimeout(() => {
      const generation = ++cacheGenerationRef.current
      setCacheLoading(true)
      browseCachedResults({ keywords, query, offset: 0, limit: CACHE_PAGE_SIZE })
        .then(({ results, total }) => {
          if (cacheGenerationRef.current !== generation) return
          setCacheResults(results)
          setCacheOffset(results.length)
          setCacheTotal(total)
        })
        .finally(() => {
          if (cacheGenerationRef.current === generation) setCacheLoading(false)
        })
    }, query ? 250 : 0)
    return () => clearTimeout(timeoutId)
  }, [selectedFilters, searchQuery, isPopoutMode])

  const loadMoreCache = useCallback(() => {
    if (isPopoutMode || cacheLoading || cacheOffset >= cacheTotal) return
    const generation = cacheGenerationRef.current
    const keywords = selectedFilters.map((f) => f.value).filter(Boolean)
    const query = searchQuery.trim()
    setCacheLoading(true)
    browseCachedResults({ keywords, query, offset: cacheOffset, limit: CACHE_PAGE_SIZE })
      .then(({ results, total }) => {
        if (cacheGenerationRef.current !== generation) return
        setCacheResults((prev) => mergeUniqueResults(prev, results))
        setCacheOffset((prev) => prev + results.length)
        setCacheTotal(total)
      })
      .finally(() => {
        if (cacheGenerationRef.current === generation) setCacheLoading(false)
      })
  }, [isPopoutMode, cacheLoading, cacheOffset, cacheTotal, selectedFilters, searchQuery])

  // Infinite scroll: a sentinel div sits just past the last row of the
  // cache grid (see the render below); once it's within 600px of the
  // viewport, load the next page -- same "YouTube homepage" feel as
  // scrolling for more, no explicit pagination controls needed day to day
  // (the "Load more" button in the footer is the no-JS/no-observer
  // fallback, not the primary path).
  useEffect(() => {
    if (isPopoutMode) return
    const node = cacheSentinelRef.current
    if (!node) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMoreCache()
      },
      { rootMargin: '600px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [isPopoutMode, loadMoreCache])

  // Filters are implicit — they're folded into the next *live* search a
  // user actually runs (typed submit, suggestion/history pick, or the
  // Search button) — but toggling a filter chip does NOT fire a live
  // YouTube fetch on its own (the local cache lookup above is not that).
  // That keeps real network requests tied to explicit user actions instead
  // of firing on every checkbox click.

  const handleToggleFilter = useCallback(
    (dimension: FilterDimensionKey, label: string, icon: string, group?: string) => {
      setSelectedFilters((prev) => toggleFilter(prev, makeSelectedFilter(dimension, label, icon, group)))
    },
    [],
  )

  // Evergreen combos add their own chip plus, for any dimension the user
  // hasn't touched yet, all of that combo's implied filter tags — see
  // applyEvergreenSelection in lib/searchFilters.ts and
  // docs/FILTER_ROADMAP.md item 1.
  const handleSelectEvergreen = useCallback((item: FilterItem) => {
    setSelectedFilters((prev) => applyEvergreenSelection(prev, item))
  }, [])

  // Era / Grade sliders are single-select per group — picking a new value
  // replaces the previous one in that same group instead of adding
  // alongside it. See toggleSliderFilter in lib/searchFilters.ts.
  const handleToggleSlider = useCallback((dimension: FilterDimensionKey, group: string, item: FilterItem) => {
    setSelectedFilters((prev) => toggleSliderFilter(prev, makeSliderFilter(dimension, group, item)))
  }, [])

  const handleRemoveFilter = useCallback((filter: SelectedFilter) => {
    setSelectedFilters((prev) => removeFilter(prev, filter))
  }, [])

  const handleClearFilters = useCallback(() => {
    setSelectedFilters([])
  }, [])

  const addSearchHistory = useCallback((query: string) => {
    const normalized = query.trim()
    if (!normalized) return

    setSearchHistory((prev) => {
      const next = [
        normalized,
        ...prev.filter((item) => item.toLowerCase() !== normalized.toLowerCase()),
      ].slice(0, SEARCH_HISTORY_LIMIT)
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const removeSearchHistoryItem = useCallback((query: string) => {
    setSearchHistory((prev) => {
      const next = prev.filter((item) => item !== query)
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const clearSearchHistory = useCallback(() => {
    setSearchHistory([])
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify([]))
  }, [])

  const handleHistorySelect = useCallback(
    (query: string) => {
      addSearchHistory(query)
      setSearchQuery(query)
      handleVideoSearch(query)
    },
    [addSearchHistory, handleVideoSearch],
  )

  const handleSuggestionSelect = useCallback(
    (query: string) => {
      addSearchHistory(query)
      setSearchQuery(query)
      handleVideoSearch(query)
    },
    [addSearchHistory, handleVideoSearch],
  )

  const handleKeywordSelect = useCallback((term: string) => {
    setSearchQuery((prev) => {
      const terms = parseSearchTerms(prev)
      if (terms.includes(term.toLowerCase())) {
        return removeSearchTerm(prev, term)
      }
      return appendSearchTerm(prev, term)
    })
  }, [])

  const handleVoiceTranscript = useCallback((transcript: string) => {
    setSearchQuery((prev) => (prev ? `${prev} ${transcript}` : transcript))
  }, [])

  const { isListening: isVoiceListening, toggle: toggleVoiceSearch } =
    useVoiceSearch(handleVoiceTranscript)

  const handleSearchFromDiscovery = useCallback(
    (query: string) => {
      setSearchQuery(query)
      handleVideoSearch(query)
    },
    [handleVideoSearch],
  )

  const handleSelectSearchResult = useCallback(
    (videoId: string) => {
      // Deliberately doesn't touch viewerMode/viewerPosition -- selecting
      // a *different* video from the list is not the same gesture as
      // dragging the viewer, and used to hard-reset the floating window
      // to the bottom-right corner every single time regardless of
      // where the user had actually dragged it. Whatever mode/position
      // is already active (top-docked, or floating at wherever it was
      // last left) carries over to the newly-selected video, which is
      // the actual "stays the same across multiple items played" ask.
      runAnalysis(videoId)
    },
    [runAnalysis],
  )

  const startViewerDrag = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault()

      const startPointer = { x: event.clientX, y: event.clientY }
      const startPosition = viewerPosition
      const size = clampViewerSize(viewerSize)
      // Local to this one gesture, not React state -- a fast drag isn't
      // gated behind a render, and the pointerup handler below needs to
      // know how the drag actually ended without waiting for one either.
      let mode = viewerMode
      let lastClientY = startPointer.y

      const handlePointerMove = (moveEvent: PointerEvent) => {
        lastClientY = moveEvent.clientY

        if (mode === 'top') {
          // Only a real downward drag detaches the docked top panel --
          // guards against a stray wobble while just clicking one of the
          // header's own buttons (S/M/L/PiP/CC/rate/fullscreen/close),
          // all of which also sit under this same pointerdown handler.
          const draggedDown = moveEvent.clientY - startPointer.y
          if (draggedDown < TOP_TO_FLOAT_DRAG_THRESHOLD) return
          mode = 'floating'
          setViewerMode('floating')
          // Detaches from directly under the pointer's *current*
          // position, not the drag's start -- so the window picks up
          // exactly where the top panel visually was the instant it
          // crossed the threshold, instead of jumping.
          setViewerPosition(
            clampViewerPosition(
              { x: moveEvent.clientX - size.width / 2, y: moveEvent.clientY - 16 },
              size,
            ),
          )
          return
        }

        setViewerPosition(
          clampViewerPosition(
            {
              x: startPosition.x + (moveEvent.clientX - startPointer.x),
              y: startPosition.y + (moveEvent.clientY - startPointer.y),
            },
            size,
          ),
        )
      }

      const handlePointerUp = () => {
        document.removeEventListener('pointermove', handlePointerMove)
        document.removeEventListener('pointerup', handlePointerUp)
        // The reverse gesture: a floating window dragged back up into the
        // top strip redocks as the wide top panel, same drop-zone idea as
        // the detach threshold above, just checked at release instead of
        // continuously (redocking mid-drag would fight the user's own
        // pointer position on every subsequent move event).
        if (mode === 'floating' && lastClientY <= FLOAT_TO_TOP_DROP_ZONE) {
          setViewerMode('top')
        }
      }

      document.addEventListener('pointermove', handlePointerMove)
      document.addEventListener('pointerup', handlePointerUp)
    },
    [viewerPosition, viewerSize, viewerMode],
  )

  const startViewerResize = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault()
      event.stopPropagation()

      const startPointer = { x: event.clientX, y: event.clientY }
      const startSize = viewerSize
      const startPosition = viewerPosition

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const resized = clampViewerSize({
          width: startSize.width + (moveEvent.clientX - startPointer.x),
          height: startSize.height + (moveEvent.clientY - startPointer.y),
        })

        setViewerSize(resized)
        setViewerSizePreset('custom')
        setViewerPosition(clampViewerPosition(startPosition, resized))
      }

      const handlePointerUp = () => {
        document.removeEventListener('pointermove', handlePointerMove)
        document.removeEventListener('pointerup', handlePointerUp)
      }

      document.addEventListener('pointermove', handlePointerMove)
      document.addEventListener('pointerup', handlePointerUp)
    },
    [viewerPosition, viewerSize],
  )

  const applyViewerSize = useCallback((nextSize: { width: number; height: number }) => {
    const resized = clampViewerSize(nextSize)
    setViewerSize(resized)
    setViewerPosition((currentPosition) => clampViewerPosition(currentPosition, resized))
    // A specific S/M size is a floating-window concept -- picking one
    // while docked at the top undocks it there, at that size, rather
    // than the button silently doing nothing useful in that mode.
    setViewerMode('floating')
  }, [])

  const resizeViewerToMin = useCallback(() => {
    applyViewerSize({ width: MIN_VIEWER_WIDTH, height: MIN_VIEWER_HEIGHT })
    setViewerSizePreset('S')
  }, [applyViewerSize])

  const resizeViewerToMedium = useCallback(() => {
    applyViewerSize({ width: MID_VIEWER_WIDTH, height: MID_VIEWER_HEIGHT })
    setViewerSizePreset('M')
  }, [applyViewerSize])

  const resizeViewerToMax = useCallback(() => {
    if (typeof window === 'undefined') return

    const availableWidth = Math.max(MIN_VIEWER_WIDTH, window.innerWidth - VIEWER_MARGIN * 2)
    const availableHeight = Math.max(MIN_VIEWER_HEIGHT, window.innerHeight - VIEWER_MARGIN * 2)
    const width = Math.max(MIN_VIEWER_WIDTH, availableWidth * 0.9)
    const height = Math.max(MIN_VIEWER_HEIGHT, availableHeight * 0.9)
    const resized = clampViewerSize({ width, height })
    setViewerSize(resized)
    setViewerSizePreset('L')
    setViewerMode('floating')
    setViewerPosition({
      x: VIEWER_MARGIN + (availableWidth - resized.width) / 2,
      y: VIEWER_MARGIN + (availableHeight - resized.height) / 2,
    })
  }, [])

  // The explicit-button equivalent of dragging/swiping a floating window
  // up into the top drop zone -- same destination, for anyone who'd
  // rather click than discover the gesture.
  const dockViewerToTop = useCallback(() => {
    setViewerMode('top')
  }, [])

  const cyclePlaybackRate = useCallback(() => {
    setPlaybackRate((current) => {
      const currentIndex = PLAYBACK_RATES.findIndex((value) => value === current)
      const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % PLAYBACK_RATES.length : 1
      return PLAYBACK_RATES[nextIndex]
    })
  }, [])

  const toggleFullscreen = useCallback(async () => {
    if (typeof document === 'undefined') return

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else {
        await document.documentElement.requestFullscreen()
      }
    } catch {
      // Ignore fullscreen API failures on unsupported/mobile browsers.
    }
  }, [])

  const promptInstallApp = useCallback(async () => {
    if (!deferredInstallPrompt) return
    try {
      await deferredInstallPrompt.prompt()
      await deferredInstallPrompt.userChoice
    } catch {
      // Ignore prompt failures.
    } finally {
      setDeferredInstallPrompt(null)
    }
  }, [deferredInstallPrompt])

  const resizePopoutWindow = useCallback((preset: ViewerSizePreset) => {
    if (typeof window === 'undefined') return

    const availableWidth = window.screen?.availWidth ?? window.innerWidth
    const availableHeight = window.screen?.availHeight ?? window.innerHeight
    const factor = preset === 'S' ? 0.45 : preset === 'M' ? 0.65 : 0.9

    const width = Math.max(320, Math.round(availableWidth * factor))
    const height = Math.max(240, Math.round(availableHeight * factor))
    const left = Math.max(0, Math.round((availableWidth - width) / 2))
    const top = Math.max(0, Math.round((availableHeight - height) / 2))

    try {
      window.resizeTo(width, height)
      window.moveTo(left, top)
    } catch {
      // Mobile browsers and some desktop browsers can block this.
    }

    setPopoutSizePreset(preset)
  }, [])

  const openViewerPopout = useCallback(async () => {
    if (typeof window === 'undefined' || !result) return

    const resumeAt = Math.max(0, Math.floor(viewerCurrentTime > 0 ? viewerCurrentTime : playStart))

    const url = new URL(window.location.href)
    url.searchParams.set('popout', '1')
    url.searchParams.set('videoId', result.meta.videoId)
    if (analyzedPlaylistId) {
      url.searchParams.set('list', analyzedPlaylistId)
    } else {
      url.searchParams.delete('list')
    }
    url.searchParams.set('start', String(resumeAt))
    url.searchParams.set('cc', captionsEnabled ? '1' : '0')
    url.searchParams.set('rate', String(playbackRate))
    url.searchParams.set('sid', windowSessionId)

    try {
      localStorage.setItem(
        POPUP_PAUSE_KEY,
        JSON.stringify({ sourceId: windowSessionId, ts: Date.now() }),
      )
    } catch {
      // Ignore storage failures.
    }
    // Storage events do not fire in the same window, so pause locally too.
    setPauseSignal((value) => value + 1)

    const width = Math.max(320, Math.round(viewerSize.width))
    const height = Math.max(240, Math.round(viewerSize.height))
    const availWidth = window.screen?.availWidth ?? window.innerWidth
    const availHeight = window.screen?.availHeight ?? window.innerHeight
    const left = Math.max(VIEWER_MARGIN, Math.round(availWidth - width - VIEWER_MARGIN))
    const top = Math.max(
      VIEWER_MARGIN,
      Math.round(availHeight - height - POP_WINDOW_BOTTOM_OFFSET),
    )

    const shouldUseNewTab = isLikelyMobileWindow()
    const pipApi = (
      document as Document & {
        documentPictureInPicture?: DocumentPictureInPictureApi
      }
    ).documentPictureInPicture

    if (!shouldUseNewTab && pipApi?.requestWindow) {
      try {
        const pipWindow = await pipApi.requestWindow({ width, height })
        try {
          pipWindow.resizeTo(width, height)
          pipWindow.moveTo(left, top)
        } catch {
          // Browser may control PiP position and ignore move/resize.
        }
        pipWindow.location.href = url.toString()
        pipWindow.focus()
        return
      } catch {
        // Fall back to popup/new-tab below.
      }
    }

    const features = [
      `width=${width}`,
      `height=${height}`,
      `left=${left}`,
      `top=${top}`,
      'popup=yes',
      'resizable=yes',
      'scrollbars=yes',
      'toolbar=no',
      'location=no',
      'status=no',
      'menubar=no',
    ].join(',')

    const popup = shouldUseNewTab
      ? window.open(url.toString(), '_blank', 'noopener,noreferrer')
      : window.open('', 'youtubemax-viewer', features)
    if (!popup) return

    if (shouldUseNewTab) {
      popup.focus()
      return
    }

    // Best effort: force size/position and then navigate.
    try {
      popup.resizeTo(width, height)
      popup.moveTo(left, top)
    } catch {
      // Ignore browser restrictions on window sizing/moving.
    }

    popup.location.href = url.toString()
    popup.focus()
  }, [analyzedPlaylistId, captionsEnabled, playbackRate, playStart, result, viewerCurrentTime, viewerSize.height, viewerSize.width, windowSessionId])

  useEffect(() => {
    setViewerCurrentTime(playStart)
  }, [playStart, result?.meta.videoId])

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== POPUP_PAUSE_KEY || !event.newValue) return

      try {
        const payload = JSON.parse(event.newValue) as { sourceId?: string }
        if (payload.sourceId && payload.sourceId === windowSessionId) return
        setPauseSignal((value) => value + 1)
      } catch {
        // Ignore malformed events.
      }
    }

    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [windowSessionId])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(display-mode: standalone)')
    const syncStandaloneState = () => setIsStandaloneApp(isStandaloneDisplayMode())
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault()
      setDeferredInstallPrompt(event as BeforeInstallPromptEvent)
    }
    const handleInstalled = () => {
      setDeferredInstallPrompt(null)
      syncStandaloneState()
    }
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement))
    }

    syncStandaloneState()
    mediaQuery.addEventListener('change', syncStandaloneState)
    window.addEventListener('beforeinstallprompt', handleInstallPrompt)
    window.addEventListener('appinstalled', handleInstalled)
    document.addEventListener('fullscreenchange', handleFullscreenChange)

    return () => {
      mediaQuery.removeEventListener('change', syncStandaloneState)
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt)
      window.removeEventListener('appinstalled', handleInstalled)
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [])

  useEffect(() => {
    if (!viewerOpen) return

    const handleWindowResize = () => {
      setViewerSize((currentSize) => {
        const resized = clampViewerSize(currentSize)
        setViewerPosition((currentPosition) => clampViewerPosition(currentPosition, resized))
        return resized
      })
    }

    window.addEventListener('resize', handleWindowResize)
    return () => window.removeEventListener('resize', handleWindowResize)
  }, [viewerOpen])

  useEffect(() => {
    try {
      if (isPopoutMode) return
      const raw = sessionStorage.getItem(VIEWER_PREFS_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as {
        sizePreset?: ViewerSizePreset
        captionsEnabled?: boolean
        playbackRate?: number
        mode?: ViewerMode
        position?: { x: number; y: number }
      }

      if (parsed.mode === 'floating') {
        setViewerMode('floating')
        if (
          parsed.position &&
          typeof parsed.position.x === 'number' &&
          typeof parsed.position.y === 'number'
        ) {
          setViewerPosition(parsed.position)
        }
      } else if (parsed.mode === 'top') {
        // Wasn't previously restored at all (only 'floating' was) --
        // reported directly wanting dock/top to stay available and
        // "stick" the same way floating position does, so a user who
        // explicitly docked to top keeps that choice too, not just one
        // who dragged into floating.
        setViewerMode('top')
      }

      if (parsed.sizePreset === 'S' || parsed.sizePreset === 'M' || parsed.sizePreset === 'L') {
        if (parsed.sizePreset === 'S') {
          setViewerSize({ width: MIN_VIEWER_WIDTH, height: MIN_VIEWER_HEIGHT })
        } else if (parsed.sizePreset === 'M') {
          setViewerSize({ width: MID_VIEWER_WIDTH, height: MID_VIEWER_HEIGHT })
        } else {
          if (typeof window !== 'undefined') {
            const availableWidth = Math.max(MIN_VIEWER_WIDTH, window.innerWidth - VIEWER_MARGIN * 2)
            const availableHeight = Math.max(MIN_VIEWER_HEIGHT, window.innerHeight - VIEWER_MARGIN * 2)
            const resized = clampViewerSize({
              width: availableWidth * 0.9,
              height: availableHeight * 0.9,
            })
            setViewerSize(resized)
            setViewerPosition({
              x: VIEWER_MARGIN + (availableWidth - resized.width) / 2,
              y: VIEWER_MARGIN + (availableHeight - resized.height) / 2,
            })
          }
        }
        setViewerSizePreset(parsed.sizePreset)
      }

      if (typeof parsed.captionsEnabled === 'boolean') {
        setCaptionsEnabled(parsed.captionsEnabled)
      }

      if (
        typeof parsed.playbackRate === 'number' &&
        PLAYBACK_RATES.includes(parsed.playbackRate as (typeof PLAYBACK_RATES)[number])
      ) {
        setPlaybackRate(parsed.playbackRate)
      }
    } catch {
      // Ignore malformed session storage values.
    }
  }, [isPopoutMode])

  useEffect(() => {
    try {
      if (isPopoutMode) return
      sessionStorage.setItem(
        VIEWER_PREFS_KEY,
        JSON.stringify({
          sizePreset: viewerSizePreset,
          captionsEnabled,
          playbackRate,
          mode: viewerMode,
          position: viewerMode === 'floating' ? viewerPosition : undefined,
        }),
      )
    } catch {
      // Ignore sessionStorage write failures.
    }
  }, [viewerSizePreset, captionsEnabled, playbackRate, isPopoutMode, viewerMode, viewerPosition])

  // Sort results based on selected sort type -- shared across both
  // sections; the live section hides its own sort row (hideSortControls)
  // so there's exactly one visible control, not two that could disagree.
  // Skipped entirely once the user has explicitly asked for Kids/Rhymes
  // content via a filter chip -- see hasKidsFilterActive's own comment.
  const kidsFilterActive = useMemo(
    () => hasKidsFilterActive(selectedFilters.map((f) => f.label)),
    [selectedFilters],
  )
  const sortedCacheResults = useMemo(() => {
    const sorted = sortSearchResults(cacheResults, searchSortType, searchQuery)
    return kidsFilterActive ? sorted : declutterMadeForKids(sorted)
  }, [cacheResults, searchSortType, searchQuery, kidsFilterActive])
  const sortedLiveResults = useMemo(() => {
    const sorted = sortSearchResults(liveResults, searchSortType, liveQuery ?? searchQuery)
    return kidsFilterActive ? sorted : declutterMadeForKids(sorted)
  }, [liveResults, searchSortType, liveQuery, searchQuery, kidsFilterActive])
  const cacheIsNarrowed = selectedFilters.length > 0 || Boolean(searchQuery.trim())

  // An external link (the sibling DEKHO project's detail pane) drives the
  // initial state two ways, independently: `?discover=<query>` pre-fills +
  // auto-runs Discovery search; `?videoId=` *without* `?popout=1` also
  // plays that video inline in the main view alongside the results list --
  // one for an unconfirmed title (search only), both together for a
  // confirmed one (search + play). Checked first so the trending default
  // below never races it.
  useEffect(() => {
    if (isPopoutMode) return
    if (defaultsLoaded) return
    if (!discoverQuery && !requestedVideoId) return
    setDefaultsLoaded(true)
    if (discoverQuery) handleSearchFromDiscovery(discoverQuery)
    if (requestedVideoId) runAnalysis(requestedVideoId)
  }, [isPopoutMode, discoverQuery, requestedVideoId, defaultsLoaded, handleSearchFromDiscovery, runAnalysis])

  useEffect(() => {
    if (isPopoutMode) return
    try {
      const raw = localStorage.getItem(SEARCH_HISTORY_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return
      setSearchHistory(
        parsed
          .filter((item): item is string => typeof item === 'string')
          .map((item) => item.trim())
          .filter(Boolean)
          .slice(0, SEARCH_HISTORY_LIMIT),
      )
    } catch {
      // Ignore malformed localStorage values.
    }
  }, [isPopoutMode])

  useEffect(() => {
    if (isPopoutMode) return
    const trimmed = searchQuery.trim()
    if (!trimmed) {
      setQuerySuggestions([])
      setSuggestionsLoading(false)
      return
    }

    let active = true
    setSuggestionsLoading(true)

    const timeoutId = setTimeout(async () => {
      try {
        const suggestions = await fetchSearchSuggestions(trimmed)
        if (!active) return
        setQuerySuggestions(suggestions)
      } catch {
        if (!active) return
        setQuerySuggestions([])
      } finally {
        if (active) setSuggestionsLoading(false)
      }
    }, 180)

    return () => {
      active = false
      clearTimeout(timeoutId)
    }
  }, [isPopoutMode, searchQuery])

  if (isPopoutMode) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white p-1.5">
        <div className="mx-auto max-w-6xl rounded-lg border border-white/10 bg-black/30 p-2">
          <div className="mb-2 flex items-center justify-end gap-2 text-xs text-zinc-300">
            {!isStandaloneApp && deferredInstallPrompt && (
              <button
                type="button"
                onClick={promptInstallApp}
                className="rounded border border-emerald-500/50 bg-emerald-500/15 px-2 py-1 text-emerald-200 transition hover:bg-emerald-500/20"
              >
                Install
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                void toggleFullscreen()
              }}
              className={`rounded border px-2 py-1 transition ${
                isFullscreen
                  ? 'border-red-500/60 bg-red-500/20 text-red-200'
                  : 'border-white/10 bg-white/5 hover:border-white/20 hover:text-white'
              }`}
            >
              {isFullscreen ? 'Exit Full' : 'Full'}
            </button>
            <button
              type="button"
              onClick={() => resizePopoutWindow('S')}
              className={`rounded border px-2 py-1 transition ${
                popoutSizePreset === 'S'
                  ? 'border-red-500/60 bg-red-500/20 text-red-200'
                  : 'border-white/10 bg-white/5 hover:border-white/20 hover:text-white'
              }`}
            >
              S
            </button>
            <button
              type="button"
              onClick={() => resizePopoutWindow('M')}
              className={`rounded border px-2 py-1 transition ${
                popoutSizePreset === 'M'
                  ? 'border-red-500/60 bg-red-500/20 text-red-200'
                  : 'border-white/10 bg-white/5 hover:border-white/20 hover:text-white'
              }`}
            >
              M
            </button>
            <button
              type="button"
              onClick={() => resizePopoutWindow('L')}
              className={`rounded border px-2 py-1 transition ${
                popoutSizePreset === 'L'
                  ? 'border-red-500/60 bg-red-500/20 text-red-200'
                  : 'border-white/10 bg-white/5 hover:border-white/20 hover:text-white'
              }`}
            >
              L
            </button>
            <button
              type="button"
              onClick={() => setCaptionsEnabled((enabled) => !enabled)}
              className={`rounded border px-2 py-1 transition ${
                captionsEnabled
                  ? 'border-red-500/60 bg-red-500/20 text-red-200'
                  : 'border-white/10 bg-white/5 hover:border-white/20 hover:text-white'
              }`}
            >
              CC
            </button>
            <button
              type="button"
              onClick={cyclePlaybackRate}
              className={`rounded border px-2 py-1 transition ${
                playbackRate !== 1
                  ? 'border-red-500/60 bg-red-500/20 text-red-200'
                  : 'border-white/10 bg-white/5 hover:border-white/20 hover:text-white'
              }`}
            >
              {playbackRate}x
            </button>
          </div>
          <VideoPlayer
            videoId={requestedVideoId}
            playlistId={popoutPlaylistId}
            startAt={popoutStartAt}
            captionsEnabled={captionsEnabled}
            playbackRate={playbackRate}
            pauseSignal={pauseSignal}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 top-0 h-96 w-96 rounded-full bg-red-600/10 blur-3xl" />
        <div className="absolute -right-40 bottom-0 h-96 w-96 rounded-full bg-red-900/10 blur-3xl" />
      </div>

      <div
        className="relative mx-auto max-w-6xl px-4 py-3 sm:px-6 sm:py-4"
        // The docked top panel below is `position: fixed` (so it can sit
        // above the header too, exactly like the video being the very
        // first thing on a YouTube mobile watch page) -- this padding is
        // what actually pushes the header + results grid down out from
        // under it, so "list below to scroll" means *this* content, not
        // something hidden behind the panel.
        style={viewerOpen && viewerMode === 'top' ? { paddingTop: TOP_PANEL_HEIGHT } : undefined}
      >
        <header className="mb-4 flex flex-col gap-2 sm:gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 shrink-0">
              <div>
                <h1 className="text-sm font-bold tracking-tight sm:text-base">
                  YouTube<span className="text-red-500">Max</span>
                </h1>              
              </div>
            </div>
            {import.meta.env.DEV && (
              <button
                type="button"
                onClick={() => setDevPlaylistManagerOpen(true)}
                aria-label="Open local playlist manager (dev only)"
                title="Local playlist manager — dev only"
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2 py-2 text-xs font-medium text-emerald-300 transition hover:border-emerald-500/40"
              >
                <span aria-hidden="true">🛠</span>
              </button>
            )}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setSettingsOpen((open) => !open)}
                aria-label="Open settings"
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:border-white/20 hover:text-white"
              >
                <span aria-hidden="true">⚙</span>
              </button>

              {settingsOpen && (
                // z-50: strictly above every other layered element on the page
                // (sticky search bar and scroll-top button are both z-30/z-40,
                // the docked video panel is z-40). Reported directly: on mobile
                // the dropdown rendered behind the search bar and result cards.
                // Root cause confirmed live -- this dropdown and the sticky
                // search bar below it are both z-30 siblings in the same
                // stacking context, and CSS breaks z-index ties by DOM order,
                // so the search bar (later in the tree) always painted on top
                // regardless of which one the user had actually just opened.
                <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-white/10 bg-zinc-950/95 p-3 shadow-2xl backdrop-blur">
                  <div className="mb-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      Display
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Choose which analysis panels stay visible.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    {[
                      {
                        label: 'Analyze by video/ID',
                        checked: showAnalyzeInput,
                        onChange: setShowAnalyzeInput,
                      },
                      {
                        label: 'Show chapters',
                        checked: showChaptersPanel,
                        onChange: setShowChaptersPanel,
                      },
                      {
                        label: 'Show summary',
                        checked: showSummaryPanel,
                        onChange: setShowSummaryPanel,
                      },
                      {
                        label: 'Show transcript',
                        checked: showTranscriptPanel,
                        onChange: setShowTranscriptPanel,
                      },
                      {
                        label: 'Debug messages',
                        checked: showDebugMessages,
                        onChange: setShowDebugMessages,
                      },
                    ].map((option) => (
                      <label
                        key={option.label}
                        className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2 text-sm text-zinc-200"
                      >
                        <span>{option.label}</span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={option.checked}
                          onClick={() => option.onChange((value) => !value)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                            option.checked ? 'bg-red-500/80' : 'bg-zinc-700'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 rounded-full bg-white transition ${
                              option.checked ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </label>
                    ))}
                  </div>

                  {/* YouTube API Services Terms of Service require this
                      kind of attribution/notice wherever an app is built
                      on YouTube data. */}
                  <p className="mt-3 border-t border-white/10 pt-3 text-[11px] leading-relaxed text-zinc-500">
                    Video data and playback via YouTube. Use of this app is subject to the{' '}
                    <a
                      href="https://www.youtube.com/t/terms"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-zinc-400 underline"
                    >
                      YouTube Terms of Service
                    </a>{' '}
                    and{' '}
                    <a
                      href="https://policies.google.com/privacy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-zinc-400 underline"
                    >
                      Google Privacy Policy
                    </a>
                    .
                  </p>
                </div>
              )}
            </div>
          </div>
          {showAnalyzeInput && (
            <div>
              <SearchBar onSearch={runAnalysis} loading={loading} />
            </div>
          )}
        </header>

        <div className="flex flex-col gap-1">
          {/* Search box + active-filter summary stay pinned to the top of
              the viewport while the results feed below scrolls -- with
              thousands of cached items in that feed now, losing access to
              these without scrolling all the way back up was the actual
              complaint. The full filter picker (FilterMenu, below) stays
              normal-flow/collapsible rather than also sticky -- it's opened,
              used, then closed, not needed while scrolling through results,
              and can get tall enough that pinning it would eat the screen. */}
          <div className="sticky top-0 z-30 -mx-4 flex flex-col gap-1 border-b border-white/5 bg-zinc-950/95 px-4 pb-2 pt-1 backdrop-blur sm:-mx-6 sm:px-6">
            {/* Selected filters — implicitly applied to every search until removed/cleared */}
            <SelectedFiltersBar
              filters={selectedFilters}
              onRemove={handleRemoveFilter}
              onClearAll={handleClearFilters}
              filtersOpen={filtersOpen}
              onToggleFilters={() => setFiltersOpen((v) => !v)}
            />

            {/* Discovery Search Bar (outside tabs) */}
            <DiscoverySearchBar
              query={searchQuery}
              onQueryChange={handleSearchQueryChange}
              onSubmit={(query) => {
                addSearchHistory(query)
                handleSearchFromDiscovery(query)
              }}
              loading={searchLoading}
              isVoiceListening={isVoiceListening}
              onToggleVoice={toggleVoiceSearch}
              history={searchHistory}
              onHistorySelect={handleHistorySelect}
              onHistoryDelete={removeSearchHistoryItem}
              onHistoryClear={clearSearchHistory}
              suggestions={querySuggestions}
              suggestionsLoading={suggestionsLoading}
              onSuggestionSelect={handleSuggestionSelect}
            />
          </div>

          {filtersOpen && (
            <FilterMenu
              selected={selectedFilters}
              onToggle={handleToggleFilter}
              onSelectEvergreen={handleSelectEvergreen}
              onToggleSlider={handleToggleSlider}
              facetCounts={facetCounts}
            />
          )}

          {showScrollTop && (
            <button
              type="button"
              onClick={scrollToTop}
              aria-label="Scroll back to top"
              title="Back to top"
              className="fixed bottom-5 right-4 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-zinc-900/90 text-lg text-zinc-200 shadow-2xl backdrop-blur transition hover:border-white/20 hover:text-white sm:right-6"
            >
              ↑
            </button>
          )}

          {showDebugMessages && searchError && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {searchError}
            </div>
          )}

          {showDebugMessages && searchSoftWarning && (
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

            <div className="border-b border-white/10 pt-18 pb-2" />

            {/* Discovery Content */}
            <div className="min-h-96">
              <div className="flex flex-col gap-3">
                {CURATED_PLAYLISTS.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {CURATED_PLAYLISTS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => togglePlaylist(p.id)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                          selectedPlaylists.includes(p.id)
                            ? 'border-red-500/50 bg-red-500/10 text-red-200'
                            : 'border-white/10 bg-black/30 text-zinc-400 hover:border-white/20 hover:text-zinc-200'
                        }`}
                      >
                        <span className="mr-1">{p.icon}</span>
                        {p.label}
                      </button>
                    ))}
                  </div>
                )}

                {playlistSections.length > 0 && (
                  <PlaylistSections
                    sections={playlistSections}
                    loading={playlistsLoading}
                    onSelectVideo={playVideoFromPlaylist}
                  />
                )}

                {liveResults.length > 0 && (
                  <SearchResultsGrid
                    results={liveResults}
                    sortedResults={sortedLiveResults}
                    sortType={searchSortType}
                    onSortChange={setSearchSortType}
                    onSelect={handleSelectSearchResult}
                    hasQuery
                    title={`Search results for "${liveQuery ?? searchQuery}"`}
                    hideSortControls
                    onDismiss={dismissLiveResults}
                  />
                )}

                <SearchResultsGrid
                  results={cacheResults}
                  sortedResults={sortedCacheResults}
                  sortType={searchSortType}
                  onSortChange={setSearchSortType}
                  onSelect={handleSelectSearchResult}
                  hasQuery={cacheIsNarrowed}
                  title={
                    selectedFilters.length > 0 && searchQuery.trim()
                      ? `Matching your filters and "${searchQuery.trim()}"`
                      : selectedFilters.length > 0
                        ? 'Matching your filters'
                        : searchQuery.trim()
                          ? `Matching "${searchQuery.trim()}"`
                          : 'From your library'
                  }
                  emptyMessage={
                    cacheLoading
                      ? 'Loading…'
                      : cacheIsNarrowed
                        ? 'No cached videos match yet.'
                        : 'Nothing cached yet — try a search below.'
                  }
                  countLabel={
                    cacheTotal > 0
                      ? `Showing ${cacheResults.length} of ${cacheTotal}`
                      : undefined
                  }
                  footer={
                    <div ref={cacheSentinelRef} className="flex justify-center py-4">
                      {cacheLoading && cacheResults.length > 0 && (
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-red-500" />
                      )}
                      {!cacheLoading && cacheOffset < cacheTotal && (
                        <button
                          type="button"
                          onClick={loadMoreCache}
                          className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-white/20 hover:text-white"
                        >
                          Load more
                        </button>
                      )}
                    </div>
                  }
                />
              </div>
            </div>
          </div>

          {/* Error state */}
          {showDebugMessages && error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-200">
              {error}
            </div>
          )}

          {/* Loading state */}
          {loading && !viewerOpen && (
            <div className="flex flex-col items-center gap-4 py-20 text-zinc-400">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-700 border-t-red-500" />
              <p>Fetching transcript and building chapters…</p>
            </div>
          )}


        </div>

      </div>

      {viewerOpen && (
        <div
          className={
            viewerMode === 'top'
              ? 'fixed inset-x-0 top-0 z-40 overflow-hidden border-b border-white/10 bg-zinc-950/95 shadow-2xl shadow-black/60 backdrop-blur'
              : 'fixed z-40 overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/95 shadow-2xl shadow-black/60 backdrop-blur'
          }
          style={
            viewerMode === 'top'
              ? { height: TOP_PANEL_HEIGHT }
              : {
                  left: viewerPosition.x,
                  top: viewerPosition.y,
                  width: viewerSize.width,
                  height: viewerSize.height,
                  maxWidth: `calc(100vw - ${VIEWER_MARGIN * 2}px)`,
                  maxHeight: `calc(100vh - ${VIEWER_MARGIN * 2}px)`,
                }
          }
        >
          <div className="flex h-full flex-col">
            <div
              onPointerDown={startViewerDrag}
              className="flex cursor-move touch-none items-center justify-end gap-2 border-b border-white/10 bg-black/30 px-3 py-2"
            >
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <button
                  type="button"
                  aria-label="Set viewer to minimum size"
                  onClick={(event) => {
                    event.stopPropagation()
                    resizeViewerToMin()
                  }}
                  className={`rounded border px-2 py-1 transition ${
                    viewerSizePreset === 'S'
                      ? 'border-red-500/60 bg-red-500/20 text-red-200'
                      : 'border-white/10 bg-white/5 text-zinc-300 hover:border-white/20 hover:text-white'
                  }`}
                >
                  S
                </button>
                <button
                  type="button"
                  aria-label="Set viewer to medium size"
                  onClick={(event) => {
                    event.stopPropagation()
                    resizeViewerToMedium()
                  }}
                  className={`rounded border px-2 py-1 transition ${
                    viewerSizePreset === 'M'
                      ? 'border-red-500/60 bg-red-500/20 text-red-200'
                      : 'border-white/10 bg-white/5 text-zinc-300 hover:border-white/20 hover:text-white'
                  }`}
                >
                  M
                </button>
                <button
                  type="button"
                  aria-label="Maximize viewer size"
                  onClick={(event) => {
                    event.stopPropagation()
                    resizeViewerToMax()
                  }}
                  className={`rounded border px-2 py-1 transition ${
                    viewerSizePreset === 'L'
                      ? 'border-red-500/60 bg-red-500/20 text-red-200'
                      : 'border-white/10 bg-white/5 text-zinc-300 hover:border-white/20 hover:text-white'
                  }`}
                >
                  L
                </button>
                {viewerMode === 'floating' && (
                  <button
                    type="button"
                    aria-label="Dock viewer to the top of the page"
                    title="Dock to top"
                    onClick={(event) => {
                      event.stopPropagation()
                      dockViewerToTop()
                    }}
                    className="rounded border border-white/10 bg-white/5 px-2 py-1 text-zinc-300 transition hover:border-white/20 hover:text-white"
                  >
                    ⤒
                  </button>
                )}
                <button
                  type="button"
                  aria-label="Open viewer in picture-in-picture window"
                  onClick={(event) => {
                    event.stopPropagation()
                    void openViewerPopout()
                  }}
                  className="rounded border border-white/10 bg-white/5 px-2 py-1 text-zinc-300 transition hover:border-white/20 hover:text-white"
                >
                  PiP
                </button>
                <button
                  type="button"
                  aria-label="Toggle captions"
                  onClick={(event) => {
                    event.stopPropagation()
                    setCaptionsEnabled((enabled) => !enabled)
                  }}
                  className={`rounded border px-2 py-1 transition ${
                    captionsEnabled
                      ? 'border-red-500/60 bg-red-500/20 text-red-200'
                      : 'border-white/10 bg-white/5 text-zinc-300 hover:border-white/20 hover:text-white'
                  }`}
                >
                  CC
                </button>
                <button
                  type="button"
                  aria-label="Cycle playback speed"
                  onClick={(event) => {
                    event.stopPropagation()
                    cyclePlaybackRate()
                  }}
                  className={`rounded border px-2 py-1 transition ${
                    playbackRate !== 1
                      ? 'border-red-500/60 bg-red-500/20 text-red-200'
                      : 'border-white/10 bg-white/5 text-zinc-300 hover:border-white/20 hover:text-white'
                  }`}
                >
                  {playbackRate}x
                </button>
                <button
                  type="button"
                  aria-label="Toggle fullscreen"
                  onClick={(event) => {
                    event.stopPropagation()
                    void toggleFullscreen()
                  }}
                  className={`rounded border px-2 py-1 transition ${
                    isFullscreen
                      ? 'border-red-500/60 bg-red-500/20 text-red-200'
                      : 'border-white/10 bg-white/5 text-zinc-300 hover:border-white/20 hover:text-white'
                  }`}
                >
                  {isFullscreen ? 'Exit Full' : 'Full'}
                </button>
                <button
                  type="button"
                  aria-label="Close viewer"
                  onClick={(event) => {
                    event.stopPropagation()
                    setViewerOpen(false)
                  }}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-300 transition hover:border-white/20 hover:text-white"
                >
                  <span aria-hidden="true">✕</span>
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-2.5 sm:p-3">
              {loading && (
                <div className="flex h-full min-h-48 flex-col items-center justify-center gap-4 text-zinc-400">
                  <div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-700 border-t-red-500" />
                  <p>Fetching transcript and building chapters…</p>
                </div>
              )}

              {!loading && result && (
                <div className="flex flex-col gap-3">
                  {showDebugMessages && <WarningsBanner warnings={result.warnings} />}
                  <div
                    className={`grid gap-3 ${
                      showChaptersPanel ? 'xl:grid-cols-[minmax(0,1fr)_280px]' : 'grid-cols-1'
                    }`}
                  >
                    <div className="flex min-w-0 flex-col gap-2">
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
                            onClick={stopClips}
                            className="ml-auto shrink-0 text-xs text-zinc-500 transition hover:text-white"
                          >
                            ✕ Stop
                          </button>
                        </div>
                      )}
                      <VideoPlayer
                        videoId={result.meta.videoId}
                        playlistId={analyzedPlaylistId}
                        startAt={playStart}
                        captionsEnabled={captionsEnabled}
                        playbackRate={playbackRate}
                        pauseSignal={pauseSignal}
                        onCurrentTimeChange={setViewerCurrentTime}
                      />
                    </div>

                    {showChaptersPanel && (
                      <aside className="rounded-lg border border-white/10 bg-white/[0.03] p-2 xl:max-h-[min(60vh,480px)] xl:flex xl:flex-col">
                        <ChapterList
                          chapters={displayedChapters}
                          allChapters={result.chapters}
                          filteredCount={filteredChapters.length}
                          allCount={result.chapters.length}
                          showFiltered={showFilteredChapters}
                          onToggleFilter={() => setShowFilteredChapters((value) => !value)}
                          filterTerms={parseSearchTerms(searchQuery)}
                          activeStart={playStart}
                          onSelect={selectChapter}
                          clipMode={clipMode}
                          clipIndex={clipIndex}
                          onPlayClips={startClips}
                          onStopClips={stopClips}
                        />
                      </aside>
                    )}
                  </div>

                  {showSummaryPanel && (
                    <div className="rounded-lg border border-white/10 bg-white/[0.03]">
                      <button
                        type="button"
                        onClick={() => setShowSummary((value) => !value)}
                        className="flex w-full items-center justify-between px-4 py-3 transition hover:bg-white/[0.05]"
                      >
                        <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
                          Summary
                        </h3>
                        <span
                          className={`text-xs text-zinc-500 transition ${showSummary ? 'rotate-180' : ''}`}
                        >
                          ▼
                        </span>
                      </button>
                      {showSummary && (
                        <div className="border-t border-white/5 px-4 py-3">
                          <SummaryCard summary={result.summary} />
                        </div>
                      )}
                    </div>
                  )}

                  {showTranscriptPanel && <TranscriptPanel segments={result.transcript} />}
                </div>
              )}

              {!loading && !result && (
                <div className="flex h-full min-h-48 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-16 text-center">
                  <div>
                    <p className="text-lg text-zinc-300">No video loaded</p>
                    <p className="mt-2 text-sm text-zinc-500">
                      Search or paste a YouTube link to start
                    </p>
                  </div>
                </div>
              )}
            </div>

            {viewerMode === 'floating' && (
              <button
                type="button"
                aria-label="Resize viewer"
                onPointerDown={startViewerResize}
                className="absolute bottom-1.5 right-1.5 h-5 w-5 touch-none cursor-se-resize rounded-sm text-zinc-500 transition hover:text-white"
              >
                <span className="pointer-events-none absolute bottom-0.5 right-0.5 block h-3 w-3 border-b-2 border-r-2 border-current" />
              </button>
            )}
          </div>
        </div>
      )}

      {import.meta.env.DEV && devPlaylistManagerOpen && (
        <PlaylistManagerPanel onClose={() => setDevPlaylistManagerOpen(false)} />
      )}

    </div>
  )
}

export default App
