// Filter taxonomy: Language, Category (grouped), Audience, Channel.
// Each leaf item carries a search-friendly `value` (sent to the YouTube search
// query) separate from its display `label`, plus an `icon` glyph used as the
// small badge in the filter menu and in the selected-filter chips.

export type FilterDimensionKey = 'language' | 'category' | 'audience' | 'channel'

export interface FilterItem {
  /** Display label shown in the menu and in chips. */
  label: string
  /** Term appended to the search query. Defaults to `label` if omitted. */
  value?: string
  /** Emoji or short text glyph rendered as the badge. */
  icon: string
}

export interface FilterGroup {
  label: string
  icon: string
  items: FilterItem[]
}

export interface FlatDimension {
  type: 'flat'
  label: string
  icon: string
  items: FilterItem[]
}

export interface GroupedDimension {
  type: 'grouped'
  label: string
  icon: string
  groups: Record<string, FilterGroup>
}

export type FilterDimension = FlatDimension | GroupedDimension

// Class 1 – Class 12, generated rather than hand-typed to avoid drift.
const GRADE_ITEMS: FilterItem[] = [
  { label: 'Nursery', icon: 'N' },
  { label: 'JrKG', icon: 'Jr' },
  { label: 'SrKG', icon: 'Sr' },
  ...Array.from({ length: 12 }, (_, i) => ({
    label: `Class ${i + 1}`,
    value: `Class ${i + 1}`,
    icon: String(i + 1),
  })),
]

