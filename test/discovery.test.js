const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadPlugin } = require("./harness/sandbox.js");
const { makeMockApi, settle } = require("./harness/mock-api.js");

const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "manifest.json"), "utf8"));

function respond(body) {
  return Promise.resolve({ status: 200, headers: {}, json: () => Promise.resolve(body), text: () => Promise.resolve(JSON.stringify(body)) });
}

const tracks = (artist, n, prefix = "Song") =>
  Array.from({ length: n }, (_, i) => ({ name: `${prefix} ${i + 1}`, artist: { name: artist }, duration: "200" }));

// Last.fm answers keyed by method; a function gets the request's params.
function lastfm(routes) {
  return function (url) {
    const params = new URL(url).searchParams;
    const route = routes[params.get("method")];
    const body = typeof route === "function" ? route(params) : route;
    if (body instanceof Error) return Promise.reject(body);
    return respond(body || {});
  };
}

async function activated(opts) {
  const api = makeMockApi(opts);
  loadPlugin().activate(api);
  await settle();
  return api;
}

const methodsCalled = (api) => api.fetchCalls.map((c) => new URL(c.url).searchParams.get("method"));

test("the manifest's radio item and Home shelf get handlers", async () => {
  const api = await activated();
  assert.equal(typeof api.handlers.menuActions["lastfm-radio"], "function");
  for (const shelf of manifest.contributes.homeShelves) {
    assert.equal(typeof api.handlers.shelves[shelf.id], "function", shelf.id);
  }
  assert.ok(manifest.permissions.includes("plugins:call"));
  for (const p of manifest.permissions) assert.ok(manifest.permissionReasons[p], `reason for ${p}`);
});

test("song radio plays the seed first, then similar songs without the seed or dislikes", async () => {
  const similar = tracks("Other", 3).concat(tracks("Third", 3, "Tune"), [{ name: "Jóga", artist: { name: "Björk" } }]);
  // Pad to the 10 a song radio needs before falling back to the artist.
  similar.push(...tracks("Fourth", 3, "Air"), ...tracks("Fifth", 3, "Wave"));
  const api = await activated({
    fetch: lastfm({ "track.getSimilar": { similartracks: { track: similar } } }),
    disliked: ["Song 2|Other"],
  });
  api.handlers.menuActions["lastfm-radio"]({ kind: "track", title: "Jóga", artistName: "Björk", albumTitle: "Homogenic" });
  await settle();
  assert.equal(api.backfills.length, 1);
  const run = api.backfills[0];
  assert.deepEqual(run.head, [{ title: "Jóga", artist_name: "Björk", album_title: "Homogenic" }]);
  assert.deepEqual(run.context, { name: "Radio: Jóga", source: "radio" });
  const tail = await run.tail;
  assert.equal(tail[0].title, "Jóga", "the list opens with the head it shipped");
  const rest = tail.slice(1).map((t) => `${t.title}|${t.artist_name}`);
  assert.ok(!rest.includes("Jóga|Björk"), "seed not repeated");
  assert.ok(!rest.includes("Song 2|Other"), "disliked dropped");
  assert.equal(rest.length, 11); // 13 similar − the seed − one dislike
});

test("a song with no similar list falls back to its artist's mix", async () => {
  const api = await activated({
    fetch: lastfm({
      "track.getSimilar": { similartracks: { track: [] } },
      "artist.getTopTracks": (p) => ({ toptracks: { track: tracks(p.get("artist"), 6) } }),
      "artist.getSimilar": { similarartists: { artist: [{ name: "Múm" }, { name: "Sigur Rós" }] } },
    }),
  });
  api.handlers.menuActions["lastfm-radio"]({ kind: "track", title: "Rare B-side", artistName: "Björk" });
  await settle();
  const tail = await api.backfills[0].tail;
  const artists = new Set(tail.map((t) => t.artist_name));
  assert.deepEqual([...artists].sort(), ["Björk", "Múm", "Sigur Rós"]);
  // Neighbours are capped; the radio's own artist isn't (it carries ~a third).
  assert.ok(tail.filter((t) => t.artist_name === "Björk").length > 3);
  for (const a of ["Múm", "Sigur Rós"]) assert.ok(tail.filter((t) => t.artist_name === a).length <= 3);
});

