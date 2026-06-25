export const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of',
  'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
  'may', 'might', 'must', 'shall', 'can', 'need', 'it', 'its', 'this', 'that',
  'these', 'those', 'i', 'you', 'he', 'she', 'we', 'they', 'what', 'which', 'who',
  'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more',
  'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so',
  'than', 'too', 'very', 'just', 'also', 'now', 'here', 'there', 'then', 'once',
  'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'up',
  'down', 'out', 'off', 'over', 'under', 'again', 'further', 'well', 'back',
  'even', 'because', 'until', 'while', 'if', 'your', 'our', 'their', 'my', 'his',
  'her', 'them', 'us', 'me', 'him', 'really', 'actually', 'basically', 'literally',
  'like', 'know', 'think', 'going', 'gonna', 'want', 'got', 'get', 'say', 'said',
  'yeah', 'okay', 'right', 'thing', 'things', 'something', 'anything', 'everything',
  'video', 'videos', 'watch', 'watched', 'youtube', 'channel', 'subscribe', 'hello',
  'welcome', 'today', 'guys', 'thank', 'thanks',
])

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
}

export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20)
}
