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

  // In-game Jev button bar hit-testing. The GUI (hud.gui_script) only
  // renders the buttons; engine input coordinates go through transforms
  // that shift with the canvas aspect, so taps are resolved here where
  // the canvas rect is exact. Layout mirrors hud.gui_script (display
  // 960x540): 4 buttons 200x64, gap 14, centres x=159..801, y=50 from
  // the bottom. The bar is up exactly while the civling is IDLE; the
  // fromLua stream tells us the state. Lua stays authoritative: the
  // pick carries no target — the civling applies its own.
  var JEV_BUTTONS = ['harvest', 'craft', 'service', 'expedition'];
  var jevState = 'IDLE';
  var fromLuaOrig = window.CivlingsGame.fromLua;
  window.CivlingsGame.fromLua = function (obj) {
    if (obj && obj.type === 'jev' && obj.state) jevState = obj.state;
    return fromLuaOrig(obj);
  };
  function hitButton(clientX, clientY) {
    if (jevState !== 'IDLE') return null;
    var canvas = document.getElementById('canvas');
    if (!canvas) return null;
    var rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    var fx = (clientX - rect.left) / rect.width;
    var fyTop = (clientY - rect.top) / rect.height;
    var bw = 200 / 960, bh = 64 / 540, gap = 14 / 960;
    var total = 4 * bw + 3 * gap;
    var x0 = (1 - total) / 2;
    var yTop = 1 - (50 + 32) / 540, yBot = 1 - (50 - 32) / 540;
    if (fyTop < yTop || fyTop > yBot) return null;
    for (var i = 0; i < 4; i++) {
      var bx = x0 + i * (bw + gap);
      if (fx >= bx && fx <= bx + bw) return JEV_BUTTONS[i];
    }
    return null;
  }
  document.addEventListener('pointerdown', function (e) {
    var task = hitButton(e.clientX, e.clientY);
    if (task) {
      inbox.push({ type: 'jev_pick', task: task });
    }
  }, true);
})();
