# Changelog

## v1.11.2
- The AI tools (account_status, recent_scrobbles, top_charts) are now filed under "info" rather than "library": they read your Last.fm account, not your music library, so an in-app assistant asked about the library no longer gets them.

## v1.11.1
- Each AI tool now says what it is about (its category), so Viboplr's in-app assistant can offer it alongside the app's own tools of the same kind instead of sending every tool at once. Viboplr versions that don't know the field ignore it.
- The AI notes now name the app's get_entity_info tool instead of an HTTP route an in-app assistant can't call.

## v1.11.0
- **"From Last.fm" on Home always has at least six mixes.** Popular genres fill
  in when your history doesn't give enough, so a new install or a quiet week
  no longer leaves you with two cards.
- **Mixes fill when you play them.** Song and artist mixes start at once with a
  song from your own history, and the rest follows while it plays. Genre and
  Trending mixes keep their last list, so they start at once too after the
  first day. Building the shelf barely touches Last.fm, so a slow network no
  longer makes the whole shelf disappear.
- More personal mixes: up to three "Similar to" and three "& similar" cards.
- A genre too small for a mix is skipped and the next one is used.
- Mixes and radio are now 30 songs long (was 50).

## v1.10.0
- **Auto-continue keeps going without a library.** With auto-continue on (∞ in
  the queue header), when your library has nothing to play next — no library
  at all, or nothing of the format "Same format" asks for — Last.fm suggests a
  song similar to the one playing, skipping what you just heard and songs you
  disliked. Now and then it steers back toward the song you started with, so a
  long session doesn't wander off.
- With a library, you can also mix Last.fm suggestions in: Settings → Playback
  → Auto-continue → **Similar · Last.fm** (0% by default).
- Needs a Vibo version with plugin auto-continue, and a source that can play
  songs you don't own (yt-dlp, Soulseek, TIDAL…). On older versions nothing
  changes.
- Radio and mixes: a song with only a few similar songs keeps them, topped up
  with its artist's; songs you disliked no longer crowd their artist out of a
  mix; a signed-in user who never tagged anything still gets genre mixes; the
  Home shelf loads faster; and radio no longer saves a copy of every artist it
  looked up.

## v1.9.0
- **Last.fm radio.** Right-click a song or an artist → Last.fm → **Start
  radio**: the song (or the artist's best-known one) plays at once and the
  queue fills with similar music — similar songs, or the artist woven through
  similar artists — whether or not any of it is in your library. Songs you
  disliked are left out, no artist takes over, and each press shuffles a little.
- **"From Last.fm" on Home.** A shelf of mixes built from what you've been
  playing: "Similar to …" a recent song, "… & similar" for an artist you play a
  lot, and mixes for that artist's genres (your own top tags when you're
  signed in). Just installed Vibo? If you're signed in to Last.fm, the mixes
  come from your Last.fm listening until Vibo has history of its own;
  otherwise you get "Trending on Last.fm" and a couple of popular genres.
  Hide or move it from Home → Customize.
- Both need something that can play songs you don't own, such as yt-dlp,
  Soulseek or TIDAL — Last.fm itself has no audio. Without one, the shelf stays
  hidden and Start radio says what's missing. New permission, used only for
  that check: "Use your other plugins".

## v1.8.0
- **Search Last.fm from Vibo's search box.** Type in the search (Cmd+K) and
  pick "Search … on Last.fm" to see matching artists, albums and songs. An
  artist or album opens its page in Vibo, whether or not it's in your library;
  a song plays through your sources (yt-dlp, Soulseek, your own files…), since
  Last.fm has no audio. Nothing is sent to Last.fm until you pick that row.
- Artists and albums need a Vibo version that shows them; older versions list
  the songs only. You can hide the row in Extensions → Last.fm → Contributions.

## v1.7.1
- Requests to Last.fm now identify themselves as `Vibo` instead of using the
  app's browser-style default. Some company networks (Zscaler) block that
  default from a non-browser client, which left bios, popularity, similar
  artists and scrobbling failing with HTTP 403.

## v1.7.0
- **Now lives in its own repository** (`outcast1000/viboplr-lastfm`) and declares
  an `updateUrl`, so fixes reach you through Extensions → updates without waiting
  for a Vibo release. Vibo still ships this plugin built in, so nothing changes
  for you: same id, same sign-in, same settings.
- Releases are signed with the Vibo plugin-signing key, so an update raises no
  permission prompt.
- Requires Vibo 1.0.104. No functional changes from the 1.6.0 copy bundled with
  that release.