test("artist radio opens with the artist's top song", async () => {
  const api = await activated({
    fetch: lastfm({
      "artist.getTopTracks": (p) => ({ toptracks: { track: tracks(p.get("artist"), 5) } }),
      "artist.getSimilar": { similarartists: { artist: { name: "Portishead" } } },
    }),
  });
  api.handlers.menuActions["lastfm-radio"]({ kind: "artist", artistName: "Massive Attack" });
  await settle();
  const run = api.backfills[0];
  assert.deepEqual(run.head.map((t) => t.title), ["Song 1"]);
  assert.equal(run.context.name, "Radio: Massive Attack");
  const tail = await run.tail;
  assert.equal(tail[0].title, "Song 1");
  assert.equal(tail.filter((t) => t.title === "Song 1" && t.artist_name === "Massive Attack").length, 1);
  assert.ok(tail.some((t) => t.artist_name === "Portishead"));
});

test("radio says why, and plays nothing, when no source can play unowned songs", async () => {
  const api = await activated({ plugins: [{ id: "spotify-browse", enabled: true, status: "active", capabilities: {} }] });
  api.handlers.menuActions["lastfm-radio"]({ kind: "track", title: "Jóga", artistName: "Björk" });
  await settle();
  assert.equal(api.backfills.length, 0);
  assert.equal(api.notifications.length, 1);
  assert.match(api.notifications[0].message, /yt-dlp/);
  assert.equal(methodsCalled(api).filter((m) => m && m !== "auth.getSession").length, 0, "Last.fm not asked");
});

test("the Home shelf is empty when no source can play unowned songs", async () => {
  const api = await activated({ plugins: [{ id: "ytdlp", enabled: false, status: "active", capabilities: { streamResolvers: 1 } }] });
  assert.deepEqual(await api.handlers.shelves["lastfm-mixes"](10), { status: "empty" });
});

test("the Home shelf builds on-demand mixes from history, topped up to six", async () => {
  const api = await activated({
    history: [
      { display_title: "Teardrop", display_artist: "Massive Attack" },
      { display_title: "Angel", display_artist: "Massive Attack" },
      { display_title: "Roads", display_artist: "Portishead" },
    ],
    topArtists: [{ display_name: "Portishead" }, { display_name: "Björk" }],
    fetch: lastfm({
      "track.getSimilar": (p) => ({ similartracks: { track: tracks("Like " + p.get("track"), 3).concat(tracks("More " + p.get("track"), 3), tracks("Also " + p.get("track"), 3)) } }),
      "artist.getTopTracks": (p) => ({ toptracks: { track: tracks(p.get("artist"), 5) } }),
      "artist.getTopTags": { toptags: { tag: [{ name: "seen live" }, { name: "trip-hop" }, { name: "electronic" }] } },
      "tag.getTopTracks": (p) => ({ tracks: { track: Array.from({ length: 12 }, (_, i) => ({ name: `T${i}`, artist: { name: `${p.get("tag")} artist ${i}` } })) } }),
    }),
  });
  const result = await api.handlers.shelves["lastfm-mixes"](10);
  assert.equal(result.status, "ok");
  const names = result.items.map((i) => i.name);
  // One similar mix per distinct recent artist; Portishead is already a track
  // seed, so the artist mix is Björk's; "seen live" is not a genre; Trending
  // makes six.
  assert.deepEqual(names, ["Similar to Teardrop", "Similar to Roads", "Björk & similar", "Trip-hop mix", "Electronic mix", "Trending on Last.fm"]);
  // Song cards open with the seed itself and nothing else.
  assert.equal(result.items[0].partial, true);
  assert.deepEqual(result.items[0].tracks, [{ title: "Teardrop", artist_name: "Massive Attack", album_title: undefined }]);
  assert.ok(!methodsCalled(api).includes("track.getSimilar"), "similar songs are looked up on play, not here");
  // Björk has no song in the history, so her card opens with her top song.
  const artistMix = result.items[2];
  assert.equal(artistMix.partial, true);
  assert.deepEqual(artistMix.tracks.map((t) => t.title), ["Song 1"]);
  // Genre cards have no kept list yet: no tracks, resolved on play.
  assert.deepEqual(result.items[3].tracks, []);
  for (const item of result.items) assert.doesNotMatch(item.id, /\u0000/);

  // The genre lists are rebuilt after the fetch and shipped by the next one.
  await settle();
  const again = await api.handlers.shelves["lastfm-mixes"](10);
  const tripHop = again.items.find((i) => i.name === "Trip-hop mix");
  assert.equal(tripHop.tracks.length, 12);
  assert.match(tripHop.subtitle, /trip-hop artist/);
});

