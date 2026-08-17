Local playlist store — one JSON file per playlist, managed by the dev-only
Playlist Manager panel (🛠 icon in the header, only visible under `npm run dev`).

Each file is the local source-of-truth item list for a playlist you're
building/curating. It's independent of `src/lib/curatedPlaylists.ts`
(which only registers which playlists the *app* renders) — a file here
doesn't automatically show up in the app until you also add it there.

Nothing here syncs to YouTube. That's a deliberately deferred phase 2 —
see docs/DELTA_REQUIREMENTS.md.
