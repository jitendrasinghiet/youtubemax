import type { SearchResultItem } from '../types'

/** Builds a YouTube "watch_videos" playlist URL (YouTube's own mechanism
 *  for an ad-hoc, unsaved playlist from a list of video ids -- no account,
 *  no real playlist needed) starting at `startVideoId` and walking forward
 *  through `list` (whichever of liveResults/cacheResults the current video
 *  came from), wrapping around once. Ported from DEKHO's lib/cast.ts --
 *  same reasoning applies here: a single video already casts to
 *  Chromecast/Android TV for free via the iframe embed's native Cast
 *  icon, but there's no supported way for a third-party sender to command
 *  a Cast receiver to advance to a *next* item once casting starts.
 *  watch_videos sidesteps this by handing the whole sequence to YouTube's
 *  own app/site up front, so its native "up next" queue drives the
 *  advancing instead of this app. Unlike DEKHO's version there's no
 *  hasConfirmedVideo/videoIdFor translation needed -- every SearchResultItem
 *  is already a real, resolved YouTube video. */
export function youtubeCastPlaylistUrl(
  list: SearchResultItem[],
  startVideoId: string,
  maxItems = 50,
): string | null {
  const startIdx = list.findIndex((item) => item.videoId === startVideoId)
  if (startIdx === -1) return null

  const ids: string[] = []
  for (let step = 0; step < list.length && ids.length < maxItems; step++) {
    ids.push(list[(startIdx + step) % list.length].videoId)
  }
  if (ids.length === 0) return null

  const url = new URL('https://www.youtube.com/watch_videos')
  url.searchParams.set('video_ids', ids.join(','))
  return url.toString()
}
