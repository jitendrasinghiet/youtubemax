# Contributing to YouTubeMax

Thank you for your interest in contributing! This document provides guidelines for reporting issues, submitting pull requests, and participating in the community.

---

## Code of Conduct

- **Be respectful** — Treat all contributors with courtesy
- **Be constructive** — Offer solutions, not just criticism
- **Be inclusive** — Welcome diverse perspectives and backgrounds
- **Be professional** — Keep discussions focused on the project

---

## Getting Started

### Fork & Clone

```bash
# 1. Fork the repo on GitHub
# 2. Clone your fork
git clone https://github.com/your-username/youtubemax.git
cd youtubemax

# 3. Add upstream remote
git remote add upstream https://github.com/original-owner/youtubemax.git

# 4. Create feature branch
git checkout -b feature/my-feature
```

### Local Setup

```bash
npm install
npm run dev
```

---

## Reporting Issues

### Before Reporting

1. **Check existing issues** — Search for similar reports
2. **Try latest code** — Issue may already be fixed
3. **Read documentation** — Feature may be documented
4. **Test in isolation** — Verify it's a project issue, not user error

### Issue Template

```markdown
## Title
[Concise description]

## Environment
- **Browser:** Chrome 120
- **OS:** macOS 14.1
- **Node:** v20.10.0
- **Repo version:** v1.2.3

## Steps to Reproduce
1. Go to http://localhost:5173
2. Paste YouTube link "https://youtube.com/watch?v=..."
3. Wait for analysis
4. Click keyword "react"

## Expected Behavior
Chapters should filter to show only those containing "react", and the word should be highlighted in yellow.

## Actual Behavior
No chapters are filtered; highlighting doesn't appear.

## Screenshots
[If applicable]

## Error Message
```
Failed to filter chapters: TypeError: undefined is not an object
```

## Additional Context
Happens consistently with any video. Tested on Chrome and Firefox.
```

### Issue Types

- **Bug** — Unexpected behavior or error
- **Feature** — New capability or enhancement
- **Documentation** — Missing or unclear docs
- **Question** — How-to or clarification

---

## Submitting Pull Requests

### Before You Start

1. **Check for existing PRs** — Don't duplicate work
2. **Open an issue first** — For non-trivial changes (optional but recommended)
3. **Discuss approach** — Major changes benefit from discussion before coding

### Branch Naming

```
feature/keyword-export          # New feature
fix/chapter-filter-bug          # Bug fix
docs/update-api-docs            # Documentation
refactor/reduce-bundle-size     # Code improvement
```

### Commit Messages

Follow conventional commits:

```
feat: add keyword export to CSV
  
  - Extract keywords from master list
  - Generate CSV with term, score, source columns
  - Download via <a> element

Fixes #123

fix: prevent chapters from jumping on filter toggle
  
  - Add scroll position tracking
  - Restore position after filter change
  - Add transition to smooth movement

docs: add keyword pruning explanation to ARCHITECTURE.md
```

**Format:**
```
<type>: <subject>

<body>

<footer>
```

**Types:**
- `feat` — New feature
- `fix` — Bug fix
- `docs` — Documentation
- `refactor` — Code quality (no behavior change)
- `test` — Add/update tests
- `chore` — Dependencies, tooling

### Code Style

```typescript
// 1. Use TypeScript strict mode
type VideoMeta = {
  videoId: string    // ✅ explicit type
  title: string
  author: string
}

// 2. Use React hooks (no class components)
export function MyComponent({ data }) {
  const [state, setState] = useState(null)
  
  useEffect(() => {
    // Effect logic
  }, [data])  // ✅ dependency array
  
  return <div>...</div>
}

// 3. Use Tailwind CSS (no inline styles)
<div className="flex items-center gap-3 rounded-lg bg-white/5 p-4">
  {/* ✅ Tailwind classes only */}
</div>

// 4. Destructure props
type ButtonProps = {
  onClick: () => void
  label: string
  disabled?: boolean
}

export function Button({ onClick, label, disabled }: ButtonProps) {
  return <button onClick={onClick} disabled={disabled}>{label}</button>
}

// 5. Add comments for complex logic
const isSuperstring = keywords.some(
  (other) =>
    // Check if 'other' is a higher-scoring variant of 'term'
    other.score > kw.score &&
    other.term.toLowerCase() !== term &&
    other.term.toLowerCase().includes(term) &&
    other.term.toLowerCase().length > term.length
)
```

### File Organization

```
src/components/          # React components (one per file)
  MyComponent.tsx

src/hooks/              # Custom React hooks
  useMyHook.ts

src/lib/                # Utilities & helpers
  api.ts                # API calls
  searchSort.ts         # Sorting/parsing helpers

# Tests are co-located next to the code they cover, named *.test.ts
src/lib/searchSort.test.ts
src/lib/api.test.ts
server/youtube.test.ts
```

### Testing

