/* Pure caption helpers, also exercised by the Node tests. */
(() => {
  function normalize(cues) {
    return cues.filter(c => Number.isFinite(c.start) && Number.isFinite(c.end) && c.end > c.start && c.text.trim())
      .sort((a, b) => a.start - b.start);
  }
  function parseJSON(raw) {
    const data = JSON.parse(raw);
    const cues = [];
    for (const event of data.events || []) {
      if (!event.segs) continue;
      const start = Number(event.tStartMs) / 1000;
      if (!Number.isFinite(start)) continue;
      const text = event.segs.map(s => s.utf8 || '').join('');
      const end = start + Number(event.dDurationMs ?? 2000) / 1000;
      if (event.aAppend && cues.length) {
        const previous = cues[cues.length - 1];
        const combinedEnd = Math.max(previous.end, end);
        previous.end = Math.min(previous.end, start);
        cues.push({ start, end: combinedEnd, text: previous.text + text });
      } else {
        // Auto-generated rolling captions are replaced by the next event.
        if (cues.length && cues[cues.length - 1].end > start) cues[cues.length - 1].end = start;
        cues.push({ start, end, text });
      }
    }
    return normalize(cues);
  }
  function parseXML(raw) {
    const doc = new DOMParser().parseFromString(raw, 'text/xml');
    if (doc.querySelector('parsererror')) throw new Error('Invalid subtitle response.');
    return normalize(Array.from(doc.querySelectorAll('text, p')).map(el => {
      const millis = el.tagName === 'p';
      const scale = millis ? 1000 : 1;
      const start = Number(el.getAttribute(millis ? 't' : 'start')) / scale;
      const duration = Number(el.getAttribute(millis ? 'd' : 'dur') || (millis ? 2000 : 2)) / scale;
      return { start, end: start + duration, text: el.textContent };
    }));
  }
  function parse(raw) { return raw.trim().startsWith('{') ? parseJSON(raw) : parseXML(raw); }
  function at(cues, seconds) {
    let lo = 0, hi = cues.length - 1, index = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (cues[mid].start <= seconds) { index = mid; lo = mid + 1; } else hi = mid - 1;
    }
    return index >= 0 && seconds < cues[index].end ? cues[index].text.trim() : '';
  }
  const api = { normalize, parseJSON, parseXML, parse, at };
  if (typeof module !== 'undefined') module.exports = api;
  else globalThis.DuoCaptions = api;
})();
