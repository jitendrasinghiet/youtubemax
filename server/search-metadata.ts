import type { SearchResultItem } from './types.js'

export interface YouTubeVideoItem {
  id?: string
  snippet?: {
    channelId?: string
    tags?: string[]
  }
  statistics?: {
    viewCount?: string
    likeCount?: string
    commentCount?: string
  }
  contentDetails?: {
    duration?: string
    caption?: string
  }
  status?: {
    embeddable?: boolean
    madeForKids?: boolean
    privacyStatus?: string
  }
  topicDetails?: {
    topicCategories?: string[]
  }
}

export interface YouTubeChannelItem {
  id?: string
  snippet?: {
    publishedAt?: string
  }
  statistics?: {
    subscriberCount?: string
    videoCount?: string
    viewCount?: string
  }
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value))
}

export function parseCount(value: string | undefined): number | undefined {
  if (!value) return undefined

  const compact = value.match(/(\d+(?:\.\d+)?)\s*([KMB])/i)
  if (compact) {
    const amount = parseFloat(compact[1])
    const unit = compact[2].toUpperCase()
    if (unit === 'K') return amount * 1_000
    if (unit === 'M') return amount * 1_000_000
    if (unit === 'B') return amount * 1_000_000_000
  }

  const digits = value.replace(/\D/g, '')
  if (!digits) return undefined

  const parsed = Number(digits)
  return Number.isFinite(parsed) ? parsed : undefined
}

export function parseIso8601DurationToSeconds(duration: string | undefined): number | undefined {
  if (!duration) return undefined

  const match = duration.match(/^P(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)$/i)
  if (!match) return undefined

  const hours = Number(match[1] ?? 0)
  const minutes = Number(match[2] ?? 0)
  const seconds = Number(match[3] ?? 0)
  return hours * 3600 + minutes * 60 + seconds
}

function yearsSince(isoDate: string | undefined): number {
  if (!isoDate) return 0
  const timestamp = Date.parse(isoDate)
  if (Number.isNaN(timestamp)) return 0
  const ageMs = Date.now() - timestamp
  return ageMs > 0 ? ageMs / (365.25 * 24 * 3600 * 1000) : 0
}

export function computeChannelTrustScore(channel: YouTubeChannelItem | undefined): number {
  if (!channel) return 0

  const subscriberCount = parseCount(channel.statistics?.subscriberCount) ?? 0
  const videoCount = parseCount(channel.statistics?.videoCount) ?? 0
  const channelAgeYears = yearsSince(channel.snippet?.publishedAt)

  const ageScore = clamp(channelAgeYears / 5)
  const subscriberScore = clamp(Math.log10(subscriberCount + 1) / Math.log10(1_000_000 + 1))
  const videoCountScore = clamp(videoCount / 200)

  return ageScore * 0.4 + subscriberScore * 0.4 + videoCountScore * 0.2
}

export function computeSafetyScore(options: {
  channelTrustScore?: number
  viewCount?: string
  likeCount?: string
  commentCount?: string
  durationSec?: number
  captioned?: boolean
  embeddable?: boolean
  madeForKids?: boolean
  privacyStatus?: string
}): number {
  if (options.privacyStatus && options.privacyStatus !== 'public') return 0

  const viewCount = parseCount(options.viewCount) ?? 0
  const likeCount = parseCount(options.likeCount)
  const commentCount = parseCount(options.commentCount)

  const trustScore = clamp(options.channelTrustScore ?? 0)
  const embeddableScore = options.embeddable === false ? 0 : 1
  const madeForKidsScore = options.madeForKids === true ? 1 : 0.55
  const captionScore =
    options.captioned === true ? 1 : options.captioned === false ? 0.35 : 0.5

  let durationScore = 0.5
  if (typeof options.durationSec === 'number') {
    if (options.durationSec < 60) durationScore = 0.2
    else if (options.durationSec <= 20 * 60) durationScore = 1
    else if (options.durationSec <= 40 * 60) durationScore = 0.6
    else durationScore = 0.25
  }

  const likeRatioScore =
    likeCount === undefined ? 0.5 : clamp((likeCount / Math.max(viewCount, 1)) / 0.04)

  const commentRatioScore =
    commentCount === undefined
      ? 0.5
      : clamp(1 - (commentCount / Math.max(viewCount, 1)) / 0.05, 0.2, 1)

  return clamp(
    trustScore * 0.35 +
      embeddableScore * 0.2 +
      madeForKidsScore * 0.15 +
      captionScore * 0.1 +
      durationScore * 0.1 +
      likeRatioScore * 0.07 +
      commentRatioScore * 0.03,
  )
}

export function enrichSearchResults(
  results: SearchResultItem[],
  videos: YouTubeVideoItem[],
  channels: YouTubeChannelItem[],
): SearchResultItem[] {
  const videoMap = new Map(videos.filter((item) => item.id).map((item) => [item.id!, item]))
  const channelMap = new Map(
    channels.filter((item) => item.id).map((item) => [item.id!, item]),
  )

  return results.map((result) => {
    const video = videoMap.get(result.videoId)
    const channelId = video?.snippet?.channelId ?? result.channelId
    const channel = channelId ? channelMap.get(channelId) : undefined
    const durationSec = parseIso8601DurationToSeconds(video?.contentDetails?.duration)
    const channelTrustScore = computeChannelTrustScore(channel)
    const safetyScore = computeSafetyScore({
      channelTrustScore,
      viewCount: video?.statistics?.viewCount ?? result.viewCount,
      likeCount: video?.statistics?.likeCount,
      commentCount: video?.statistics?.commentCount,
      durationSec,
      captioned:
        video?.contentDetails?.caption === 'true'
          ? true
          : video?.contentDetails?.caption === 'false'
            ? false
            : undefined,
      embeddable: video?.status?.embeddable,
      madeForKids: video?.status?.madeForKids,
      privacyStatus: video?.status?.privacyStatus,
    })

    return {
      ...result,
      channelId,
      durationSec,
      likeCount: video?.statistics?.likeCount,
      commentCount: video?.statistics?.commentCount,
      captioned:
        video?.contentDetails?.caption === 'true'
          ? true
          : video?.contentDetails?.caption === 'false'
            ? false
            : undefined,
      embeddable: video?.status?.embeddable,
      madeForKids: video?.status?.madeForKids,
      privacyStatus: video?.status?.privacyStatus,
      tags: video?.snippet?.tags,
      topicCategories: video?.topicDetails?.topicCategories,
      channelPublishedAt: channel?.snippet?.publishedAt,
      channelSubscriberCount: channel?.statistics?.subscriberCount,
      channelVideoCount: channel?.statistics?.videoCount,
      channelTotalViewCount: channel?.statistics?.viewCount,
      channelTrustScore,
      safetyScore,
    }
  })
}