import type { Keyword, TranscriptSegment } from './types.js'
import { STOP_WORDS, tokenize } from './text-utils.js'

const MAX_KEYWORDS = 28

function countTerms(text: string, weight = 1): Map<string, number> {
  const counts = new Map<string, number>()
  for (const word of tokenize(text)) {
    counts.set(word, (counts.get(word) ?? 0) + weight)
  }
  return counts
}

function countPhrases(text: string, weight = 1): Map<string, number> {
  const counts = new Map<string, number>()
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2)

  for (let i = 0; i < words.length - 1; i++) {
    const a = words[i]
    const b = words[i + 1]
    if (STOP_WORDS.has(a) && STOP_WORDS.has(b)) continue
    if (STOP_WORDS.has(a) || STOP_WORDS.has(b)) continue
    const phrase = `${a} ${b}`
    counts.set(phrase, (counts.get(phrase) ?? 0) + weight)
  }

  return counts
}

export function extractKeywords(
  transcript: TranscriptSegment[],
  summary: string,
  title: string,
  description: string,
): Keyword[] {
  const scores = new Map<string, { score: number; source: Keyword['source'] }>()

  const bump = (term: string, amount: number, source: Keyword['source']) => {
    const existing = scores.get(term)
    if (existing) {
      existing.score += amount
      if (
        source === 'title' ||
        (source === 'summary' && existing.source === 'transcript')
      ) {
        existing.source = source
      }
    } else {
      scores.set(term, { score: amount, source })
    }
  }

  for (const [term, count] of countTerms(title, 4)) {
    bump(term, count, 'title')
  }

  for (const [term, count] of countTerms(summary, 3)) {
    bump(term, count, 'summary')
  }

  const transcriptText = transcript.map((s) => s.text).join(' ')
  for (const [term, count] of countTerms(transcriptText, 1)) {
    bump(term, count, 'transcript')
  }

  for (const [term, count] of countPhrases(summary, 2)) {
    if (count >= 2) bump(term, count * 2.5, 'summary')
  }

  for (const [term, count] of countPhrases(transcriptText, 1)) {
    if (count >= 3) bump(term, count * 1.5, 'transcript')
  }

  const descSnippet = description.slice(0, 600)
  for (const [term, count] of countTerms(descSnippet, 0.5)) {
    bump(term, count, 'transcript')
  }

  const ranked = [...scores.entries()]
    .filter(([term]) => term.length >= 3 && !/^\d+$/.test(term))
    .map(([term, { score, source }]) => ({
      term,
      score: Math.round(score * 10) / 10,
      source,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_KEYWORDS)

  return ranked
}
