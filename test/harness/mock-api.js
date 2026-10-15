// A mock of the host API surface the Last.fm plugin uses. Every `on*` and
// register call is recorded so tests can reach the handlers; network calls are
// recorded and answered by `opts.fetch` (default: an empty 200 JSON body).
//
// opts.session — what storage returns for "lastfm_session" (null = signed out).
function makeMockApi(opts) {
  opts = opts || {};
  const handlers = {
    info: {},
    tools: {},
    uiActions: {},
    menuActions: {},
    nowPlaying: {},
    search: {},
    scheduler: {},
    scrobbled: null,
    started: null,
    likeChanged: null,
    deepLink: null,
  };
  const fetchCalls = [];
  const posts = [];
  const nowPlayingItems = [];
  const viewData = {};

  const ok = function () { return Promise.resolve(null); };

  const api = {
    handlers,
    fetchCalls,
    posts,
    nowPlayingItems,
    viewData,
    appVersion: "9.9.9",
    log: function () {},
    env: {
      get: function () { return Promise.resolve("test-key"); },
    },
    storage: {
      get: function (key) {
        if (key === "lastfm_session") return Promise.resolve(opts.session || null);
        return Promise.resolve(null);
      },
      set: ok,
      delete: ok,
    },
    network: {
      fetch: function (url, init) {
        fetchCalls.push({ url: url, init: init });
        if (init && init.method === "POST" && init.body) posts.push(init.body);
        if (opts.fetch) return opts.fetch(url, init);
        return Promise.resolve({
          status: 200,
          headers: {},
          json: function () { return Promise.resolve({}); },
          text: function () { return Promise.resolve("{}"); },
        });
      },
      onDeepLink: function (h) { handlers.deepLink = h; return function () {}; },
      openUrl: ok,
    },
    playback: {
      onTrackStarted: function (h) { handlers.started = h; return function () {}; },
      onTrackScrobbled: function (h) { handlers.scrobbled = h; return function () {}; },
      playTracks: ok,
    },
    library: {
      onLikeChanged: function (h) { handlers.likeChanged = h; return function () {}; },
      recordHistoryPlaysBatch: function () { return Promise.resolve({ imported: 0, skipped: 0 }); },
      setTrackLikesBatch: function () { return Promise.resolve(0); },
    },
    informationTypes: {
      onFetch: function (id, h) { handlers.info[id] = h; return function () {}; },
    },
    nowPlayingInfo: {
      registerItem: function (item) { nowPlayingItems.push(item); return function () {}; },
      onFetch: function (id, h) { handlers.nowPlaying[id] = h; return function () {}; },
    },
    search: {
      onQuery: function (id, h) { handlers.search[id] = h; return function () {}; },
    },
    contextMenu: {
      onAction: function (id, h) { handlers.menuActions[id] = h; return function () {}; },
    },
    assistant: {
      onTool: function (name, h) { handlers.tools[name] = h; return function () {}; },
    },
    scheduler: {
      register: ok,
      unregister: ok,
      complete: ok,
      onDue: function (id, h) { handlers.scheduler[id] = h; return function () {}; },
    },
    ui: {
      onAction: function (id, h) { handlers.uiActions[id] = h; return function () {}; },
      setViewData: function (id, data) { viewData[id] = data; },
      showNotification: function () {},
    },
  };
  return api;
}

/** Let the plugin's promise chains (session restore, key load) settle. */
async function settle() {
  for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0));
}

module.exports = { makeMockApi, settle };
