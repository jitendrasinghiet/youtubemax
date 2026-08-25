export interface CuratedPlaylist {
  /** Real YouTube playlist ID (starts with PL/UU/LL/FL, etc). */
  id: string
  /** Display label for the picker chip and pinned section header. */
  label: string
  /** Emoji or short glyph, matching the style of FilterItem.icon. */
  icon: string
  /** Official channel this playlist belongs to — kept for attribution and
   * so whoever edits this file later can re-verify the entry is still the
   * real channel's playlist and not something that got renamed/deleted. */
  channel: string
}

/**
 * INTENTIONALLY EMPTY. I did not fabricate playlist IDs here — this list
 * needs the same sourcing discipline the 27 Evergreen combos got (real
 * official-channel playlists, verified against the actual channel), and I
 * don't have a reliable, verifiable way to look up live playlist IDs from
 * here (playlist IDs aren't consistently surfaced by general web search,
 * and manually scraping youtube.com pages to find them would just be the
 * same ToS problem this whole feature exists to move away from).
 *
 * To fill this in for real, once YOUTUBE_DATA_API_KEY is live:
 *   1. Go to the official channel's "Playlists" tab in a browser.
 *   2. Open the target playlist, copy the `list=` value from the URL.
 *   3. Sanity-check it with one real call before committing it here:
 *        curl "https://www.googleapis.com/youtube/v3/playlists?part=snippet&id=PLAYLIST_ID&key=$YOUTUBE_DATA_API_KEY"
 *      Confirm snippet.channelTitle matches the channel you expect.
 *   4. Add the entry below with that verified id/label/channel.
 *
 * Example shape once populated (NOT a real ID — do not use as-is):
 *   { id: 'PLxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', label: 'New Releases', icon: '🎵', channel: 'Some Official Label' }
 */
export const CURATED_PLAYLISTS: CuratedPlaylist[] = []