test("a song card resolves to its similar songs, opening with the seed it shipped", async () => {
  const api = await activated({
    fetch: lastfm({
      "track.getSimilar": { similartracks: { track: tracks("Like", 3).concat(tracks("More", 3), tracks("Also", 3), [{ name: "Teardrop", artist: { name: "Massive Attack" } }]) } },
    }),
  });
  const head = { title: "Teardrop", artist_name: "Massive Attack" };
  const list = await api.handlers.resolvePlay["lastfm-mixes"]({ id: "similar:Massive%20Attack|Teardrop", tracks: [head], partial: true });
  assert.deepEqual(list[0], head);
  assert.equal(list.filter((t) => t.title === "Teardrop").length, 1, "the seed isn't repeated");
  assert.equal(list.length, 10);
});

test("an artist card resolves to its full mix, opening with the head it shipped", async () => {
  const api = await activated({
    fetch: lastfm({
      "artist.getTopTracks": (p) => ({ toptracks: { track: tracks(p.get("artist"), 5) } }),
      "artist.getSimilar": { similarartists: { artist: [{ name: "Múm" }] } },
    }),
  });
  const head = { title: "Song 1", artist_name: "Björk" };
  const list = await api.handlers.resolvePlay["lastfm-mixes"]({ id: "artist:Björk", name: "Björk & similar", tracks: [head], partial: true });
  assert.deepEqual(list[0], head);
  assert.equal(list.filter((t) => t.title === "Song 1" && t.artist_name === "Björk").length, 1);
  assert.ok(list.some((t) => t.artist_name === "Múm"));
});

const notFound = (what) => ({ error: 6, message: `${what} not found` });
const tagTracks = (p) => ({ tracks: { track: Array.from({ length: 12 }, (_, i) => ({ name: `T${i}`, artist: { name: `${p.get("tag")} artist ${i}` } })) } });
const chart = { tracks: { track: Array.from({ length: 20 }, (_, i) => ({ name: `Hit ${i}`, artist: { name: `Star ${i}` } })) } };

test("a brand-new profile gets Trending and genres, six cards in all", async () => {
  const api = await activated({
    fetch: lastfm({
      "chart.getTopTracks": chart,
      "chart.getTopTags": { tags: { tag: [{ name: "rock" }, { name: "seen live" }, { name: "jazz" }] } },
      "tag.getTopTracks": tagTracks,
    }),
  });
  const result = await api.handlers.shelves["lastfm-mixes"](10);
  assert.equal(result.status, "ok");
  const names = result.items.map((i) => i.name);
  assert.equal(names[0], "Trending on Last.fm");
  assert.equal(names.length, 6);
  assert.ok(names.includes("Rock mix") && names.includes("Jazz mix"));
  // First fetch: Trending resolves on play. Next fetch ships its list.
  assert.deepEqual(result.items[0].tracks, []);
  await settle();
  const again = await api.handlers.shelves["lastfm-mixes"](10);
  assert.equal(again.items[0].tracks.length, 20);
});

