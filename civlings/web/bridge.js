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
  };

  CivlingsHost.prototype._startMock = function () {
    this.hostOrigin = location.origin;
    this.viewer = { username: 'mock-player', id: 0 };
    this.onState('mock');
    this._applyViewer();
    this._applyBalance({ balance: MOCK_BALANCE });
  };

  window.CivlingsHost = CivlingsHost;
  window.CivlingsHost.total = total;
})();
