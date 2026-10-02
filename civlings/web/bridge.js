// Civlings host bridge — the Civitai App (wrapper page) side.
//
// Implements the Civitai app postMessage protocol by hand against the
// documented wire shapes (@civitai/app-sdk dist/blocks/messages.d.ts):
//   wire format: window.postMessage({ type, payload }, targetOrigin)
//   parent -> block: BLOCK_INIT (re-posted until BLOCK_READY), BUZZ_BALANCE_RESULT, VIEWER_RESULT
//   block -> parent: BLOCK_READY, GET_BUZZ_BALANCE / GET_VIEWER ({ requestId })
// Replies carry the same requestId; a present `error` field rejects.
//
// Security rules baked in:
//  - BLOCK_INIT is only accepted from a civitai.com origin (or localhost in dev).
//  - The BLOCK_INIT token's `raw` JWT is never logged, stored, or forwarded.
//    The game (Lua) only ever receives viewer identity + balance numbers.

(function () {
  'use strict';

  var CIVITAI_ORIGIN = /^https:\/\/([a-z0-9-]+\.)*civitai\.com$/i;
  var DEV_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;
  var MOCK_BALANCE = { blue: 1500, green: 250, yellow: 6000 }; // matches the app-suite mock defaults

  function total(b) { return (b.blue || 0) + (b.green || 0) + (b.yellow || 0); }

  function CivlingsHost(opts) {
    this.gameFrame = opts.gameFrame;
    this.onViewer = opts.onViewer || function () {};
    this.onBalance = opts.onBalance || function () {};
    this.onState = opts.onState || function () {};
    this.hostOrigin = null;
    this.viewer = null;
    this.balance = null;
    this.mock = false;
    this.selectedCell = null;              // last tile clicked in the game
    this.civlingCell = { c: 4, r: 4 };     // where the Civling stands (Lua reports)
    this.stats = null;
    this._pending = new Map();
    this._seq = 0;
    this._initTimer = null;
    var self = this;
    window.addEventListener('message', function (e) { self._onMessage(e); });

    var params = new URLSearchParams(location.search);
    this.mock = params.get('mock') === '1';
    if (this.mock) {
      this._startMock();
    } else {
      // If no real host initializes us quickly, fall back to a labeled mock
      // so local development (and CI screenshots) always show the full UI.
      this._initTimer = setTimeout(function () {
        if (!self.hostOrigin) { self.mock = true; self._startMock(); }
      }, 2000);
    }
  }

  CivlingsHost.prototype._onMessage = function (e) {
    var msg = e.data;
    if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') return;

    if (msg.type === 'BLOCK_INIT') {
      if (!CIVITAI_ORIGIN.test(e.origin) && !DEV_ORIGIN.test(e.origin)) return;
      clearTimeout(this._initTimer);
      this.hostOrigin = e.origin;
      var p = msg.payload || {};
      this.viewer = p.viewer || null;
      this._post({ type: 'BLOCK_READY', payload: {} });
      this.onState('live');
      this._applyViewer();
      this.requestBalance();
      return;
    }

    // Replies must come from the host origin we accepted at init.
    if (!this.hostOrigin || e.origin !== this.hostOrigin) return;
    var payload = msg.payload || {};
    var pending = payload.requestId && this._pending.get(payload.requestId);
    if (!pending) return;
    this._pending.delete(payload.requestId);
    if (payload.error) pending.reject(new Error(String(payload.error)));
    else pending.resolve(payload);
  };

  CivlingsHost.prototype._post = function (msg) {
    if (this.hostOrigin) window.parent.postMessage(msg, this.hostOrigin);
  };

  CivlingsHost.prototype.request = function (type, payload) {
    var self = this;
    var requestId = 'civ-' + (++this._seq) + '-' + Date.now();
    payload = payload || {};
    payload.requestId = requestId;
    return new Promise(function (resolve, reject) {
      self._pending.set(requestId, { resolve: resolve, reject: reject });
      self._post({ type: type, payload: payload });
      setTimeout(function () {
        if (self._pending.delete(requestId)) reject(new Error(type + ' timed out'));
      }, 10000);
    });
  };

  CivlingsHost.prototype.requestBalance = function () {
    var self = this;
    if (this.mock) { this._applyBalance({ balance: MOCK_BALANCE }); return Promise.resolve(); }
    return this.request('GET_BUZZ_BALANCE').then(function (res) {
      self._applyBalance(res);
    }).catch(function (err) {
      // Balance reads need the buzz:read:self scope; degrade silently like the app suite.
      self.onState('balance-error: ' + err.message);
    });
  };

  CivlingsHost.prototype._applyViewer = function () {
    this.onViewer(this.viewer, this.mock);
    this._toGame({ type: 'viewer', viewer: this.viewer });
  };

  CivlingsHost.prototype._applyBalance = function (res) {
    if (!res || !res.balance) return;
    this.balance = res.balance;
    this.onBalance(this.balance, total(this.balance), this.mock);
    this._toGame({ type: 'buzz_balance', balance: this.balance });
  };

  // Wrapper <-> game page relay. The game page is same-origin (bundled with
  // this app), but we still use postMessage so the boundary stays explicit.
  CivlingsHost.prototype._toGame = function (msg) {
    var w = this.gameFrame && this.gameFrame.contentWindow;
    if (w) w.postMessage({ civlings: 'to-lua', msg: msg }, location.origin);
  };

  CivlingsHost.prototype.pingGame = function () {
    this._toGame({ type: 'ping' });
  };

  // Called when Lua announces readiness: (re)deliver identity + balance,
  // which may have been produced before the game page started listening.
  CivlingsHost.prototype.resendState = function () {
    if (this.viewer) this._toGame({ type: 'viewer', viewer: this.viewer });
    if (this.balance) this._toGame({ type: 'buzz_balance', balance: this.balance });
    this._toGame({ type: 'announce_stats' });
  };

  // The cell commands act on: the player's selection, else the Civling's tile.
  CivlingsHost.prototype.targetCell = function () {
    return this.selectedCell || this.civlingCell;
  };

  CivlingsHost.prototype.assignJev = function (task) {
    var cell = this.targetCell();
    this._toGame({ type: 'jev', task: task, c: cell.c, r: cell.r });
    return cell;
  };

  // Mock-mode economy only: Jev yields credit and generation debits the
  // displayed (sample) balance. In live mode the host owns the wallet and
  // yields/generation settle through real consent + workflow charges.
  CivlingsHost.prototype.mockAdjust = function (delta) {
    if (!this.mock || !this.balance) return;
    var b = { blue: this.balance.blue || 0, green: this.balance.green || 0,
              yellow: (this.balance.yellow || 0) + delta };
    this._applyBalance({ balance: b });
  };

  var GEN_COST = 10; // mock Buzz price of one generated prop texture

  // Generate a texture for a prop on the target cell.
  // Mock mode: procedural canvas art stands in for the Civitai result so the
  // whole pipeline (scaffold -> bytes -> Lua texture) is testable with zero
  // spend. Live mode is deliberately NOT faked: it needs the SDK
  // estimate -> consent -> submit -> poll consent path inside a registered
  // app host, which this standalone shell does not have yet.
  CivlingsHost.prototype.generate = function (prompt) {
    if (!this.mock) {
      this.onState('generation unavailable: needs the live Civitai host (app not registered yet)');
      return false;
    }
    if (!this.balance || total(this.balance) < GEN_COST) {
      this.onState('not enough mock Buzz to generate');
      return false;
    }
    var cell = this.targetCell();
    var art = mockTexture(prompt || 'decoration');
    this.mockAdjust(-GEN_COST);
    this._toGame({ type: 'gen_prop', c: cell.c, r: cell.r });
    var self = this;
    setTimeout(function () {
      self._toGame({ type: 'gen_texture', c: cell.c, r: cell.r,
                     w: art.w, h: art.h, data: art.data });
    }, 700);
    return true;
  };

  CivlingsHost.prototype._startMock = function () {
    this.hostOrigin = location.origin;
    this.viewer = { username: 'mock-player', id: 0 };
    this.onState('mock');
    this._applyViewer();
    this._applyBalance({ balance: MOCK_BALANCE });
  };

  // Deterministic procedural stand-in for a generated texture: 128x128 RGBA.
  function mockTexture(prompt) {
    var seed = 7;
    for (var i = 0; i < prompt.length; i++) seed = (seed * 31 + prompt.charCodeAt(i)) >>> 0;
    function rnd() { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; }
    var hue = Math.floor(rnd() * 360);
    var cv = document.createElement('canvas');
    cv.width = 128; cv.height = 128;
    var g = cv.getContext('2d');
    var grad = g.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0, 'hsl(' + hue + ',70%,62%)');
    grad.addColorStop(1, 'hsl(' + ((hue + 60) % 360) + ',65%,34%)');
    g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
    g.fillStyle = 'hsl(' + ((hue + 180) % 360) + ',85%,72%)';
    g.beginPath(); g.arc(34 + rnd() * 60, 30 + rnd() * 30, 13, 0, 7); g.fill();
    g.fillStyle = 'hsla(' + ((hue + 300) % 360) + ',60%,22%,0.55)';
    g.beginPath(); g.moveTo(0, 128);
    for (var x = 0; x <= 128; x += 16) g.lineTo(x, 84 + rnd() * 26);
    g.lineTo(128, 128); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.92)';
    g.font = 'bold 64px system-ui, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText((prompt.trim()[0] || '?').toUpperCase(), 64, 70);
    var px = g.getImageData(0, 0, 128, 128).data;
    var bin = '';
    for (var j = 0; j < px.length; j += 8192) {
      bin += String.fromCharCode.apply(null, px.subarray(j, j + 8192));
    }
    return { w: 128, h: 128, data: btoa(bin) };
  }

  window.CivlingsHost = CivlingsHost;
  window.CivlingsHost.total = total;
})();
