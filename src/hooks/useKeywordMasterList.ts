import { useCallback, useMemo, useState } from 'react'
import type { AnalyzeResult, MasterKeyword } from '../types'

/**
 * Merges a new keyword with an existing one by taking the maximum score
 * and preferring keywords from earlier sources (title > chapter > summary > transcript).
 * 
 * @param existing - The keyword already in the master list
 * @param incoming - The new keyword from analysis
 * @returns Merged keyword with higher score and preferred source
 */
function mergeKeyword(
  existing: MasterKeyword | undefined,
  incoming: MasterKeyword,
): MasterKeyword {
  if (!existing) return incoming
  return {
    term: existing.term,
    score: Math.max(existing.score, incoming.score),
    // Priority: title (4x weight) > chapter (0.7x) > summary (3x) > transcript (1x)
    source:
      incoming.source === 'title' || existing.source === 'title'
        ? 'title'
        : incoming.source === 'chapter' || existing.source === 'chapter'
          ? 'chapter'
          : incoming.source === 'summary' || existing.source === 'summary'
            ? 'summary'
            : 'transcript',
    fromVideoId: incoming.fromVideoId,
    fromTitle: incoming.fromTitle,
  }
}

/**
 * Removes noise/filler keywords using statistical and semantic analysis.
 * 
 * Four-stage filtering:
 * 1. Frequency anomaly: Remove terms appearing >2σ above mean (heavily repeated = filler)
 * 2. Genericity: Remove terms in >80% of chapters (too generic/common)
 * 3. Superstring elimination: If "react hooks" exists, remove "react" (keep more specific)
 * 4. Substring bloat: Remove if term is substring in ≥50% of other keywords (noise)
 * 
 * @param keywords - All keywords from analysis
 * @returns Filtered keywords with noise removed
 * 
 * @example
 * Input: ["react", "react hooks", "the", "is", "useState", "component"]
 * Output: ["react hooks", "useState", "component"]  // Removed generic terms
 */
function pruneNoise(keywords: MasterKeyword[]): MasterKeyword[] {
  if (keywords.length < 3) return keywords

  // Stage 1: Calculate statistical thresholds for anomaly detection
  const frequencies = keywords
    .filter((kw) => typeof kw.frequency === 'number')
    .map((kw) => kw.frequency!)
  if (frequencies.length < 2) return keywords

  const mean = frequencies.reduce((a, b) => a + b, 0) / frequencies.length
  const variance =
    frequencies.reduce((sum, freq) => sum + Math.pow(freq - mean, 2), 0) / frequencies.length
  const stdDev = Math.sqrt(variance)

  // Filter using 4-stage noise detection
  return keywords.filter((kw) => {
    const freq = kw.frequency ?? 0
    const spread = kw.chapterSpread ?? 0
    const maxSpread = keywords.reduce((max, k) => Math.max(max, k.chapterSpread ?? 0), 1)
    const term = kw.term.toLowerCase()

    // Stage 1: Frequency anomaly detection
    // If term appears much more frequently than average, it's likely filler
    // (e.g., "the", "is", "and" repeated throughout transcript)
    if (stdDev > 0 && freq > mean + 2 * stdDev) return false

    // Stage 2: Genericity detection
    // If term appears in >80% of chapters, it's too generic for filtering
    // (e.g., "video", "tutorial", "minutes")
    if (maxSpread > 5 && spread > maxSpread * 0.8) return false

    // Stage 3: Superstring elimination
    // If a higher-scoring keyword contains this term, keep the longer one
    // E.g., keep "useReducer" over "use" for better specificity
    const isSuperstring = keywords.some(
      (other) =>
        other.score > kw.score &&
        other.term.toLowerCase() !== term &&
        other.term.toLowerCase().includes(term) &&
        other.term.toLowerCase().length > term.length,
    )
    if (isSuperstring) return false

    // Stage 4: Substring bloat elimination
    // If this term is a substring in ≥50% of other keywords, it's noise
    // E.g., "React" appears in ["React", "ReactDOM", "React Router", ...]
    const substrCount = keywords.filter(
      (other) => other.term.toLowerCase() !== term && other.term.toLowerCase().includes(term),
    ).length
    if (substrCount >= keywords.length * 0.5) return false

    return true
  })
}

/**
 * Custom hook for managing the master keyword list across multiple videos.
 * 
 * Features:
 * - Accumulates keywords from all analyzed videos
 * - Auto-merges duplicate keywords with max score
 * - Automatically prunes noise on every change
 * - Case-insensitive deduplication
 * - Sorted by relevance score (descending)
 * 
 * @returns Object with keywords array and action functions
 * 
 * @example
 * const { keywords, ingestFromAnalysis, removeKeyword } = useKeywordMasterList()
 * 
 * // After analyzing a video:
 * ingestFromAnalysis(analysisResult)
 * console.log(keywords)  // ["react", "useState", "useEffect", ...]
 * 
 * // Remove a keyword:
 * removeKeyword("useState")
 */
export function useKeywordMasterList() {
  // Raw keywords before pruning (allows undo/redo if needed)
  const [rawKeywords, setRawKeywords] = useState<MasterKeyword[]>([])

  // Derived pruned keywords (recomputed whenever rawKeywords changes)
  // useMemo ensures pruning only runs when rawKeywords actually changes
  const keywords = useMemo(() => pruneNoise(rawKeywords), [rawKeywords])

  /**
   * Ingests keywords from a video analysis result.
   * Merges with existing keywords (avoids duplicates, keeps highest score).
   * 
   * Flow:
   * 1. Create map of existing keywords (case-insensitive keys)
   * 2. For each new keyword, merge if it already exists
   * 3. Update map and sort by score
   * 4. Pruning runs automatically via useMemo
   */
  const ingestFromAnalysis = useCallback((result: AnalyzeResult) => {
    setRawKeywords((prev) => {
      const map = new Map<string, MasterKeyword>()
      
      // Keep existing keywords
      for (const item of prev) {
        map.set(item.term.toLowerCase(), item)
      }
      
      // Merge new keywords from analysis
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
      
      // Return as sorted array (highest score first)
      return [...map.values()].sort((a, b) => b.score - a.score)
    })
  }, [])

  /**
   * Removes a single keyword from the master list.
   * Case-insensitive match.
   */
  const removeKeyword = useCallback((term: string) => {
    const key = term.toLowerCase()
    setRawKeywords((prev) => prev.filter((k) => k.term.toLowerCase() !== key))
  }, [])

  /**
   * Clears all keywords from the master list.
   * Useful for starting fresh analysis.
   */
  const clearKeywords = useCallback(() => setRawKeywords([]), [])

  return {
    keywords,           // Pruned, sorted keywords
    ingestFromAnalysis,
    removeKeyword,
    clearKeywords,
  }
}
