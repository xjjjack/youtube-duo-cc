const test = require('node:test');
const assert = require('node:assert/strict');
const { parseJSON, at } = require('../captions.js');

test('JSON3 segments, Unicode, gaps and exact end boundaries', () => {
  const cues = parseJSON(JSON.stringify({ events: [
    { tStartMs: 1000, dDurationMs: 1000, segs: [{ utf8: 'Hello ' }, { utf8: '世界' }] },
    { tStartMs: 4000, dDurationMs: 1500, segs: [{ utf8: 'Hola' }] }
  ] }));
  assert.equal(at(cues, 0), '');
  assert.equal(at(cues, 1), 'Hello 世界');
  assert.equal(at(cues, 2), '');
  assert.equal(at(cues, 4.8), 'Hola');
  assert.equal(at(cues, 5.5), '');
  assert.equal(at(cues, 1.2), 'Hello 世界'); // seek backwards
});
test('rolling automatic captions replace previous text and handle appends', () => {
  const cues = parseJSON(JSON.stringify({ events: [
    { tStartMs: 0, dDurationMs: 5000, segs: [{ utf8: 'one' }] },
    { tStartMs: 1000, dDurationMs: 5000, segs: [{ utf8: 'two' }] },
    { tStartMs: 1200, dDurationMs: 1000, aAppend: 1, segs: [{ utf8: ' three' }] },
    { tStartMs: 3000, dDurationMs: 1000, segs: [{ utf8: 'four' }] }
  ] }));
  assert.equal(at(cues, 0.5), 'one');
  assert.equal(at(cues, 1.1), 'two'); // append text must not appear early
  assert.equal(at(cues, 2), 'two three');
  assert.equal(at(cues, 3), 'four');
});
test('ignores window events and empty or invalid cues', () => {
  const cues = parseJSON(JSON.stringify({ events: [
    { id: 1 }, { tStartMs: 0, segs: [{ utf8: '\n' }] },
    { tStartMs: 'bad', dDurationMs: 10, segs: [{ utf8: 'bad' }] }
  ] }));
  assert.deepEqual(cues, []);
  assert.equal(at(cues, 10), '');
});
