const test = require('node:test');
const assert = require('node:assert/strict');
const { CaptionQueue } = require('../queue.js');
const en = { videoId: 'abc', sourceLanguage: 'en', kind: 'asr', translation: '', label: 'English' };
const zh = { ...en, translation: 'zh-Hans', label: 'Chinese' };
const es = { ...en, translation: 'es', label: 'Spanish' };
const cue = text => [{ start: 0, end: 10, text }];
const state = track => ({ videoId: 'abc', ccOn: true, track });

test('English → Chinese → Spanish shifts the two slots and discards the oldest', () => {
  const q = new CaptionQueue(); q.update(state(en)); q.remember(en, cue('English')); q.toggle();
  assert.deepEqual(q.display(), []);
  q.update(state(zh)); q.remember(zh, cue('Chinese'));
  assert.equal(q.display()[0].text, 'English');
  q.update(state(es));
  assert.equal(q.display()[0].text, 'Chinese');
  assert.equal(q.previous.translation, 'zh-Hans');
});
test('off/on re-arms using the current track instead of a stale previous track', () => {
  const q = new CaptionQueue(); q.update(state(en)); q.remember(en, cue('English')); q.toggle(); q.update(state(zh));
  q.toggle(); assert.deepEqual(q.display(), []);
  q.remember(zh, cue('Chinese')); q.toggle(); assert.deepEqual(q.display(), []);
  q.update(state(es)); assert.equal(q.display()[0].text, 'Chinese');
});
test('CC off and transient empty selections do not shift the queue', () => {
  const q = new CaptionQueue(); q.update(state(en)); q.remember(en, cue('English')); q.toggle(); q.update(state(zh));
  q.update({ videoId: 'abc', ccOn: false, track: null }); assert.deepEqual(q.display(), []);
  q.update(state(zh)); assert.equal(q.previous.sourceLanguage, 'en'); assert.equal(q.display()[0].text, 'English');
});
test('late native responses fill the previous slot without changing selection history', () => {
  const q = new CaptionQueue(); q.update(state(en)); q.toggle(); q.update(state(zh));
  assert.deepEqual(q.display(), []);
  q.remember(en, cue('late English')); assert.equal(q.display()[0].text, 'late English');
  q.remember(es, cue('unrelated')); assert.equal(q.display()[0].text, 'late English');
});
test('a new video resets both slots, cached data and enabled state', () => {
  const q = new CaptionQueue(); q.update(state(en)); q.remember(en, cue('English')); q.toggle(); q.update(state(zh));
  q.update({ videoId: 'next', ccOn: true, track: { ...en, videoId: 'next' } });
  assert.equal(q.enabled, false); assert.equal(q.previous, null); assert.equal(q.cache.length, 0);
  q.remember(en, cue('stale')); assert.equal(q.cache.length, 0);
});
test('manual and auto-generated tracks in the same language remain distinct', () => {
  const q = new CaptionQueue(); const manual = { ...en, kind: '', label: 'English uploaded' };
  q.update(state(en)); q.remember(en, cue('generated')); q.toggle(); q.update(state(manual));
  assert.equal(q.display()[0].text, 'generated');
});
