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
function lastfm(routes) {
  return function (url) {
    const params = new URL(url).searchParams;
    const route = routes[params.get("method")];
    return respond((typeof route === "function" ? route(params) : route) || {});
  };
}
const tracks = (artist, n, prefix = "Song") =>
  Array.from({ length: n }, (_, i) => ({ name: `${prefix} ${i + 1}`, artist: { name: artist } }));

async function activated(opts) {
  const api = makeMockApi(opts);
  loadPlugin().activate(api);
  await settle();
  return api;
}

const request = (over = {}) => ({
  current: { title: "Jóga", artistName: "Björk", albumTitle: "Homogenic", durationSecs: 300 },
  sessionSeed: null,
  recent: [],
  formatFilter: null,
  count: 8,
  ...over,
});

test("it declares itself an auto-continue provider and registers the handler", async () => {
  const api = await activated();
  assert.deepEqual(manifest.contributes.autoContinue, { name: "Last.fm" });
  assert.equal(typeof api.handlers.autoContinue, "function");
});

test("suggests similar songs, skipping the current one and what was just played", async () => {
  const similar = [{ name: "Jóga", artist: { name: "Björk" } }, { name: "Played", artist: { name: "Múm" } }]
    .concat(tracks("Sigur Rós", 3), tracks("Múm", 2, "Tune"), tracks("Portishead", 3, "Roads"));
  const api = await activated({ fetch: lastfm({ "track.getSimilar": { similartracks: { track: similar } } }) });
  const out = await api.handlers.autoContinue(request({ recent: [{ title: "Played", artistName: "Múm" }], count: 5 }));
  assert.equal(out.length, 5);
  const keys = out.map((t) => `${t.title}|${t.artist_name}`);
  assert.ok(!keys.includes("Jóga|Björk"));
  assert.ok(!keys.includes("Played|Múm"));
});

test("an unknown song falls back to its artist's mix", async () => {
  const api = await activated({
    fetch: lastfm({
      "track.getSimilar": { error: 6, message: "Track not found" },
      "artist.getTopTracks": (p) => ({ toptracks: { track: tracks(p.get("artist"), 4) } }),
      "artist.getSimilar": { similarartists: { artist: [{ name: "Múm" }] } },
    }),
  });
  const out = await api.handlers.autoContinue(request({ current: { title: "Demo", artistName: "Björk" } }));
  assert.ok(out && out.length > 0);
  assert.ok(out.some((t) => t.artist_name === "Múm"));
});

test("answers null when it can't help: a video queue, no playback source, nothing found", async () => {
  let api = await activated();
  assert.equal(await api.handlers.autoContinue(request({ formatFilter: "video" })), null);

  api = await activated({ plugins: [] });
  assert.equal(await api.handlers.autoContinue(request()), null);
  assert.equal(api.fetchCalls.filter((c) => /getSimilar/.test(c.url)).length, 0, "Last.fm not asked");

  api = await activated({
    fetch: lastfm({
      "track.getSimilar": { error: 6, message: "Track not found" },
      "artist.getTopTracks": { error: 6, message: "Artist not found" },
      "artist.getSimilar": { error: 6, message: "Artist not found" },
    }),
  });
  assert.equal(await api.handlers.autoContinue(request()), null);
});

test("a failing Last.fm is null, never a throw into the host", async () => {
  const api = await activated({ fetch: () => Promise.reject(new Error("offline")) });
  assert.equal(await api.handlers.autoContinue(request()), null);
});
