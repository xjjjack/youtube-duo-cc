const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function harness() {
  const events = [], calls = [], timers = [];
  let receive, selection = { languageCode: 'en', kind: 'asr', vssId: 'a.en' }, ccOn = true;
  const location = { href: 'https://www.youtube.com/watch?v=abc', pathname: '/watch', origin: 'https://www.youtube.com' };
  const body = JSON.stringify({ events: [{ tStartMs: 0, dDurationMs: 1000, segs: [{ utf8: 'Hello' }] }] });
  const data = { videoDetails: { videoId: 'abc' }, captions: { playerCaptionsTracklistRenderer: { captionTracks: [
    { languageCode: 'en', kind: 'asr', vssId: 'a.en', name: { simpleText: 'English' }, baseUrl: 'https://www.youtube.com/api/timedtext?v=abc&lang=en&kind=asr' }
  ] } } };
  class XHR {
    constructor() { this.listeners = []; }
    open(method, url) { this.responseURL = url; }
    addEventListener(type, fn) { if (type === 'load') this.listeners.push(fn); }
    complete(raw) { this.status = 200; this.responseType = 'document'; this.responseXML = { raw }; this.listeners.forEach(fn => fn()); }
  }
  const button = { hasAttribute: () => true, getAttribute: () => String(ccOn) };
  const player = { getOption: () => selection, getPlayerResponse: () => data, querySelector: () => button,
    setOption: () => { throw new Error('Observer must never select or reload a track'); } };
  const window = { XMLHttpRequest: XHR, addEventListener: (_, fn) => { receive = fn; }, postMessage: msg => events.push(msg),
    fetch: async (...args) => { calls.push(args); return { ok: true, clone: () => ({ text: async () => body }) }; } };
  vm.runInNewContext(fs.readFileSync(require.resolve('../bridge.js'), 'utf8'), {
    window, document: { getElementById: () => player, documentElement: { lang: 'en' } }, location, URL,
    setInterval: fn => timers.push(fn), XMLSerializer: class { serializeToString(doc) { return doc.raw; } }
  });
  const snapshot = () => receive({ source: window, origin: location.origin, data: { channel: 'youtube-duo-cc-v2', direction: 'request', command: 'snapshot' } });
  return { events, calls, body, window, location, snapshot, poll: () => timers.forEach(fn => fn()), select: next => { selection = next; }, setCC: on => { ccOn = on; } };
}
test('snapshot and state polling generate zero caption requests', () => {
  const h = harness(); h.snapshot(); h.poll();
  assert.equal(h.events[0].state.track.sourceLanguage, 'en'); assert.equal(h.calls.length, 0);
});
test('captures a native request once and replays cached data without fetching', async () => {
  const h = harness(); await h.window.fetch('https://www.youtube.com/api/timedtext?v=abc&lang=en&kind=asr&pot=secret');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.events.find(e => e.type === 'captions').raw, h.body);
  h.snapshot(); h.snapshot(); assert.equal(h.calls.length, 1);
  assert.ok(h.events.filter(e => e.type === 'captions').length >= 3);
  assert.ok(h.events.every(e => !JSON.stringify(e).includes('secret')));
});
test('translation selection appears in state without programmatic track changes', () => {
  const h = harness(); h.poll(); h.select({ languageCode: 'en', kind: 'asr', translationLanguage: { languageCode: 'zh-Hans' } }); h.poll();
  assert.equal(h.events.at(-1).state.track.translation, 'zh-Hans'); assert.equal(h.calls.length, 0);
});
test('XML document responses are captured without refetching', () => {
  const h = harness(); const xhr = new h.window.XMLHttpRequest();
  const raw = '<timedtext><body><p t="0" d="1000">Hello</p></body></timedtext>';
  xhr.open('GET', 'https://www.youtube.com/api/timedtext?v=abc&lang=en'); xhr.complete(raw);
  assert.equal(h.events.find(e => e.type === 'captions').raw, raw); assert.equal(h.calls.length, 0);
});
test('old video responses cannot contaminate a new video cache', async () => {
  const h = harness(); await h.window.fetch('https://www.youtube.com/api/timedtext?v=old&lang=en');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.events.filter(e => e.type === 'captions').length, 0);
});
