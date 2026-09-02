# YouTubeMax — Status

Running log of real, verified work on this project — what changed, why,
and how it was checked. New entries go at the top. See
`docs/DELTA_REQUIREMENTS.md` for the filter/taxonomy-specific delta
tracker (a separate, narrower living document); this file is the general
one, in the same spirit as the sibling `dekho` project's own
`docs/STATUS.md`.

## Viewer redesign: docked top panel (initial view) → drag-to-detach floating window, position persists across plays

Asked directly to make the in-page video viewer's UX closer to real
YouTube's own mobile pattern: the *first* time a video plays it should
be a full-width panel docked to the top of the page (search results
scrollable beneath it, not hidden behind a floating overlay), and
dragging it down should detach it into the existing small draggable
window — which should then **stay** wherever the user left it (mode and
position both) across every subsequent video picked from the results
grid, not reset every time, until the user explicitly drags/swipes it
back up to the top edge (or clicks a new explicit dock button).

**Root cause of the reported "opens at a fixed position every time" complaint**:
`handleSelectSearchResult` recomputed a bottom-right `viewerPosition`
unconditionally on every single video selection, discarding whatever
position the user had actually dragged the window to. Removed entirely —
selecting a new video now leaves `viewerMode`/`viewerPosition` exactly as
they were.

**New `viewerMode: 'top' | 'floating'` state**, defaulting to `'top'` —
with nothing in `sessionStorage` yet (a session's first video), that
default alone delivers "top panel wide when user plays for first time"
with no extra bookkeeping. Only changes via:
- Dragging the viewer's own header down past a threshold (`TOP_TO_FLOAT_DRAG_THRESHOLD`,
  56px) — detaches from directly under the pointer's *current* position
  (not the drag's start), so the window doesn't visually jump the instant
  it crosses the threshold.
- Dragging a floating window's header back up until release happens
  within `FLOAT_TO_TOP_DROP_ZONE` (64px) of the top edge — redocks it.
- A new explicit "⤒ Dock to top" button (visible only while floating) —
  the click-instead-of-gesture equivalent, for anyone who wouldn't
  discover the drag-up affordance on their own.
- Clicking any of the existing S/M/L size presets while docked — a
  specific pixel size is a floating-window concept, so picking one while
  docked undocks it there instead of doing nothing useful.

Both the docked top panel (`position: fixed; inset-x-0; top-0`, height
`min(58vh, 620px)`) and the existing floating window share the exact
same header/drag-handle/`<VideoPlayer>` JSX — only the outer container's
class/style branch on `viewerMode`, so none of the existing
resize/PiP/captions/playback-rate/fullscreen logic needed touching. The
main content column gets `paddingTop: TOP_PANEL_HEIGHT` while docked, so
the header and results grid are actually pushed down out from under the
fixed top panel rather than hidden behind it — this is what makes "list
below to scroll" literally true instead of the grid just happening to be
visible around the edges of an overlay.

`sessionStorage`'s existing `VIEWER_PREFS_KEY` blob (already used for
size preset / captions / playback rate) now also carries `mode` and
(only while floating) `position`, so a reload mid-session restores
whichever state the user was last in, not just the size preset.

**Verified live**, `npm run dev` + a scripted Chromium pass: opening the
first video confirmed a full-width (1280px in a 1280px viewport),
top-pinned (`y≈0`) panel with the results grid visible beneath it;
dragging the header down 300px+ detached it into the floating window at
the drop position; selecting a *second, different* video from the grid
while floating left the window at the exact same `{x, y}` coordinates
(the specific bug being fixed); clicking "Dock to top" returned it to
the full-width top panel. `npx tsc -b` and `npm run build` both clean.

## Google Cast — investigated, not built as a custom integration

Asked (from the sibling `dekho` project, which embeds this same kind of
YouTube iframe) for a "cast to another device" option matching real
YouTube's own cast button, and whether the same could extend here.

**What's actually available, and why nothing new was built**: a YouTube
iframe embed (`<VideoPlayer>` here, DEKHO's own embed the same way)
already shows YouTube's own native Cast icon in its player chrome when
the browser/network environment supports it — this is Google's own,
already-built solution, not something a parent page enables or needs to
add code for. What a *third-party* site cannot legitimately do is
independently trigger a cast session to the dedicated "YouTube" receiver
app on a Chromecast/Google TV device from its own code — that pairing is
Google's own private integration between youtube.com and its Cast
receiver, not a documented, supported capability of the public Cast Web
Sender SDK for arbitrary senders. The SDK's actual supported path (the
default media receiver, or a custom receiver you host) requires a direct
media URL to cast, which doesn't exist here — extracting one from a
YouTube video id would mean scraping/downloading YouTube's actual media
streams, directly against this project's own "no unofficial scraping of
YouTube's non-public surfaces" stance.

Reasonable fallback that already works today, zero code changes: Chrome's
own browser-level "Cast…" (right-click, or the toolbar/menu Cast icon)
casts the whole tab, video included — less elegant than YouTube's own
native per-video cast (mirrors the tab rather than streaming just the
video efficiently), but genuinely available on any page, this one
included, with nothing to build or maintain.

Not revisited unless a real, documented, supported path for third-party
YouTube-video casting surfaces later.
