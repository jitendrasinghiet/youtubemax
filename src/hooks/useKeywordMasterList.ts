import { useCallback, useState } from 'react'
import type { AnalyzeResult, MasterKeyword } from '../types'

function mergeKeyword(
  existing: MasterKeyword | undefined,
  incoming: MasterKeyword,
): MasterKeyword {
  if (!existing) return incoming
  return {
    term: existing.term,
    score: Math.max(existing.score, incoming.score),
    source:
      incoming.source === 'title' || existing.source === 'title'
        ? 'title'
        : incoming.source === 'summary' || existing.source === 'summary'
          ? 'summary'
          : 'transcript',
    fromVideoId: incoming.fromVideoId,
    fromTitle: incoming.fromTitle,
  }
}

export function useKeywordMasterList() {
  const [keywords, setKeywords] = useState<MasterKeyword[]>([])

  const ingestFromAnalysis = useCallback((result: AnalyzeResult) => {
    setKeywords((prev) => {
      const map = new Map<string, MasterKeyword>()
      for (const item of prev) {
        map.set(item.term.toLowerCase(), item)
      }
      for (const kw of result.keywords) {
        const incoming: MasterKeyword = {
          term: kw.term,
          score: kw.score,
          source: kw.source,
          fromVideoId: result.meta.videoId,
          fromTitle: result.meta.title,
        }
        const key = kw.term.toLowerCase()
        map.set(key, mergeKeyword(map.get(key), incoming))
      }
      return [...map.values()].sort((a, b) => b.score - a.score)
    })
  }, [])

  const removeKeyword = useCallback((term: string) => {
    const key = term.toLowerCase()
    setKeywords((prev) => prev.filter((k) => k.term.toLowerCase() !== key))
  }, [])

  const clearKeywords = useCallback(() => setKeywords([]), [])

  return {
    keywords,
    ingestFromAnalysis,
    removeKeyword,
    clearKeywords,
  }
}
