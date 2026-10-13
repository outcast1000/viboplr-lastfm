// Love/unlove runs off `like:changed` (api.library.onLikeChanged): becoming
// liked is a love; leaving liked — to neutral OR to disliked, the single like
// button's next step — is an unlove; neutral ↔ disliked sends nothing.
const { test, before } = require("node:test");
const assert = require("node:assert/strict");
const { loadPlugin } = require("./harness/sandbox.js");
const { makeMockApi, settle } = require("./harness/mock-api.js");

let api;

before(async () => {
  api = makeMockApi({ session: { sessionKey: "sk-test", username: "alice" } });
  loadPlugin().activate(api);
  await settle();
});

function change(liked, previous, kind) {
  return { kind: kind || "track", name: "Jóga", artistName: "Björk", albumTitle: "Homogenic", albumArtistName: "Björk", liked, previous };
}

async function sent(c) {
  api.posts.length = 0;
  api.handlers.likeChanged(c);
  await settle();
  return api.posts[0] ? new URLSearchParams(api.posts[0]).get("method") : null;
}

test("subscribes to like:changed", () => {
  assert.equal(typeof api.handlers.likeChanged, "function");
});

test("loves on becoming liked, from neutral or from disliked", async () => {
  assert.equal(await sent(change(1, 0)), "track.love");
  assert.equal(await sent(change(1, -1)), "track.love");
});

test("unloves on leaving liked, including liked → disliked", async () => {
  assert.equal(await sent(change(0, 1)), "track.unlove");
  assert.equal(await sent(change(-1, 1)), "track.unlove");
});

test("sends nothing between neutral and disliked, or for non-tracks", async () => {
  assert.equal(await sent(change(0, -1)), null);
  assert.equal(await sent(change(-1, 0)), null);
  assert.equal(await sent(change(1, 0, "artist")), null);
});