test("signed in with no local history, mixes come from the Last.fm account", async () => {
  const api = await activated({
    session: { sessionKey: "sk", username: "alice" },
    fetch: lastfm({
      "user.getRecentTracks": { recenttracks: { track: [{ name: "Hyperballad", artist: { "#text": "Björk" } }] } },
      "user.getTopArtists": { topartists: { artist: [{ name: "Björk" }, { name: "Portishead" }] } },
      "user.getTopTags": { toptags: { tag: [{ name: "trip-hop" }] } },
      "track.getSimilar": { similartracks: { track: tracks("A", 3).concat(tracks("B", 3), tracks("C", 3)) } },
      "artist.getTopTracks": (p) => ({ toptracks: { track: tracks(p.get("artist"), 5) } }),
      "tag.getTopTracks": tagTracks,
    }),
  });
  const result = await api.handlers.shelves["lastfm-mixes"](10);
  const names = result.items.map((i) => i.name);
  assert.deepEqual(names.slice(0, 4), ["Similar to Hyperballad", "Portishead & similar", "Trip-hop mix", "Trending on Last.fm"]);
  assert.equal(names.length, 6, "popular genres fill the rest");
});

test("a song Last.fm doesn't know still gets a radio, from its artist", async () => {
  const api = await activated({
    fetch: lastfm({
      "track.getSimilar": notFound("Track"),
      "artist.getTopTracks": (p) => ({ toptracks: { track: tracks(p.get("artist"), 6) } }),
      "artist.getSimilar": { similarartists: { artist: [{ name: "Múm" }] } },
    }),
  });
  api.handlers.menuActions["lastfm-radio"]({ kind: "track", title: "Demo", artistName: "Björk" });
  await settle();
  const tail = await api.backfills[0].tail;
  assert.equal(tail[0].title, "Demo");
  assert.ok(tail.length > 1);
});

test("when nothing similar turns up, the tail is empty so the host says so", async () => {
  const api = await activated({
    fetch: lastfm({ "track.getSimilar": notFound("Track"), "artist.getTopTracks": notFound("Artist"), "artist.getSimilar": notFound("Artist") }),
  });
  api.handlers.menuActions["lastfm-radio"]({ kind: "track", title: "Demo", artistName: "Nobody" });
  await settle();
  assert.deepEqual(await api.backfills[0].tail, []);
  assert.match(api.backfills[0].tailErrorMessage, /found nothing similar to Demo/);
});

test("artist radio for an artist Last.fm doesn't know says so, not 'couldn't reach'", async () => {
  const api = await activated({ fetch: lastfm({ "artist.getTopTracks": notFound("Artist") }) });
  api.handlers.menuActions["lastfm-radio"]({ kind: "artist", artistName: "Nobody" });
  await settle();
  assert.equal(api.backfills.length, 0);
  assert.match(api.notifications[0].message, /doesn't know Nobody/);
});

test("mix lookups are kept in memory, never written to plugin storage", async () => {
  const api = await activated({
    fetch: lastfm({ "track.getSimilar": { similartracks: { track: tracks("A", 12) } } }),
  });
  api.storageWrites.length = 0;
  api.handlers.menuActions["lastfm-radio"]({ kind: "track", title: "Jóga", artistName: "Björk" });
  await settle();
  await api.backfills[0].tail;
  assert.deepEqual(api.storageWrites, []);
  // A second radio on the same song asks Last.fm nothing new.
  const before = methodsCalled(api).filter((m) => m === "track.getSimilar").length;
  api.handlers.menuActions["lastfm-radio"]({ kind: "track", title: "Jóga", artistName: "Björk" });
  await settle();
  await api.backfills[1].tail;
  assert.equal(methodsCalled(api).filter((m) => m === "track.getSimilar").length, before);
});
