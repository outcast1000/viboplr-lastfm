# Changelog

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
