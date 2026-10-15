# Vibo Last.fm Plugin

Scrobbling, Now Playing updates, history and loved-track import, and Last.fm
metadata for [Vibo](https://github.com/outcast1000/viboplr).

Plugin id: `lastfm`. Runs in Vibo's worker runtime.

## What it contributes

- **Scrobbler.** Scrobbles plays and sends Now Playing. It gets its row in
  Settings → Playback → Scrobbling like any scrobbler; that row is its on/off.
- **Love sync.** Liking a track in Vibo loves it on Last.fm; taking the like away
  (to neutral or to disliked) unloves it (`api.library.onLikeChanged`).
- **Imports.** Scrobble history into Vibo's History, loved tracks as likes; both
  optionally on a schedule.
- **Information types:** `artist_bio`, `artist_stats`, `artist_top_tracks`,
  `similar_artists`, `album_wiki`, `album_track_popularity`, `track_info`,
  `track_tags`, `similar_tracks`.
- **Search provider** `lastfm`: a "Search “x” on Last.fm" row in Vibo's search
  (Cmd+K). Picking it runs `artist.search`, `album.search` and `track.search`;
  artists and albums open Vibo's own pages by name, tracks play through the
  stream resolvers (Last.fm has no audio). Hosts without artist/album support
  show the tracks only.
- **Now Playing info item** `scrobbles` ("Listeners"), the **"Play the Full
  Album"** track action, a **Settings panel** (connect, import, schedules), and
  three read-only **assistant tools**: `account_status`, `recent_scrobbles`,
  `top_charts`.

## Built in, and released here

This plugin is **bundled with Vibo** and on by default, because so much of the
app leans on it (bios, similar artists, community tags in every tag editor,
the Listeners item). Its source lives here, not in the app repo.

- The app ships a **pinned copy of a release from this repo**, files unchanged:
  `src-tauri/plugins/lastfm/` holds the release's `manifest.json`, `index.js` and
  `signature.sig`, recorded in `scripts/bundled-plugins.lock.json` (version +
  sha256 of each file) and refreshed by `node scripts/sync-bundled-plugins.mjs lastfm`
  in the app repo. **Never edit that copy** — change it here and release. The
  app's `src/__tests__/bundledPlugins.test.ts` fails on any byte that differs
  from the release, or a signature that doesn't verify.
- The manifest carries `updateUrl`, so the bundled copy is checked for updates.
  Installing one puts the new version in the user's plugins folder, which takes
  precedence over the bundled copy by id. Sign-in and settings are keyed by the
  id, so they carry over.
- Each Vibo release should pick up the latest release from here (re-run the sync
  script), so a fresh install starts current.

## Credentials

The Last.fm API key and secret are **not in this repo**. Vibo bakes them in at
build time and hands them over through `api.env.get("LASTFM_API_KEY")` /
`api.env.get("LASTFM_API_SECRET")` (permissions `env:LASTFM_API_KEY` /
`env:LASTFM_API_SECRET`). For local development, run Vibo with both set in the
environment.

## Develop & Release

For every release: edit `index.js` / `manifest.json`, bump `version`, and add a
`## vX.Y.Z` section to `CHANGELOG.md` — `scripts/bump.sh <patch|minor|major|X.Y.Z>`
does the last two. Then commit and push a tag:

```bash
git tag vX.Y.Z && git push origin main vX.Y.Z
```

The Release workflow runs the tests, checks the manifest version matches the tag,
signs the files with the Vibo plugin-signing key (`TAURI_SIGNING_PRIVATE_KEY`
secret; a release without it fails), and publishes `lastfm.zip` + `update.json`.
Don't run `gh release create` by hand — CI is the only publisher.

The update endpoint is
`https://github.com/outcast1000/viboplr-lastfm/releases/latest/download/update.json`.

## Tests

```bash
node --test     # or: npm test
```

Zero-dependency: loads the real `index.js` in a sandbox and drives `activate()`
through a mocked `api` (no network). CI runs it, and a release won't publish
unless it passes. The app repo also runs its own check of the bundled copy
(`src/__tests__/lastfmLoveSync.test.ts`), so a host change to the like or
scrobble contract still fails app CI.
