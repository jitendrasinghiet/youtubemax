import { useCallback, useEffect, useMemo, useState } from 'react'
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
  fetchSearchSuggestions,
  parseSearchTerms,
  removeSearchTerm,
  searchVideos,
} from './lib/api'
import type { FilterDimensionKey } from './lib/filterTaxonomy'
import {
  buildEffectiveQuery,
  loadStoredFilters,
  makeSelectedFilter,
  persistFilters,
  removeFilter,
  toggleFilter,
  type SelectedFilter,
} from './lib/searchFilters'
import { sortSearchResults, type SearchSortType } from './lib/searchSort'
import type { AnalyzeResult, SearchResultItem } from './types'

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

  const popoutVideoId = searchParams.get('videoId')?.trim() ?? ''
  const popoutStartAt = Number(searchParams.get('start') ?? '0') || 0
  const isPopoutMode = searchParams.get('popout') === '1' && Boolean(popoutVideoId)
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
  const [showFilteredChapters, setShowFilteredChapters] = useState(false)
  const [showSummary, setShowSummary] = useState(true)
  const [viewerOpen, setViewerOpen] = useState(false)
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
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([])
  const [searchSortType, setSearchSortType] = useState<SearchSortType>('recommended')
  const [defaultsLoaded, setDefaultsLoaded] = useState(false)
  const [selectedFilters, setSelectedFilters] = useState<SelectedFilter[]>(() => loadStoredFilters())
  const [filtersOpen, setFiltersOpen] = useState(false)

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

  const runAnalysis = useCallback(
    async (input: string) => {
      setLoading(true)
      setError(null)
      setResult(null)
      setPlayStart(0)
      setViewerOpen(true)

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

  const handleVideoSearch = useCallback(async (input: string) => {
    setSearchLoading(true)
    setSearchError(null)
    setSearchSoftWarning(null)
    setSearchResults([])
    setSearchSortType('relevance')

    try {
      const effectiveQuery = buildEffectiveQuery(input, selectedFilters)
      const { results, warning } = await searchVideos(effectiveQuery)
      setSearchResults(results)
      if (warning) setSearchSoftWarning(warning)
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setSearchLoading(false)
    }
  }, [selectedFilters])

  // Persist selected filters so they survive a reload.
  useEffect(() => {
    persistFilters(selectedFilters)
  }, [selectedFilters])

  // Filters are implicit: changing them silently re-runs whatever search is
  // currently active (typed query, or the default feed) so results always
  // reflect the applied filters until removed or cleared.
  useEffect(() => {
    if (!defaultsLoaded) return
    handleVideoSearch(searchQuery || 'trending')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFilters])

  const handleToggleFilter = useCallback(
    (dimension: FilterDimensionKey, label: string, icon: string, group?: string) => {
      setSelectedFilters((prev) => toggleFilter(prev, makeSelectedFilter(dimension, label, icon, group)))
    },
    [],
  )

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
      const size = clampViewerSize(viewerSize)
      const bottomRightPosition = clampViewerPosition(
        {
          x: window.innerWidth - size.width - VIEWER_MARGIN,
          y: window.innerHeight - size.height - VIEWER_MARGIN,
        },
        size,
      )
      setViewerPosition(bottomRightPosition)
      runAnalysis(videoId)
    },
    [runAnalysis, viewerSize],
  )

  const startViewerDrag = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault()

      const startPointer = { x: event.clientX, y: event.clientY }
      const startPosition = viewerPosition
      const size = clampViewerSize(viewerSize)

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const nextPosition = clampViewerPosition(
          {
            x: startPosition.x + (moveEvent.clientX - startPointer.x),
            y: startPosition.y + (moveEvent.clientY - startPointer.y),
          },
          size,
        )
        setViewerPosition(nextPosition)
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
    setViewerPosition({
      x: VIEWER_MARGIN + (availableWidth - resized.width) / 2,
      y: VIEWER_MARGIN + (availableHeight - resized.height) / 2,
    })
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
  }, [captionsEnabled, playbackRate, playStart, result, viewerCurrentTime, viewerSize.height, viewerSize.width, windowSessionId])

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
        }),
      )
    } catch {
      // Ignore sessionStorage write failures.
    }
  }, [viewerSizePreset, captionsEnabled, playbackRate, isPopoutMode])

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
            videoId={popoutVideoId}
            startAt={popoutStartAt}
            captionsEnabled={captionsEnabled}
            playbackRate={playbackRate}
            pauseSignal={pauseSignal}
          />
        </div>
      </div>
    )
  }

  // Sort results based on selected sort type
  const sortedSearchResults = useMemo(
    () => sortSearchResults(searchResults, searchSortType, searchQuery),
    [searchResults, searchSortType, searchQuery],
  )

  // Load default trending videos on first mount (session-based)
  useEffect(() => {
    if (!defaultsLoaded && searchResults.length === 0 && !searchQuery) {
      setDefaultsLoaded(true)
      handleVideoSearch('trending')
    }
  }, [defaultsLoaded, searchResults.length, searchQuery, handleVideoSearch])

  useEffect(() => {
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
  }, [])

  useEffect(() => {
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
  }, [searchQuery])

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 top-0 h-96 w-96 rounded-full bg-red-600/10 blur-3xl" />
        <div className="absolute -right-40 bottom-0 h-96 w-96 rounded-full bg-red-900/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 py-3 sm:px-6 sm:py-4">
        <header className="mb-4 flex flex-col gap-2 sm:gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 shrink-0">
              <div>
                <h1 className="text-sm font-bold tracking-tight sm:text-base">
                  YouTube<span className="text-red-500">Max</span>
                </h1>              
              </div>
            </div>
            {!isStandaloneApp && deferredInstallPrompt && (
              <div className="min-w-0 flex-1 px-1 text-center text-[11px] text-emerald-200 sm:text-xs">
                <span className="hidden sm:inline">Install as app on Android for a cleaner no-address-bar experience.</span>
                <button
                  type="button"
                  onClick={() => {
                    void promptInstallApp()
                  }}
                  className="ml-0 rounded border border-emerald-400/50 bg-emerald-500/15 px-2 py-0.5 font-medium text-emerald-100 transition hover:bg-emerald-500/25 sm:ml-2"
                >
                  Install
                </button>
              </div>
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
                <div className="absolute right-0 top-full z-30 mt-2 w-64 rounded-xl border border-white/10 bg-zinc-950/95 p-3 shadow-2xl backdrop-blur">
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
          {/* Selected filters — implicitly applied to every search until removed/cleared */}
          <SelectedFiltersBar
            filters={selectedFilters}
            onRemove={handleRemoveFilter}
            onClearAll={handleClearFilters}
            filtersOpen={filtersOpen}
            onToggleFilters={() => setFiltersOpen((v) => !v)}
          />

          {filtersOpen && (
            <FilterMenu selected={selectedFilters} onToggle={handleToggleFilter} />
          )}

          {/* Discovery Search Bar (outside tabs) */}
          <DiscoverySearchBar
            query={searchQuery}
            onQueryChange={setSearchQuery}
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
                <SearchResultsGrid
                  results={searchResults}
                  sortedResults={sortedSearchResults}
                  sortType={searchSortType}
                  onSortChange={setSearchSortType}
                  onSelect={handleSelectSearchResult}
                  hasQuery={Boolean(searchQuery.trim())}
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
          className="fixed z-40 overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/95 shadow-2xl shadow-black/60 backdrop-blur"
          style={{
            left: viewerPosition.x,
            top: viewerPosition.y,
            width: viewerSize.width,
            height: viewerSize.height,
            maxWidth: `calc(100vw - ${VIEWER_MARGIN * 2}px)`,
            maxHeight: `calc(100vh - ${VIEWER_MARGIN * 2}px)`,
          }}
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

            <button
              type="button"
              aria-label="Resize viewer"
              onPointerDown={startViewerResize}
              className="absolute bottom-1.5 right-1.5 h-5 w-5 touch-none cursor-se-resize rounded-sm text-zinc-500 transition hover:text-white"
            >
              <span className="pointer-events-none absolute bottom-0.5 right-0.5 block h-3 w-3 border-b-2 border-r-2 border-current" />
            </button>
          </div>
        </div>
      )}


    </div>
  )
}

export default App
