// The "From Last.fm" Home shelf: on-demand cards, at least six of them, and
// never later than the host's 5-second shelf budget.
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
const stalled = () => new Promise(() => {});
const methodsCalled = (api) => api.fetchCalls.map((c) => new URL(c.url).searchParams.get("method"));

async function activated(opts) {
  const api = makeMockApi(opts);
  loadPlugin().activate(api);
  await settle();
  return api;
}

test("with Last.fm stalled and no history, six cards still arrive inside the budget", async () => {
  const api = await activated({ fetch: stalled });
  const started = Date.now();
  const result = await api.handlers.shelves["lastfm-mixes"](10);
  const took = Date.now() - started;
  assert.ok(took < 4500, `took ${took}ms`);
  assert.equal(result.status, "ok");
  assert.deepEqual(result.items.map((i) => i.name), [
    "Trending on Last.fm", "Rock mix", "Electronic mix", "Indie mix", "Alternative mix", "Pop mix",
  ]);
  for (const item of result.items) assert.deepEqual(item.tracks, [], `${item.name} resolves on play`);
});

test("with Last.fm stalled, song and artist cards come from history alone", async () => {
  const api = await activated({
    fetch: stalled,
    history: [
      { display_title: "Teardrop", display_artist: "Massive Attack", display_album: "Mezzanine" },
      { display_title: "Roads", display_artist: "Portishead" },
    ],
    topArtists: [{ display_name: "Björk" }],
    mostPlayed: [{ display_title: "Hyperballad", display_artist: "Björk", display_album: "Post" }],
  });
  const started = Date.now();
  const result = await api.handlers.shelves["lastfm-mixes"](10);
  assert.ok(Date.now() - started < 4500);
  const names = result.items.map((i) => i.name);
  assert.deepEqual(names.slice(0, 3), ["Similar to Teardrop", "Similar to Roads", "Björk & similar"]);
  assert.equal(names.length, 6);
  assert.deepEqual(result.items[0].tracks, [{ title: "Teardrop", artist_name: "Massive Attack", album_title: "Mezzanine" }]);
  // Björk's card opens with her most played song: no request needed.
  assert.deepEqual(result.items[2].tracks, [{ title: "Hyperballad", artist_name: "Björk", album_title: "Post" }]);
  assert.ok(!methodsCalled(api).includes("artist.getTopTracks"));
});

test("a genre too thin for a mix isn't offered again; the next source fills in", async () => {
  const tagTracks = (p) => {
    const n = p.get("tag") === "obscure" ? 3 : 12;
    return { tracks: { track: Array.from({ length: n }, (_, i) => ({ name: `T${i}`, artist: { name: `${p.get("tag")} ${i}` } })) } };
  };
  const api = await activated({
    session: { sessionKey: "sk", username: "alice" },
    history: [{ display_title: "Teardrop", display_artist: "Massive Attack" }],
    fetch: lastfm({
      "user.getTopTags": { toptags: { tag: [{ name: "obscure" }, { name: "trip-hop" }] } },
      "artist.getTopTags": { toptags: { tag: [{ name: "electronic" }] } },
      "tag.getTopTracks": tagTracks,
    }),
  });
  const first = await api.handlers.shelves["lastfm-mixes"](10);
  assert.ok(first.items.some((i) => i.name === "Obscure mix"), "not known to be thin yet");
  await settle();
  const second = await api.handlers.shelves["lastfm-mixes"](10);
  const names = second.items.map((i) => i.name);
  assert.ok(!names.includes("Obscure mix"));
  assert.ok(names.includes("Trip-hop mix") && names.includes("Electronic mix"));
  assert.ok(names.length >= 6);
});

test("the shelf keeps only the lists of the cards it showed", async () => {
  const api = await activated({
    fetch: lastfm({
      "chart.getTopTracks": { tracks: { track: Array.from({ length: 20 }, (_, i) => ({ name: `Hit ${i}`, artist: { name: `Star ${i}` } })) } },
      "tag.getTopTracks": (p) => ({ tracks: { track: Array.from({ length: 12 }, (_, i) => ({ name: `T${i}`, artist: { name: `${p.get("tag")} ${i}` } })) } }),
    }),
  });
  const result = await api.handlers.shelves["lastfm-mixes"](10);
  await settle();
  const kept = await api.storage.get("home_mixes");
  assert.deepEqual(Object.keys(kept.lists).sort(), result.items.map((i) => i.id).sort());
  for (const list of Object.values(kept.lists)) assert.ok(list.length <= 30);
});
