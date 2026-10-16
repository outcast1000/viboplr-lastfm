// Mix behaviour pinned after the 1.10.0 review: storage reads without writes,
// tag fallbacks, dislikes before the per-artist cap, short similar lists kept,
// and the session's first song never suggested back.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadPlugin } = require("./harness/sandbox.js");
const { makeMockApi, settle } = require("./harness/mock-api.js");

function respond(body) {
  return Promise.resolve({ status: 200, headers: {}, json: () => Promise.resolve(body), text: () => Promise.resolve(JSON.stringify(body)) });
}
function lastfm(routes) {
  return function (url) {
    const params = new URL(url).searchParams;
    const route = routes[params.get("method")];
    return respond((typeof route === "function" ? route(params) : route) || {});
  };
}
const tracks = (artist, n, prefix = "Song") =>
  Array.from({ length: n }, (_, i) => ({ name: `${prefix} ${i + 1}`, artist: { name: artist } }));
const methodsCalled = (api) => api.fetchCalls.map((c) => new URL(c.url).searchParams.get("method"));

async function activated(opts) {
  const api = makeMockApi(opts);
  loadPlugin().activate(api);
  await settle();
  return api;
}

test("an artist mix reads the tabs' stored responses and writes nothing", async () => {
  const now = Date.now();
  const api = await activated({
    stored: {
      "cache:artist_top_tracks:björk": { ts: now, value: { toptracks: { track: tracks("Björk", 5, "Stored") } } },
      "cache:similar_artists:björk": { ts: now, value: { similarartists: { artist: [{ name: "Múm" }] } } },
    },
    fetch: lastfm({ "artist.getTopTracks": (p) => ({ toptracks: { track: tracks(p.get("artist"), 5) } }) }),
  });
  api.storageWrites.length = 0;
  api.handlers.menuActions["lastfm-radio"]({ kind: "artist", artistName: "Björk" });
  await settle();
  const tail = await api.backfills[0].tail;
  assert.ok(tail[0].title.startsWith("Stored"), "the stored Top Songs answer was used");
  assert.ok(tail.some((t) => t.artist_name === "Múm"));
  const asked = methodsCalled(api);
  assert.ok(!asked.includes("artist.getSimilar"), "the stored Similar Artists answer was used");
  assert.equal(asked.filter((m) => m === "artist.getTopTracks").length, 1, "only Múm's top tracks were fetched");
  assert.deepEqual(api.storageWrites, [], "nothing written");
});

test("a signed-in user without tags of their own still gets genre mixes, from the artist", async () => {
  const api = await activated({
    session: { sessionKey: "sk", username: "alice" },
    history: [{ display_title: "Teardrop", display_artist: "Massive Attack" }],
    fetch: lastfm({
      "user.getTopTags": { toptags: { tag: [] } },
      "artist.getTopTags": { toptags: { tag: [{ name: "trip-hop" }] } },
      "track.getSimilar": { similartracks: { track: tracks("A", 3).concat(tracks("B", 3), tracks("C", 3)) } },
      "tag.getTopTracks": (p) => ({ tracks: { track: Array.from({ length: 12 }, (_, i) => ({ name: `T${i}`, artist: { name: `${p.get("tag")} ${i}` } })) } }),
    }),
  });
  const result = await api.handlers.shelves["lastfm-mixes"](10);
  assert.ok(result.items.some((i) => i.name === "Trip-hop mix"));
});

test("disliked songs don't use up their artist's place in a mix", async () => {
  // Artist A: three disliked songs first, then two good ones. Tag mixes cap
  // each artist at 2; the two good ones must both survive.
  const list = [1, 2, 3, 4, 5].map((n) => ({ name: `A${n}`, artist: { name: "A" } }))
    .concat(Array.from({ length: 10 }, (_, i) => ({ name: `B${i}`, artist: { name: `B${i}` } })));
  const api = await activated({
    history: [{ display_title: "x", display_artist: "Seed" }],
    disliked: ["A1|A", "A2|A", "A3|A"],
    fetch: lastfm({
      "track.getSimilar": { similartracks: { track: [] } },
      "artist.getTopTags": { toptags: { tag: [{ name: "rock" }] } },
      "tag.getTopTracks": { tracks: { track: list } },
    }),
  });
  const result = await api.handlers.shelves["lastfm-mixes"](10);
  const rock = result.items.find((i) => i.name === "Rock mix");
  assert.deepEqual(rock.tracks.filter((t) => t.artist_name === "A").map((t) => t.title).sort(), ["A4", "A5"]);
});

test("a short similar list is kept, first, and topped up with the artist's mix", async () => {
  const api = await activated({
    fetch: lastfm({
      "track.getSimilar": { similartracks: { track: [{ name: "Near 1", artist: { name: "Múm" } }, { name: "Near 2", artist: { name: "Sigur Rós" } }] } },
      "artist.getTopTracks": (p) => ({ toptracks: { track: tracks(p.get("artist"), 6) } }),
      "artist.getSimilar": { similarartists: { artist: [{ name: "Portishead" }] } },
    }),
  });
  api.handlers.menuActions["lastfm-radio"]({ kind: "track", title: "Jóga", artistName: "Björk" });
  await settle();
  const titles = (await api.backfills[0].tail).map((t) => t.title);
  // [seed, Near…, Near…, …artist mix]
  assert.deepEqual(titles.slice(1, 3).sort(), ["Near 1", "Near 2"]);
  assert.ok(titles.length > 3, "topped up from the artist mix");
});

test("auto-continue never suggests the session's first song back", async () => {
  const similar = [{ name: "Start", artist: { name: "S" } }].concat(tracks("Other", 3), tracks("More", 3, "Tune"));
  const api = await activated({ fetch: lastfm({ "track.getSimilar": { similartracks: { track: similar } } }) });
  const out = await api.handlers.autoContinue({
    current: { title: "Jóga", artistName: "Björk", albumTitle: null, durationSecs: 300 },
    sessionSeed: { title: "Start", artistName: "S" },
    recent: [],
    formatFilter: null,
    count: 8,
  });
  assert.ok(out.length > 0);
  assert.ok(!out.some((t) => t.title === "Start" && t.artist_name === "S"));
});
