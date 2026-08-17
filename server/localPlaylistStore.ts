// fs-backed local playlist store. Deliberately Node-only (uses node:fs) —
// this file must never be imported from src/ (client bundle) or from
// api/*.ts (Vercel serverless — the repo checkout there is read-only at
// runtime and shouldn't be treated as a database anyway). It's wired
// exclusively through vite.config.ts's dev-only middleware, same as the
// rest of this project's local-dev-only tooling.
import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { SearchResultItem } from './types.js'

const PLAYLISTS_DIR = path.resolve(process.cwd(), 'data', 'playlists')
const SLUG_RE = /^[a-z0-9-]{1,64}$/

export interface LocalPlaylistItem {
  videoId: string
  title: string
  channel: string
  thumbnail: string
  /** Position in the playlist — explicit, not just array order, so reorder
   * operations are unambiguous and this survives a future migration to a
   * different storage shape. */
  position: number
}

export interface LocalPlaylist {
  slug: string
  label: string
  icon: string
  channel: string
  /** Where this playlist's *entry* came from — distinct from source of
   * each item. 'id' | 'url' | 'search' | 'manual' (created empty). */
  loadedVia: 'id' | 'url' | 'search' | 'manual'
  /** The real YouTube playlist ID this was seeded from, if any. Kept even
   * though items are now edited locally — this is what a future phase-2
   * sync would diff against. */
  sourcePlaylistId: string | null
  /** Set when seeded from YouTube; null for playlists created empty
   * locally. Not updated by local edits — see lastEditedAt for that. */
  lastPulledAt: string | null
  lastEditedAt: string
  items: LocalPlaylistItem[]
}

export class LocalPlaylistError extends Error {
  statusCode: number
  constructor(message: string, statusCode = 400) {
    super(message)
    this.name = 'LocalPlaylistError'
    this.statusCode = statusCode
  }
}

function slugify(label: string): string {
  const base = label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
  return base || 'playlist'
}

function filePathFor(slug: string): string {
  if (!SLUG_RE.test(slug)) {
    throw new LocalPlaylistError(`Invalid playlist slug: ${slug}`)
  }
  // path.resolve + the SLUG_RE check above rule out traversal (no '/', '..',
  // or leading dot can match), but resolving is cheap insurance regardless.
  return path.resolve(PLAYLISTS_DIR, `${slug}.json`)
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(PLAYLISTS_DIR, { recursive: true })
}

export async function listLocalPlaylists(): Promise<LocalPlaylist[]> {
  await ensureDir()
  const files = await fs.readdir(PLAYLISTS_DIR)
  const jsonFiles = files.filter((f) => f.endsWith('.json'))

  const playlists = await Promise.all(
    jsonFiles.map(async (file) => {
      const raw = await fs.readFile(path.join(PLAYLISTS_DIR, file), 'utf-8')
      return JSON.parse(raw) as LocalPlaylist
    }),
  )

  return playlists.sort((a, b) => a.label.localeCompare(b.label))
}

export async function readLocalPlaylist(slug: string): Promise<LocalPlaylist> {
  await ensureDir()
  try {
    const raw = await fs.readFile(filePathFor(slug), 'utf-8')
    return JSON.parse(raw) as LocalPlaylist
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new LocalPlaylistError(`No local playlist found for slug "${slug}"`, 404)
    }
    throw err
  }
}

async function writeLocalPlaylist(playlist: LocalPlaylist): Promise<void> {
  await ensureDir()
  playlist.lastEditedAt = new Date().toISOString()
  await fs.writeFile(filePathFor(playlist.slug), JSON.stringify(playlist, null, 2) + '\n', 'utf-8')
}

function toLocalItems(results: SearchResultItem[]): LocalPlaylistItem[] {
  return results.map((r, i) => ({
    videoId: r.videoId,
    title: r.title,
    channel: r.channel,
    thumbnail: r.thumbnail,
    position: i,
  }))
}

/** Creates a new local playlist file. If `seedResults` is provided (from an
 * ID/URL/search-then-pull load), items are seeded from it and
 * lastPulledAt is stamped; otherwise it's created empty. */
export async function createLocalPlaylist(input: {
  label: string
  icon?: string
  channel?: string
  loadedVia: LocalPlaylist['loadedVia']
  sourcePlaylistId?: string | null
  seedResults?: SearchResultItem[]
}): Promise<LocalPlaylist> {
  await ensureDir()

  let slug = slugify(input.label)
  let suffix = 2
  while (
    await fs
      .access(filePathFor(slug))
      .then(() => true)
      .catch(() => false)
  ) {
    slug = `${slugify(input.label)}-${suffix}`
    suffix += 1
  }

  const now = new Date().toISOString()
  const playlist: LocalPlaylist = {
    slug,
    label: input.label,
    icon: input.icon ?? '🎵',
    channel: input.channel ?? 'Local',
    loadedVia: input.loadedVia,
    sourcePlaylistId: input.sourcePlaylistId ?? null,
    lastPulledAt: input.seedResults ? now : null,
    lastEditedAt: now,
    items: input.seedResults ? toLocalItems(input.seedResults) : [],
  }

  await writeLocalPlaylist(playlist)
  return playlist
}

export async function updateLocalPlaylistMeta(
  slug: string,
  patch: Partial<Pick<LocalPlaylist, 'label' | 'icon' | 'channel'>>,
): Promise<LocalPlaylist> {
  const playlist = await readLocalPlaylist(slug)
  Object.assign(playlist, patch)
  await writeLocalPlaylist(playlist)
  return playlist
}

export async function addLocalPlaylistItem(
  slug: string,
  item: Omit<LocalPlaylistItem, 'position'>,
): Promise<LocalPlaylist> {
  const playlist = await readLocalPlaylist(slug)
  if (playlist.items.some((i) => i.videoId === item.videoId)) {
    throw new LocalPlaylistError(`${item.videoId} is already in this playlist`, 409)
  }
  playlist.items.push({ ...item, position: playlist.items.length })
  await writeLocalPlaylist(playlist)
  return playlist
}

export async function removeLocalPlaylistItem(slug: string, videoId: string): Promise<LocalPlaylist> {
  const playlist = await readLocalPlaylist(slug)
  playlist.items = playlist.items
    .filter((i) => i.videoId !== videoId)
    .map((i, idx) => ({ ...i, position: idx }))
  await writeLocalPlaylist(playlist)
  return playlist
}

/** Reorders items to match the given videoId order exactly. Throws if the
 * given order doesn't contain exactly the same set of videoIds already in
 * the playlist — reordering shouldn't silently add or drop items. */
export async function reorderLocalPlaylistItems(
  slug: string,
  orderedVideoIds: string[],
): Promise<LocalPlaylist> {
  const playlist = await readLocalPlaylist(slug)
  const currentIds = new Set(playlist.items.map((i) => i.videoId))
  const newIds = new Set(orderedVideoIds)

  if (currentIds.size !== newIds.size || [...currentIds].some((id) => !newIds.has(id))) {
    throw new LocalPlaylistError(
      'Reorder must contain exactly the same items already in the playlist — use add/remove for those.',
    )
  }

  const byId = new Map(playlist.items.map((i) => [i.videoId, i]))
  playlist.items = orderedVideoIds.map((id, idx) => ({ ...byId.get(id)!, position: idx }))
  await writeLocalPlaylist(playlist)
  return playlist
}

export async function deleteLocalPlaylist(slug: string): Promise<void> {
  try {
    await fs.unlink(filePathFor(slug))
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new LocalPlaylistError(`No local playlist found for slug "${slug}"`, 404)
    }
    throw err
  }
}
