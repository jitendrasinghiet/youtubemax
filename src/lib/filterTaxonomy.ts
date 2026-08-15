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
  /**
   * Evergreen-only: cross-dimension tags used for (a) hiding this item when
   * it conflicts with filters already selected elsewhere, and (b) auto-
   * filling those dimensions when the user selects this item and hasn't
   * chosen anything there yet. `category` refs point at {group, label}
   * pairs in other category groups (never at Evergreen itself, and never
   * at a slider-only group — see FilterGroup.sliderItems).
   */
  impliedFilters?: {
    language?: string[]
    category?: { group: string; label: string }[]
    audience?: string[]
    channel?: string[]
  }
}

/**
 * Minimal, editorial (not computed/scored) grouping of a group's `items`
 * into small contextual cards, so a 15–23 item flat grid reads as a few
 * related clusters instead of one wall of chips. `itemLabels` must cover
 * every label in the group's `items` array exactly once — checked at
 * runtime in dev via validateClusterCoverage (see bottom of file).
 */
export interface FilterCluster {
  label: string
  itemLabels: string[]
}

export interface FilterGroup {
  label: string
  icon: string
  /** Rendered as clustered chip cards. Empty for slider-only groups (Era). */
  items: FilterItem[]
  /** Editorial clustering of `items` into cards. Omit for slider-only groups. */
  clusters?: FilterCluster[]
  /**
   * Rendered as a single horizontal slider instead of a chip grid —
   * ordinal/continuous pickers (year, grade level) rather than a set of
   * independent tags. Slider selections are single-select (choosing a new
   * value replaces the previous one in that group) and are deliberately
   * EXCLUDED from Evergreen's contextual eligibility matching — see
   * isEvergreenEligible in searchFilters.ts. A group may have both `items`
   * (clustered grid) and `sliderItems` (e.g. Education: subjects as chips,
   * grade level as a slider) — Era has only sliderItems.
   */
  sliderItems?: FilterItem[]
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
// Rendered as a slider within the Education group, not the item grid.
const GRADE_SLIDER_ITEMS: FilterItem[] = [
  { label: 'Nursery', icon: 'N' },
  { label: 'JrKG', icon: 'Jr' },
  { label: 'SrKG', icon: 'Sr' },
  ...Array.from({ length: 12 }, (_, i) => ({
    label: `Class ${i + 1}`,
    value: `Class ${i + 1}`,
    icon: String(i + 1),
  })),
]

// 1940s – 2020s. A standalone Category group rendered as a slider. Not a
// filter-criteria dimension — excluded from Evergreen eligibility matching
// in both directions (an Era selection never hides/shows an Evergreen
// combo, and no Evergreen combo carries an Era tag).
const ERA_SLIDER_ITEMS: FilterItem[] = Array.from({ length: 9 }, (_, i) => {
  const decade = 1940 + i * 10
  return { label: `${decade}s`, value: `${decade}s`, icon: `'${String(decade).slice(2)}` }
})

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
      // One-tap popular-query shortcuts. Sourced from Google's India Year
      // in Search 2025 and YouTube's 2025 India trends reports, evergreen
      // items only (time-sensitive ones like IPL/Gemini/Saiyaara were
      // deliberately excluded — see docs/FILTER_ROADMAP.md item 8). Each
      // item's `impliedFilters` drives contextual show/hide + auto-fill;
      // see isEvergreenEligible / applyEvergreenSelection in searchFilters.ts.
      evergreen: {
        label: 'Evergreen',
        icon: '🌲',
        clusters: [
          {
            label: 'Devotional & Family',
            itemLabels: [
              'Hanuman Chalisa',
              'Aarti Sangrah',
              'Bhagavad Gita Explained',
              'Ramayan Full Episodes',
              'Mahabharat Full Episodes',
              'Morning Bhajans',
            ],
          },
          {
            label: 'Music',
            itemLabels: [
              'Bollywood-style Latest Songs',
              'Hindi Songs',
              'English Songs',
              'Punjabi Songs',
              'Romantic Hindi Songs',
              'Lofi / Study Music',
            ],
          },
          {
            label: 'Kids & Learning',
            itemLabels: [
              'Nursery Rhymes',
              'ABC Song for Kids',
              'Class 10 Maths',
              'NCERT Science',
              'Spoken English Practice',
            ],
          },
          {
            label: 'Gaming',
            itemLabels: ['BGMI Gameplay', 'Free Fire Highlights', 'Minecraft Survival', 'Total Gaming Live'],
          },
          {
            label: 'Money & Tech',
            itemLabels: ['Income Tax Filing', 'SIP Explained', 'Smartphone Review', 'Technical Guruji Review'],
          },
          {
            label: 'Lifestyle',
            itemLabels: ['Home Workout', 'Quick Indian Recipes'],
          },
          {
            label: 'Entertainment',
            itemLabels: ['CarryMinati Comedy', 'Upcoming Movie Trailers'],
          },
        ],
        items: [
          {
            label: 'Hanuman Chalisa',
            value: 'Hanuman Chalisa',
            icon: '📿',
            impliedFilters: {
              language: ['Hindi'],
              category: [{ group: 'lifestyle', label: 'Bhakti' }],
              audience: ['Old Retro', 'Family'],
            },
          },
          {
            label: 'Aarti Sangrah',
            value: 'aarti sangrah',
            icon: '🪔',
            impliedFilters: {
              language: ['Hindi'],
              category: [{ group: 'lifestyle', label: 'Aarti' }],
              audience: ['Old Retro', 'Family'],
            },
          },
          {
            label: 'Bhagavad Gita Explained',
            value: 'Bhagavad Gita explained',
            icon: '📖',
            impliedFilters: {
              language: ['Hindi', 'English'],
              category: [{ group: 'lifestyle', label: 'Bhakti' }],
              audience: ['Old Retro'],
            },
          },
          {
            label: 'Ramayan Full Episodes',
            value: 'Ramayan full episodes',
            icon: '🛕',
            impliedFilters: {
              language: ['Hindi'],
              category: [{ group: 'entertainment', label: 'TV serial' }],
              audience: ['Family', 'Old Retro'],
              channel: ['Doordarshan'],
            },
          },
          {
            label: 'Mahabharat Full Episodes',
            value: 'Mahabharat full episodes',
            icon: '⚔️',
            impliedFilters: {
              language: ['Hindi'],
              category: [{ group: 'entertainment', label: 'TV serial' }],
              audience: ['Family', 'Old Retro'],
              channel: ['Doordarshan'],
            },
          },
          {
            label: 'Morning Bhajans',
            value: 'morning bhajan Hindi',
            icon: '🌅',
            impliedFilters: {
              language: ['Hindi'],
              category: [{ group: 'lifestyle', label: 'Bhajan' }],
              audience: ['Old Retro', 'Family'],
            },
          },
          {
            label: 'Bollywood-style Latest Songs',
            value: 'Bollywood latest songs',
            icon: '🎬',
            impliedFilters: {
              language: ['Hindi'],
              category: [{ group: 'music', label: 'Song' }],
              channel: ['T-Series'],
            },
          },
          {
            // Renamed from "Old Hindi Songs (90s)" — no longer era-specific
            // (era now lives in its own Category group, see `era` below),
            // so the old "Old Retro"-only audience tag was dropped too;
            // this is now a general Hindi-songs shortcut, not a nostalgia one.
            label: 'Hindi Songs',
            value: 'Hindi songs',
            icon: '📻',
            impliedFilters: {
              language: ['Hindi'],
              category: [{ group: 'music', label: 'Song' }],
            },
          },
          {
            label: 'English Songs',
            value: 'English songs',
            icon: '🎵',
            impliedFilters: {
              language: ['English'],
              category: [{ group: 'music', label: 'Song' }],
            },
          },
          {
            label: 'Punjabi Songs',
            value: 'Punjabi songs latest',
            icon: '🎶',
            impliedFilters: {
              language: ['Punjabi'],
              category: [{ group: 'music', label: 'Song' }],
            },
          },
          {
            label: 'Romantic Hindi Songs',
            value: 'romantic Hindi songs',
            icon: '💕',
            impliedFilters: {
              language: ['Hindi'],
              category: [
                { group: 'music', label: 'Song' },
                { group: 'relationships', label: 'Romance' },
              ],
              audience: ['Teen'],
            },
          },
          {
            label: 'Lofi / Study Music',
            value: 'lofi study music',
            icon: '🎧',
            impliedFilters: {
              audience: ['Teen'],
            },
          },
          {
            label: 'Nursery Rhymes',
            value: 'nursery rhymes English',
            icon: '🎵',
            impliedFilters: {
              language: ['English'],
              category: [{ group: 'entertainment', label: 'Rhyme' }],
              audience: ['Kids'],
              channel: ['ChuChu TV', 'Cocomelon'],
            },
          },
          {
            label: 'ABC Song for Kids',
            value: 'ABC song for kids',
            icon: '🔤',
            impliedFilters: {
              language: ['English'],
              category: [{ group: 'entertainment', label: 'Rhyme' }],
              audience: ['Kids'],
              channel: ['ChuChu TV', 'Cocomelon'],
            },
          },
          {
            label: 'Class 10 Maths',
            value: 'Class 10 maths',
            icon: '➗',
            impliedFilters: {
              language: ['English', 'Hindi'],
              category: [
                { group: 'education', label: 'Mathematics' },
              ],
              audience: ['Teen'],
            },
          },
          {
            label: 'NCERT Science',
            value: 'NCERT science tutorial',
            icon: '🔬',
            impliedFilters: {
              language: ['English', 'Hindi'],
              category: [{ group: 'education', label: 'Science' }],
              audience: ['Teen'],
            },
          },
          {
            label: 'Spoken English Practice',
            value: 'spoken English practice',
            icon: '🗣️',
            impliedFilters: {
              language: ['English'],
              audience: ['Teen'],
            },
          },
          {
            label: 'BGMI Gameplay',
            value: 'BGMI gameplay',
            icon: '🎮',
            impliedFilters: {
              category: [{ group: 'technology', label: 'Gaming' }],
              audience: ['Teen', 'Male'],
            },
          },
          {
            label: 'Free Fire Highlights',
            value: 'Free Fire highlights',
            icon: '🔥',
            impliedFilters: {
              category: [{ group: 'technology', label: 'Gaming' }],
              audience: ['Teen', 'Male'],
              channel: ['Total Gaming'],
            },
          },
          {
            label: 'Minecraft Survival',
            value: 'Minecraft survival',
            icon: '⛏️',
            impliedFilters: {
              category: [{ group: 'technology', label: 'Gaming' }],
              audience: ['Kids', 'Teen'],
            },
          },
          {
            label: 'Total Gaming Live',
            value: 'Total Gaming live',
            icon: '🔴',
            impliedFilters: {
              category: [{ group: 'technology', label: 'Gaming' }],
              audience: ['Teen', 'Male'],
              channel: ['Total Gaming'],
            },
          },
          {
            label: 'Income Tax Filing',
            value: 'income tax filing how to',
            icon: '🧾',
            impliedFilters: {
              language: ['English', 'Hindi'],
              category: [{ group: 'news', label: 'Business' }],
            },
          },
          {
            label: 'SIP Explained',
            value: 'SIP mutual fund explained',
            icon: '💰',
            impliedFilters: {
              language: ['English', 'Hindi'],
              category: [{ group: 'news', label: 'Finance' }],
            },
          },
          {
            label: 'Smartphone Review',
            value: 'latest smartphone review',
            icon: '📱',
            impliedFilters: {
              category: [
                { group: 'technology', label: 'Smartphone' },
                { group: 'technology', label: 'Reviews' },
              ],
              channel: ['Technical Guruji'],
            },
          },
          {
            label: 'Home Workout',
            value: 'home workout beginner',
            icon: '🏋️',
            impliedFilters: {
              category: [{ group: 'lifestyle', label: 'Fitness' }],
              audience: ['Male', 'Female'],
            },
          },
          {
            label: 'Quick Indian Recipes',
            value: 'quick Indian recipes',
            icon: '🍲',
            impliedFilters: {
              category: [
                { group: 'lifestyle', label: 'Cooking' },
                { group: 'lifestyle', label: 'Recipe' },
              ],
              audience: ['Female'],
            },
          },
          {
            label: 'CarryMinati Comedy',
            value: 'CarryMinati comedy',
            icon: '😂',
            impliedFilters: {
              language: ['Hindi'],
              category: [{ group: 'entertainment', label: 'Comedy' }],
              audience: ['Teen'],
              channel: ['CarryMinati'],
            },
          },
          {
            label: 'Technical Guruji Review',
            value: 'Technical Guruji review',
            icon: '⭐',
            impliedFilters: {
              language: ['Hindi'],
              category: [{ group: 'technology', label: 'Reviews' }],
              channel: ['Technical Guruji'],
            },
          },
          {
            label: 'Upcoming Movie Trailers',
            value: 'upcoming movie trailers',
            icon: '📽️',
            impliedFilters: {
              category: [{ group: 'entertainment', label: 'Trailer' }],
            },
          },
        ],
      },
      // Entertainment absorbed the old standalone Kids sub-category (all 10
      // items, two relabelled) — see instructions: "move all items to
      // Entertainment, delete sub-category Kids."
      entertainment: {
        label: 'Entertainment',
        icon: '🎬',
        clusters: [
          {
            label: 'Watch',
            itemLabels: ['TV serial', 'Web series', 'Movie', 'Short film', 'Trailer', 'Drama', 'Reality show'],
          },
          {
            label: 'Talk & Reaction',
            itemLabels: ['Talk show', 'Interview', 'Game show', 'Prank', 'Vlog', 'Comedy'],
          },
          {
            label: 'Kids',
            itemLabels: [
              'Cartoon',
              'Animation',
              'Rhyme',
              'Poem',
              'Kids song',
              'Bedtime story',
              'Fairy tale',
              'Moral story',
              'Educational',
              'Toy / toy play',
            ],
          },
        ],
        items: [
          { label: 'TV serial', icon: '📺' },
          { label: 'Web series', icon: '🎥' },
          { label: 'Movie', icon: '🎬' },
          { label: 'Short film', icon: '🎞️' },
          { label: 'Trailer', icon: '📽️' },
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
        clusters: [
          {
            label: 'Listen',
            itemLabels: ['Song', 'Music video', 'Lyrics / lyric video', 'Live music', 'Cover song', 'Remix', 'Karaoke'],
          },
          {
            label: 'Genres',
            itemLabels: ['Classical music', 'Devotional music', 'Folk music', 'Ghazal'],
          },
        ],
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
      // Technology, added science subjects. Grade levels (Nursery–Class 12)
      // moved out of the item grid into `sliderItems` — see
      // GRADE_SLIDER_ITEMS above.
      education: {
        label: 'Education',
        icon: '🎓',
        clusters: [
          {
            label: 'Study Skills',
            itemLabels: ['Exam preparation', 'Tutorial', 'How-to', 'Lecture', 'Course', 'Competitive exams'],
          },
          {
            label: 'Subjects',
            itemLabels: [
              'Science',
              'Mathematics',
              'Physics',
              'Chemistry',
              'Biology',
              'Zoology',
              'Botany',
              'Coding',
              'History',
              'Geography',
            ],
          },
        ],
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
        ],
        sliderItems: GRADE_SLIDER_ITEMS,
      },
      // Lifestyle absorbed Bhakti / Bhajan / Aarti / Yoga from the old
      // Devotion & Spirituality sub-category, which is now deleted.
      lifestyle: {
        label: 'Lifestyle',
        icon: '💆',
        clusters: [
          {
            label: 'Home & Wellness',
            itemLabels: ['Cooking', 'Recipe', 'Food', 'Fitness', 'Health & wellness', 'Home & DIY', 'Pets'],
          },
          {
            label: 'Style & Travel',
            itemLabels: ['Beauty', 'Fashion', 'Travel'],
          },
          {
            label: 'Family',
            itemLabels: ['Parenting'],
          },
          {
            label: 'Devotion',
            itemLabels: ['Bhakti', 'Bhajan', 'Aarti', 'Yoga'],
          },
        ],
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
        clusters: [
          {
            label: 'Romance & Family',
            itemLabels: ['Love', 'Romance', 'Marriage', 'Relationships', 'Family', 'Friendship'],
          },
          {
            label: 'Mindset',
            itemLabels: ['Motivation', 'Inspirational', 'Emotional / sad'],
          },
        ],
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
        clusters: [
          {
            label: 'Current Events',
            itemLabels: ['News', 'Current affairs', 'Politics', 'Crime'],
          },
          {
            label: 'Business & Finance',
            itemLabels: ['Business', 'Finance'],
          },
          {
            label: 'Entertainment & Sports News',
            itemLabels: ['Sports news', 'Entertainment news'],
          },
          {
            label: 'Long-form',
            itemLabels: ['Documentary'],
          },
        ],
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
        clusters: [
          {
            label: 'Team Sports',
            itemLabels: ['Cricket', 'Football', 'Kabaddi'],
          },
          {
            label: 'Individual Sports',
            itemLabels: ['Tennis', 'Badminton', 'Wrestling'],
          },
          {
            label: 'Coverage',
            itemLabels: ['Highlights', 'Live match', 'Analysis', 'Training'],
          },
        ],
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
        clusters: [
          {
            label: 'Devices',
            itemLabels: ['Smartphone', 'Gadget', 'Laptop / PC'],
          },
          {
            label: 'Software & AI',
            itemLabels: ['Apps', 'AI', 'Software', 'Gaming'],
          },
          {
            label: 'Buying Guide',
            itemLabels: ['Reviews', 'Unboxing'],
          },
        ],
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
      // Standalone slider group — NOT a filter-criteria dimension. An Era
      // selection never narrows Evergreen (or, once built, any other
      // group's) eligibility, and no other item carries an Era tag. See
      // isEvergreenEligible in searchFilters.ts.
      era: {
        label: 'Era',
        icon: '🕰️',
        items: [],
        sliderItems: ERA_SLIDER_ITEMS,
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
    return Object.values(dim.groups).reduce((n, g) => n + g.items.length + (g.sliderItems?.length ?? 0), 0)
  }
  return dim.items.length
}

/** The literal text appended to the search query for this item. */
export function filterItemValue(item: FilterItem): string {
  return item.value ?? item.label
}

/**
 * Dev-time safety net: every `items` label in a group with `clusters`
 * should appear in exactly one cluster, so nothing silently disappears
 * from the UI and nothing is double-counted. Not called in production
 * paths — intended for a test or a one-off console check.
 */
export function validateClusterCoverage(group: FilterGroup): { missing: string[]; duplicated: string[] } {
  const counts = new Map<string, number>()
  for (const cluster of group.clusters ?? []) {
    for (const label of cluster.itemLabels) {
      counts.set(label, (counts.get(label) ?? 0) + 1)
    }
  }
  const itemLabels = new Set(group.items.map((i) => i.label))
  const missing = group.items.map((i) => i.label).filter((label) => !counts.has(label))
  const duplicated = [...counts.entries()].filter(([label, n]) => n > 1 && itemLabels.has(label)).map(([label]) => label)
  return { missing, duplicated }
}
