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
  window.CivlingsGame = {
    luaReady: function () {
      window.parent.postMessage({ civlings: 'from-lua', msg: { type: 'lua_ready' } }, window.location.origin);
    },
    drain: function () {
      if (!inbox.length) return '';
      var out = JSON.stringify(inbox);
      inbox.length = 0;
      return out;
    },
    fromLua: function (obj) {
      window.parent.postMessage({ civlings: 'from-lua', msg: obj }, window.location.origin);
    }
  };
  window.addEventListener('message', function (e) {
    var d = e.data;
    if (d && d.civlings === 'to-lua' && d.msg) inbox.push(d.msg);
  });
})();
