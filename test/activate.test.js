const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadPlugin } = require("./harness/sandbox.js");
const { makeMockApi, settle } = require("./harness/mock-api.js");

const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "manifest.json"), "utf8"));

async function activated(opts) {
  const api = makeMockApi(opts);
  loadPlugin().activate(api);
  await settle();
  return api;
}

test("every information type the manifest declares gets a handler", async () => {
  const api = await activated();
  const declared = manifest.contributes.informationTypes.map((t) => t.id).sort();
  assert.deepEqual(Object.keys(api.handlers.info).sort(), declared);
});

test("every assistant tool the manifest declares gets a handler", async () => {
  const api = await activated();
  const declared = manifest.contributes.assistant.tools.map((t) => t.name).sort();
  assert.deepEqual(Object.keys(api.handlers.tools).sort(), declared);
});

test("every manifest context-menu item has an action handler", async () => {
  const api = await activated();
  for (const item of manifest.contributes.contextMenuItems) {
    assert.equal(typeof api.handlers.menuActions[item.id], "function", item.id);
  }
});

test("it is a scrobbler and registers the Listeners now-playing item", async () => {
  const api = await activated();
  assert.equal(typeof api.handlers.scrobbled, "function");
  assert.equal(typeof api.handlers.started, "function");
  // The id stays "scrobbles": persisted selection/order in the host key on it.
  assert.deepEqual(api.nowPlayingItems.map((i) => i.id), ["scrobbles"]);
  assert.equal(typeof api.handlers.nowPlaying.scrobbles, "function");
});

test("a signed-out scrobble is skipped with a message, without a network call", async () => {
  const api = await activated();
  const before = api.fetchCalls.length;
  const report = await api.handlers.scrobbled({ title: "Jóga", artist_name: "Björk" });
  assert.equal(report.status, "skipped");
  assert.match(report.message, /Connect Last\.fm/);
  assert.equal(api.fetchCalls.length, before);
});

test("a signed-in scrobble posts track.scrobble and reports sent", async () => {
  const api = await activated({ session: { sessionKey: "sk-test", username: "alice" } });
  api.posts.length = 0;
  const report = await api.handlers.scrobbled({ title: "Jóga", artist_name: "Björk", album_title: "Homogenic" });
  assert.deepEqual(report, { status: "sent" });
  assert.equal(new URLSearchParams(api.posts[0]).get("method"), "track.scrobble");
});

test("a track info handler goes to ws.audioscrobbler.com", async () => {
  const api = await activated();
  await api.handlers.info.track_info({ kind: "track", name: "Jóga", artistName: "Björk" });
  assert.ok(api.fetchCalls.some((c) => /ws\.audioscrobbler\.com/.test(c.url)), "expected a Last.fm request");
});

test("the manifest declares an updateUrl pointing at this repo", () => {
  // The app bundles this plugin; without updateUrl the bundled copy is never
  // checked for updates and releases from here would reach nobody.
  assert.equal(
    manifest.updateUrl,
    "https://github.com/outcast1000/viboplr-lastfm/releases/latest/download/update.json",
  );
});