export const FILTER_TAXONOMY: Record<FilterDimensionKey, FilterDimension> = {
  language: {
    type: 'flat',
    label: 'Language',
    icon: '🗣️',
    items: [
      { label: 'Hindi', icon: 'हिं' },
      { label: 'English', icon: 'EN' },
      { label: 'Tamil', icon: 'த' },
      { label: 'Telugu', icon: 'తె' },
      { label: 'Marathi', icon: 'म' },
      { label: 'Bengali', icon: 'বা' },
      { label: 'Punjabi', icon: 'ਪੰ' },
      { label: 'Kannada', icon: 'ಕ' },
      { label: 'Malayalam', icon: 'മ' },
      { label: 'Urdu', icon: 'اردو' },
      { label: 'Odia', icon: 'ଓ' },
      { label: 'Assamese', icon: 'অ' },
      { label: 'Haryanvi', icon: 'हरि' },
      { label: 'Bhojpuri', icon: 'भोज' },
      { label: 'Sanskrit', icon: 'सं' },
    ],
  },

  category: {
    type: 'grouped',
    label: 'Category',
    icon: '🎬',
    groups: {
      // Entertainment absorbed the old standalone Kids sub-category (all 10
      // items, two relabelled) — see instructions: "move all items to
      // Entertainment, delete sub-category Kids."
      entertainment: {
        label: 'Entertainment',
        icon: '🎬',
        items: [
          { label: 'TV serial', icon: '📺' },
          { label: 'Web series', icon: '🎥' },
          { label: 'Movie', icon: '🎬' },
          { label: 'Short film', icon: '🎞️' },
          { label: 'Comedy', icon: '😂' },
          { label: 'Drama', icon: '🎭' },
          { label: 'Reality show', icon: '📸' },
          { label: 'Talk show', icon: '🎙️' },
          { label: 'Interview', icon: '🗣️' },
          { label: 'Game show', icon: '🎯' },
          { label: 'Prank', icon: '😜' },
          { label: 'Vlog', icon: '📱' },
          // — formerly the Kids sub-category —
          { label: 'Cartoon', icon: '📺' },
          { label: 'Animation', icon: '🎨' },
          { label: 'Rhyme', icon: '🎶' },
          { label: 'Poem', icon: '📜' },
          { label: 'Kids song', icon: '🎵' },
          { label: 'Bedtime story', icon: '🌙' },
          { label: 'Fairy tale', icon: '🧚' },
          { label: 'Moral story', icon: '📖' },
          { label: 'Educational', icon: '🎓' },
          { label: 'Toy / toy play', value: 'Toy', icon: '🧸' },
        ],
      },
      music: {
        label: 'Music',
        icon: '🎵',
        items: [
          { label: 'Song', icon: '🎵' },
          { label: 'Music video', icon: '🎥' },
          { label: 'Lyrics / lyric video', value: 'Lyrics', icon: '📝' },
          { label: 'Live music', icon: '🎤' },
          { label: 'Classical music', icon: '🎻' },
          { label: 'Devotional music', icon: '🙏' },
          { label: 'Folk music', icon: '🪕' },
          { label: 'Ghazal', icon: '🎶' },
          { label: 'Remix', icon: '🔀' },
          { label: 'Karaoke', icon: '🎤' },
          { label: 'Cover song', icon: '🔁' },
        ],
      },
      // Education reworked: dropped School education / Language learning /
      // Technology, added science subjects and a full grade-level list.
      education: {
        label: 'Education',
        icon: '🎓',
        items: [
          { label: 'Exam preparation', icon: '📝' },
          { label: 'Tutorial', icon: '🎥' },
          { label: 'How-to', icon: '🔧' },
          { label: 'Lecture', icon: '🎙️' },
          { label: 'Course', icon: '📚' },
          { label: 'Science', icon: '🔬' },
          { label: 'Mathematics', icon: '➗' },
          { label: 'Physics', icon: '⚛️' },
          { label: 'Chemistry', icon: '🧪' },
          { label: 'Biology', icon: '🧬' },
          { label: 'Zoology', icon: '🦓' },
          { label: 'Botany', icon: '🌿' },
          { label: 'Coding', icon: '💻' },
          { label: 'History', icon: '🏛️' },
          { label: 'Geography', icon: '🌍' },
          { label: 'Competitive exams', icon: '🏅' },
          ...GRADE_ITEMS,
        ],
      },
      // Lifestyle absorbed Bhakti / Bhajan / Aarti / Yoga from the old
      // Devotion & Spirituality sub-category, which is now deleted.
      lifestyle: {
        label: 'Lifestyle',
        icon: '💆',
        items: [
          { label: 'Cooking', icon: '🍳' },
          { label: 'Recipe', icon: '📋' },
          { label: 'Food', icon: '🍽️' },
          { label: 'Travel', icon: '✈️' },
          { label: 'Fitness', icon: '🏋️' },
          { label: 'Health & wellness', icon: '💊' },
          { label: 'Beauty', icon: '💄' },
          { label: 'Fashion', icon: '👗' },
          { label: 'Parenting', icon: '🍼' },
          { label: 'Home & DIY', icon: '🔨' },
          { label: 'Pets', icon: '🐾' },
          // — moved from the deleted Devotion & Spirituality sub-category —
          { label: 'Bhakti', icon: '🙏' },
          { label: 'Bhajan', icon: '🎶' },
          { label: 'Aarti', icon: '🪔' },
          { label: 'Yoga', icon: '🧘‍♀️' },
        ],
      },
      relationships: {
        label: 'Relationships & Social',
        icon: '❤️',
        items: [
          { label: 'Love', icon: '❤️' },
          { label: 'Romance', icon: '💕' },
          { label: 'Marriage', icon: '💍' },
          { label: 'Relationships', icon: '🤝' },
          { label: 'Family', icon: '👨‍👩‍👧' },
          { label: 'Friendship', icon: '🧑‍🤝‍🧑' },
          { label: 'Motivation', icon: '💪' },
          { label: 'Inspirational', icon: '✨' },
          { label: 'Emotional / sad', value: 'Emotional', icon: '😢' },
        ],
      },
      news: {
        label: 'News & Information',
        icon: '📰',
        items: [
          { label: 'News', icon: '📰' },
          { label: 'Current affairs', icon: '🗞️' },
          { label: 'Politics', icon: '🏛️' },
          { label: 'Business', icon: '💼' },
          { label: 'Finance', icon: '💰' },
          { label: 'Sports news', icon: '🏆' },
          { label: 'Entertainment news', icon: '🎬' },
          { label: 'Crime', icon: '🚨' },
          { label: 'Documentary', icon: '🎥' },
        ],
      },
      sports: {
        label: 'Sports',
        icon: '🏆',
        items: [
          { label: 'Cricket', icon: '🏏' },
          { label: 'Football', icon: '⚽' },
          { label: 'Tennis', icon: '🎾' },
          { label: 'Badminton', icon: '🏸' },
          { label: 'Kabaddi', icon: '🤼' },
          { label: 'Wrestling', icon: '🤼‍♂️' },
          { label: 'Highlights', icon: '⭐' },
          { label: 'Live match', icon: '🔴' },
          { label: 'Analysis', icon: '📊' },
          { label: 'Training', icon: '🏋️' },
        ],
      },
      technology: {
        label: 'Technology',
        icon: '💻',
        items: [
          { label: 'Smartphone', icon: '📱' },
          { label: 'Gadget', icon: '⌚' },
          { label: 'Laptop / PC', value: 'Laptop', icon: '💻' },
          { label: 'Apps', icon: '📲' },
          { label: 'AI', icon: '🤖' },
          { label: 'Software', icon: '🖥️' },
          { label: 'Gaming', icon: '🎮' },
          { label: 'Reviews', icon: '⭐' },
          { label: 'Unboxing', icon: '📦' },
        ],
      },
    },
  },

  audience: {
    type: 'flat',
    label: 'Audience',
    icon: '🧑‍🤝‍🧑',
    items: [
      { label: 'Kids', icon: '🧒' },
      { label: 'Teen', icon: '🧑‍🎓' },
      { label: 'Male', icon: '👨' },
      { label: 'Female', icon: '👩' },
      { label: 'Family', icon: '👨‍👩‍👧' },
      { label: 'Old Retro', value: 'Retro', icon: '📻' },
    ],
  },

  // Mix of the biggest Indian TV networks and the biggest Indian YouTube
  // channels, spanning news, general entertainment, kids, music, and
  // creators — sourced from current subscriber/TRP rankings (Aug 2026).
  channel: {
    type: 'flat',
    label: 'Channel',
    icon: '📺',
    items: [
      { label: 'Doordarshan', icon: 'DD' },
      { label: 'StarPlus', icon: 'SP' },
      { label: 'Zee TV', icon: 'Z' },
      { label: 'Colors TV', icon: 'CO' },
      { label: 'Sony TV', icon: 'STV' },
      { label: 'Sony SAB', icon: 'SAB' },
      { label: 'Sun TV', icon: 'SUN' },
      { label: 'Aaj Tak', icon: 'AT' },
      { label: 'ABP News', icon: 'ABP' },
      { label: 'Republic TV', icon: 'RT' },
      { label: 'T-Series', icon: 'T' },
      { label: 'SET India', icon: 'SET' },
      { label: 'Zee Music Company', icon: 'ZM' },
      { label: 'Goldmines', icon: 'GM' },
      { label: 'Cocomelon', icon: 'Coco' },
      { label: 'ChuChu TV', icon: 'CC' },
      { label: 'Technical Guruji', icon: 'TeG' },
      { label: 'CarryMinati', icon: 'CM' },
      { label: 'Total Gaming', icon: 'ToG' },
    ],
  },
}

export function dimensionItemCount(dim: FilterDimension): number {
  if (dim.type === 'grouped') {
    return Object.values(dim.groups).reduce((n, g) => n + g.items.length, 0)
  }
  return dim.items.length
}

/** The literal text appended to the search query for this item. */
export function filterItemValue(item: FilterItem): string {
  return item.value ?? item.label
}
