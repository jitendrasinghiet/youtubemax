import { splitSentences, tokenize } from './text-utils'

export function generateSummary(segments: { text: string }[], maxSentences = 6): string {
  const fullText = segments.map((s) => s.text).join(' ')
  const sentences = splitSentences(fullText)

  if (sentences.length === 0) {
    const fallback = fullText.trim()
    if (!fallback) return 'No transcript available to summarize.'
    return fallback.length > 400 ? `${fallback.slice(0, 397)}…` : fallback
  }

  if (sentences.length <= maxSentences) {
    return sentences.join(' ')
  }

  const freq = new Map<string, number>()
  for (const sentence of sentences) {
    for (const word of tokenize(sentence)) {
      freq.set(word, (freq.get(word) ?? 0) + 1)
    }
  }

  const scored = sentences.map((sentence, index) => {
    const words = tokenize(sentence)
    const score =
      words.reduce((sum, w) => sum + (freq.get(w) ?? 0), 0) / Math.max(words.length, 1)
    const positionBonus = index === 0 ? 2 : index < 3 ? 0.5 : 0
    return { sentence, index, score: score + positionBonus }
  })

  const top = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSentences)
    .sort((a, b) => a.index - b.index)
    .map((s) => s.sentence)

  return top.join(' ')
}