Tests use **Vitest**. Co-locate a `*.test.ts` file next to the module under test
(`vitest.config.ts` matches `src/**/*.test.ts` and `server/**/*.test.ts`). Focus on
pure functions \u2014 parsers, scoring, formatting \u2014 which are fast and reliable to test.

```typescript
// src/lib/searchSort.test.ts
import { describe, it, expect } from 'vitest'
import { parseViewCountToNumber } from './searchSort'

describe('parseViewCountToNumber', () => {
  it('parses K/M/B suffixes', () => {
    expect(parseViewCountToNumber('3.5M')).toBe(3_500_000)
  })
})
```

**Run tests:**
```bash
npm test                   # Run once
npm run test:watch         # Watch mode
```

### Before Submitting

```bash
# 1. Type check
npm run build

# 2. Lint
npm run lint

# 3. Test
npm test

# 4. Manual testing
npm run dev
# Test your changes in browser

# 5. Build production
npm run build && npm run preview

# 6. Verify git status
git status
```

### PR Template

```markdown
## What
Brief description of changes

## Why
Problem this solves or feature requested (link issue if applicable)

## How
Technical approach / implementation details

## Testing
How to test these changes
- [ ] Unit tests added/updated
- [ ] Manual testing completed
- [ ] No regressions detected

## Checklist
- [ ] Code follows style guide
- [ ] TypeScript compiles with no errors
- [ ] Tests pass (`npm test`)
- [ ] Documentation updated (if needed)
- [ ] No console errors or warnings
- [ ] Works on latest `main` branch

## Linked Issues
Fixes #123
Related to #456
```

### Review Process

1. **Automated checks** — TypeScript, linting, tests must pass
2. **Code review** — Maintainer reviews code quality
3. **Functionality review** — Manual testing of changes
4. **Discussion** — Address feedback and iterate
5. **Approval & merge** — Once approved, PR is merged

---

## Documentation Updates

### Update README for:
- New major features
- Breaking changes
- API additions/changes
- Setup/deployment changes

### Update ARCHITECTURE for:
- New flow diagrams
- Algorithm changes
- State management updates
- Performance optimizations

### Add JSDoc comments:
```typescript
/**
 * Extract keywords from video analysis result with weighted scoring
 * 
 * @param videoMeta - Video metadata (title, description)
 * @param chapters - Chapter titles and descriptions
 * @param transcript - Full video transcript
 * @returns Array of keywords sorted by relevance score
 * 
 * @example
 * const keywords = extractKeywords(meta, chapters, transcript)
 * keywords[0]  // { term: 'react', score: 8.5, source: 'title' }
 */
export function extractKeywords(videoMeta, chapters, transcript) {
  // Implementation
}
```

---

## Release Process

**Maintainers only:**

```bash
# 1. Update version in package.json
# 2. Update CHANGELOG.md
# 3. Create release PR
# 4. Merge after approval
# 5. Create GitHub release with tag
# 6. Deploy to Vercel (auto via Vercel integration)

npm version patch    # 1.0.0 → 1.0.1
npm version minor    # 1.0.0 → 1.1.0
npm version major    # 1.0.0 → 2.0.0
```

---

## Getting Help

- **Documentation:** Read [README.md](README.md) and [ARCHITECTURE.md](ARCHITECTURE.md)
- **Discussions:** Start a [GitHub Discussion](https://github.com/your-repo/discussions)
- **Issues:** Search [existing issues](https://github.com/your-repo/issues)
- **Discord/Chat:** [Link if applicable]

---

## Types of Contributions

### 🐛 Bug Fixes
**Difficulty:** Easy to Hard  
**Examples:**
- Fix chapter filtering not working
- Fix keyword highlighting in titles
- Fix responsive layout on mobile

### ✨ Features
**Difficulty:** Medium to Hard  
**Examples:**
- Add keyword export (CSV, JSON)
- Add clip download (MP4)
- Add keyboard shortcuts
- Add dark mode toggle

### 📚 Documentation
**Difficulty:** Easy  
**Examples:**
- Add JSDoc comments
- Improve README sections
- Add code examples
- Translate docs

### ♻️ Refactoring
**Difficulty:** Medium to Hard  
**Examples:**
- Extract reusable components
- Optimize performance
- Improve type safety
- Reduce bundle size

### 🧪 Tests
**Difficulty:** Easy to Medium  
**Examples:**
- Add unit tests for utilities
- Add component tests
- Add integration tests
- Improve coverage

### 🎯 Community
**Difficulty:** Easy  
**Examples:**
- Answer questions in Discussions
- Help reproduce issues
- Provide feedback on PRs
- Share your use cases

---

## Maintainer Notes

### Becoming a Maintainer

- **Consistent contributions** (3+ PRs merged)
- **Good communication** (responsive, helpful)
- **Deep project knowledge**
- **Willing to do code reviews**

Reach out to existing maintainers if interested.

### Maintainer Responsibilities

- Review and merge PRs
- Respond to issues
- Maintain documentation
- Manage releases
- Set project direction

---

## Special Thanks

Thanks for contributing to YouTubeMax! Your contributions make this project better for everyone. 🎉
