// Civlings game-page bridge — injected into the Defold bundle's index.html
// by civlings/package-web.sh (bob regenerates that file on every bundle, so
// the injection is re-applied at package time).
//
// Defines window.CivlingsGame, the endpoint Lua talks to via html5.run:
//   luaReady()          - Lua init notification (relayed to the wrapper)
//   drain()             - returns queued wrapper->Lua messages as JSON, clears them
//   fromLua(obj)        - Lua -> wrapper message (pong, later: game events)
// The wrapper page talks to this page with postMessage { civlings: 'to-lua', msg }.
(function () {
  'use strict';
  if (window.CivlingsGame) return;
  var inbox = [];
  var textures = {}; // "c,r" -> { w, h, data } — too big for Defold messages
  window.CivlingsGame = {
    luaReady: function () {
      // '*' for the same reason as fromLua: this frame's origin may be
      // opaque (srcdoc inside the sandboxed host frame), and a specific
      // targetOrigin would silently drop the message everywhere else.
      window.parent.postMessage({ civlings: 'from-lua', msg: { type: 'lua_ready' } }, '*');
    },
    drain: function () {
      if (!inbox.length) return '';
      var out = JSON.stringify(inbox);
      inbox.length = 0;
      return out;
    },
    fromLua: function (obj) {
      // '*': the parent app document may live on a different origin than
      // this frame (see App hosting.ts). Events carry no secrets; the
      // parent validates that the sender is exactly this frame.
      window.parent.postMessage({ civlings: 'from-lua', msg: obj }, '*');
    },
    textureData: function (key) {
      var t = textures[key];
      return t ? t.data : '';
    }
  };
  window.addEventListener('message', function (e) {
    var d = e.data;
    if (!d || d.civlings !== 'to-lua' || !d.msg) return;
    var m = d.msg;
    if (m.type === 'gen_texture' && m.data) {
      textures[m.c + ',' + m.r] = { w: m.w, h: m.h, data: m.data };
      inbox.push({ type: 'gen_texture', c: m.c, r: m.r, w: m.w, h: m.h });
    } else {
      inbox.push(m);
    }
  });
})();
