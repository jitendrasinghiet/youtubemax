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

export const FILTER_TAXONOMY: Record<FilterDimensionKey, FilterDimension> = {
  language: {
    type: 'flat',
    label: 'Language',
    icon: '🗣️',
    items: [
      { label: 'Hindi', icon: 'हिं' },
      { label: 'English', icon: 'EN' },
      { label: 'Hinglish', icon: 'Hg' },
      { label: 'Tamil', icon: 'த' },
      { label: 'Telugu', icon: 'తె' },
      { label: 'Marathi', icon: 'म' },
      { label: 'Bengali', icon: 'বা' },
      { label: 'Punjabi', icon: 'ਪੰ' },
      { label: 'Kannada', icon: 'ಕ' },
      { label: 'Malayalam', icon: 'മ' },
    ],
  },

  category: {
    type: 'grouped',
    label: 'Category',
    icon: '🎬',
    groups: {
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
      kids: {
        label: 'Kids',
        icon: '🧸',
        items: [
          { label: 'Cartoon', icon: '📺' },
          { label: 'Animation', icon: '🎨' },
          { label: 'Nursery rhyme', icon: '🎶' },
          { label: 'Poem', icon: '📜' },
          { label: 'Kids song', icon: '🎵' },
          { label: 'Bedtime story', icon: '🌙' },
          { label: 'Fairy tale', icon: '🧚' },
          { label: 'Moral story', icon: '📖' },
          { label: 'Educational cartoon', icon: '🎓' },
          { label: 'Toy / toy play', value: 'Toy', icon: '🧸' },
        ],
      },
      education: {
        label: 'Education',
        icon: '🎓',
        items: [
          { label: 'School education', icon: '🏫' },
          { label: 'Exam preparation', icon: '📝' },
          { label: 'Tutorial', icon: '🎥' },
          { label: 'How-to', icon: '🔧' },
          { label: 'Lecture', icon: '🎙️' },
          { label: 'Course', icon: '📚' },
          { label: 'Science', icon: '🔬' },
          { label: 'Mathematics', icon: '➗' },
          { label: 'Language learning', icon: '🗣️' },
          { label: 'Coding', icon: '💻' },
          { label: 'Technology', icon: '💻' },
          { label: 'History', icon: '🏛️' },
          { label: 'Geography', icon: '🌍' },
          { label: 'Competitive exams', icon: '🏅' },
        ],
      },
      devotion: {
        label: 'Devotion & Spirituality',
        icon: '🕉️',
        items: [
          { label: 'Bhakti', icon: '🙏' },
          { label: 'Bhajan', icon: '🎶' },
          { label: 'Aarti', icon: '🪔' },
          { label: 'Mantra', icon: '📿' },
          { label: 'Katha', icon: '📖' },
          { label: 'Pravachan', icon: '🎙️' },
          { label: 'Meditation', icon: '🧘' },
          { label: 'Yoga', icon: '🧘‍♀️' },
          { label: 'Religious festival', icon: '🎊' },
          { label: 'Temple / pilgrimage', value: 'Temple', icon: '🛕' },
        ],
      },
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
      { label: 'Adult', icon: '🧑' },
      { label: 'Family', icon: '👨‍👩‍👧' },
      { label: 'Senior', icon: '👴' },
    ],
  },

  channel: {
    type: 'flat',
    label: 'Channel',
    icon: '📺',
    items: [
      { label: 'Doordarshan', icon: 'DD' },
      { label: 'T-Series', icon: 'T' },
      { label: 'Zee TV', icon: 'Z' },
      { label: 'StarPlus', icon: 'SP' },
      { label: 'Sony SAB', icon: 'SAB' },
      { label: 'SET India', icon: 'SET' },
      { label: 'Zee Music Company', icon: 'ZM' },
      { label: 'ChuChu TV', icon: 'CC' },
      { label: 'Cocomelon', icon: 'Coco' },
      { label: 'TED-Ed', icon: 'TED' },
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
