# Changelog

## v1.8.0
- **Search Last.fm from Vibo's search box.** Type in the search (Cmd+K) and
  pick "Search … on Last.fm" to see matching artists, albums and songs. An
  artist or album opens its page in Vibo, whether or not it's in your library;
  a song plays through your sources (yt-dlp, Spotify, your own files…), since
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
