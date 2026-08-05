# Documentation Sync Summary

Last updated: 2026-08-05

## Scope

All top-level project docs were synchronized with current code behavior and recent feature rollbacks.

Files updated:
- README.md
- ARCHITECTURE.md
- CONTRIBUTING.md
- VERCEL_SETUP.md
- STRATEGY_TOGGLE.md
- docs/sortresults.txt
- DOCS_UPDATE_SUMMARY.md (this file)

## Current Runtime Status

- Discovery search default is 25 results.
- Server clamps discovery max results to 1..25.
- Search result click opens viewer centered in the current viewport.
- Pop opens a separate centered window on desktop and uses new-tab fallback on mobile.
- Floating viewer supports drag, resize handle, size presets, captions, speed, fullscreen.
- Popout receives playback start from `playStart` (not sampled live current time).
- Runtime transcript strategy selector is not currently shown in UI.

## Explicit Rollback State Captured

The codebase is intentionally in a centered-popup state. The following later experiments are not active:
- Document Picture-in-Picture first-open path
- In-video top-middle PiP overlay control
- Live playback-time propagation to popout start

## Why this sync was needed

Several docs still reflected earlier design iterations (tabs-only viewer flow, 12-result defaults, active runtime strategy toggle, PiP-first controls). These were corrected to reduce onboarding and implementation confusion.

## Next recommended docs pass

- Remove or rewrite historical pseudocode blocks in docs/sortresults.txt into a concise spec + acceptance criteria.
- Trim ARCHITECTURE.md code snippets that no longer map one-to-one with current App state keys.
- Add a small CHANGELOG.md for feature toggles/rollbacks to avoid mixing status notes into architecture narratives.
