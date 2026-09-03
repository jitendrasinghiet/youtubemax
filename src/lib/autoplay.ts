import type { SearchResultItem } from '../types'

// Same localStorage-preference pattern as VideoCard.tsx's MUTE_PREF_KEY and
// searchSort.ts's SORT_TYPE_KEY -- reported directly ("ytmax also should
// autoplay next items from list"), off by default since it changes what
// plays without an explicit click.
const AUTOPLAY_NEXT_KEY = 'youtubemax.autoplayNext'

export function loadAutoplayNextPreference(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(AUTOPLAY_NEXT_KEY) === 'true'
  } catch {
    return false
  }
}

export function persistAutoplayNextPreference(enabled: boolean): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(AUTOPLAY_NEXT_KEY, String(enabled))
  } catch {
    // storage full/unavailable -- preference just won't persist
  }
}

/** Finds the video that should play after `currentVideoId` within `list`
 *  (whichever of liveResults/cacheResults the current video actually came
 *  from -- see App.tsx's caller). Forward-only, no wraparound: unlike
 *  DEKHO's catalog nav there's no stable "whole library" ordering here to
 *  loop back into, just whatever page of search/cache results is loaded. */
export function nextResultVideoId(
  list: SearchResultItem[],
  currentVideoId: string,
): string | null {
  const currentIndex = list.findIndex((item) => item.videoId === currentVideoId)
  if (currentIndex === -1 || currentIndex === list.length - 1) return null
  return list[currentIndex + 1].videoId
}
