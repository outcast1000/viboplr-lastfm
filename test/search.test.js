const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadPlugin } = require("./harness/sandbox.js");
const { makeMockApi, settle } = require("./harness/mock-api.js");

const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "manifest.json"), "utf8"));

const STAR = "https://lastfm.freetls.fastly.net/i/u/300x300/2a96cbd8b46e442fc41c2b86b821562f.png";
const COVER = "https://lastfm.freetls.fastly.net/i/u/300x300/okcomputer.png";
const img = (url) => [{ "#text": url.replace("300x300", "34s"), size: "small" }, { "#text": url, size: "extralarge" }];

function respond(body) {
  return Promise.resolve({ status: 200, headers: {}, json: () => Promise.resolve(body), text: () => Promise.resolve(JSON.stringify(body)) });
}

// Answers each search method with the given body (or an error when it's an Error).
function searchFetch(bodies) {
  return function (url) {
    const method = new URL(url).searchParams.get("method");
    const body = bodies[method];
    if (body instanceof Error) return Promise.reject(body);
    return respond(body || { results: {} });
  };
}

async function searchWith(bodies, query = "radiohead", limit = 6) {
  const api = makeMockApi({ fetch: searchFetch(bodies) });
  loadPlugin().activate(api);
  await settle();
  return { api, result: await api.handlers.search.lastfm(query, limit) };
}

test("the manifest's search provider gets a handler", async () => {
  const api = makeMockApi();
  loadPlugin().activate(api);
  await settle();
  const declared = manifest.contributes.searchProviders.map((p) => p.id);
  assert.deepEqual(Object.keys(api.handlers.search), declared);
});

test("a search returns artists, albums and tracks, and drops the placeholder star", async () => {
  const { api, result } = await searchWith({
    "artist.search": { results: { artistmatches: { artist: [{ name: "Radiohead", listeners: "5123456", image: img(STAR) }] } } },
    "album.search": { results: { albummatches: { album: [{ name: "OK Computer", artist: "Radiohead", image: img(COVER) }] } } },
    "track.search": { results: { trackmatches: { track: [{ name: "Karma Police", artist: "Radiohead", image: img(STAR) }] } } },
  });
  assert.deepEqual(result, {
    status: "ok",
    artists: [{ name: "Radiohead", image_url: null, subtitle: "5.1M listeners" }],
    albums: [{ title: "OK Computer", artist_name: "Radiohead", image_url: COVER }],
    tracks: [{ title: "Karma Police", artist_name: "Radiohead", image_url: null }],
  });
  const methods = api.fetchCalls.map((c) => new URL(c.url).searchParams.get("method")).sort();
  assert.deepEqual(methods, ["album.search", "artist.search", "track.search"]);
  const params = new URL(api.fetchCalls[0].url).searchParams;
  assert.equal(params.get("limit"), "6");
});

test("a lone match that Last.fm sends as an object still counts", async () => {
  const { result } = await searchWith({
    "artist.search": { results: { artistmatches: { artist: { name: "Björk", listeners: "0" } } } },
  });
  assert.deepEqual(result.artists, [{ name: "Björk", image_url: null, subtitle: null }]);
  assert.deepEqual(result.tracks, []);
});

test("nothing found anywhere is empty, not ok", async () => {
  const { result } = await searchWith({});
  assert.deepEqual(result, { status: "empty" });
});

test("one failing method doesn't hide what the others found", async () => {
  const { result } = await searchWith({
    "artist.search": new Error("Last.fm error 29: Rate limit exceeded"),
    "track.search": { results: { trackmatches: { track: [{ name: "Jóga", artist: "Björk" }] } } },
  });
  assert.equal(result.status, "ok");
  assert.deepEqual(result.tracks, [{ title: "Jóga", artist_name: "Björk", image_url: null }]);
});

test("all three failing is an error with Last.fm's reason", async () => {
  const err = new Error("Last.fm error 29: Rate limit exceeded");
  const { result } = await searchWith({ "artist.search": err, "album.search": err, "track.search": err });
  assert.deepEqual(result, { status: "error", message: "Last.fm error 29: Rate limit exceeded" });
});

test("a blank query asks nothing", async () => {
  const { api, result } = await searchWith({}, "   ");
  assert.deepEqual(result, { status: "empty" });
  assert.equal(api.fetchCalls.filter((c) => /\.search/.test(c.url)).length, 0);
});
