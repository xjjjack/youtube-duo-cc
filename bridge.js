/* MAIN world: passive observation only. Never fetch, reload or select captions. */
(() => {
  const CHANNEL = 'youtube-duo-cc-v2';
  const cache = new Map();
  let lastState = '', cachedCharacters = 0, currentVideo = '';
  const post = value => window.postMessage({ channel: CHANNEL, direction: 'notice', ...value }, location.origin);
  function videoId() { return location.pathname === '/watch' ? new URL(location.href).searchParams.get('v') || '' : ''; }
  function captionURL(value) {
    try {
      const url = new URL(value, location.href);
      return url.protocol === 'https:' && url.hostname === 'www.youtube.com' && url.pathname === '/api/timedtext' ? url : null;
    } catch { return null; }
  }
  function nativeState() {
    const id = videoId(), player = document.getElementById('movie_player');
    let selection, response;
    try { selection = player?.getOption?.('captions', 'track'); response = player?.getPlayerResponse?.(); } catch { /* Player may be navigating. */ }
    const button = player?.querySelector('.ytp-subtitles-button');
    let ccOn = !!selection?.languageCode;
    if (button?.hasAttribute('aria-pressed')) ccOn = button.getAttribute('aria-pressed') === 'true';
    if (!id || !selection?.languageCode) return { videoId: id, ccOn, track: null };
    const tracks = response?.videoDetails?.videoId === id ? response.captions?.playerCaptionsTracklistRenderer?.captionTracks || [] : [];
    const metadata = tracks.find(t => selection.vssId && t.vssId === selection.vssId) ||
      tracks.find(t => t.languageCode === selection.languageCode && (t.kind || '') === (selection.kind || ''));
    const base = captionURL(metadata?.baseUrl);
    const translated = selection.translationLanguage;
    const translation = typeof translated === 'string' ? translated : translated?.languageCode || '';
    const text = name => typeof name === 'string' ? name : name?.simpleText || name?.runs?.map(r => r.text).join('') || '';
    const sourceLanguage = base?.searchParams.get('lang') || selection.languageCode;
    const language = translation || sourceLanguage;
    let label = text(translated?.languageName) || (!translation ? text(metadata?.name) : '');
    if (!label) {
      try { label = new Intl.DisplayNames([document.documentElement.lang || 'en'], { type: 'language' }).of(language); } catch { label = language; }
    }
    return { videoId: id, ccOn, track: { videoId: id, sourceLanguage, translation,
      kind: base?.searchParams.get('kind') || selection.kind || '', name: base?.searchParams.get('name') || '', label } };
  }
  function poll(force = false) {
    const state = nativeState();
    if (state.videoId !== currentVideo) { currentVideo = state.videoId; cache.clear(); cachedCharacters = 0; }
    const serialized = JSON.stringify(state);
    if (force || serialized !== lastState) { lastState = serialized; post({ type: 'state', state }); }
  }
  function observe(value, raw) {
    const url = captionURL(value);
    if (!url || url.searchParams.get('v') !== videoId() || typeof raw !== 'string') return;
    try {
      if (raw.trim().startsWith('{')) {
        if (!JSON.parse(raw).events?.some(e => e.segs?.some(s => s.utf8?.trim()))) return;
      } else if (!/<(?:text|p)\b/.test(raw) || !/<(?:transcript|timedtext)\b/.test(raw)) return;
    } catch { return; }
    poll();
    const track = { videoId: url.searchParams.get('v'), sourceLanguage: url.searchParams.get('lang') || '',
      translation: url.searchParams.get('tlang') || '', kind: url.searchParams.has('kind') ? url.searchParams.get('kind') : undefined,
      name: url.searchParams.has('name') ? url.searchParams.get('name') : undefined };
    const key = JSON.stringify(track);
    const payload = { type: 'captions', track, raw };
    // Keep only a few recent native responses, without URLs or auth tokens.
    if (raw.length <= 24000000) {
      cachedCharacters -= cache.get(key)?.raw.length || 0;
      cache.delete(key); cache.set(key, payload); cachedCharacters += raw.length;
      while (cache.size > 4 || cachedCharacters > 24000000) {
        const oldest = cache.keys().next().value; cachedCharacters -= cache.get(oldest).raw.length; cache.delete(oldest);
      }
    }
    post(payload);
  }
  const originalFetch = window.fetch;
  window.fetch = function (...args) {
    const result = originalFetch.apply(this, args);
    try {
      const value = typeof args[0] === 'string' ? args[0] : args[0]?.url || String(args[0]);
      if (captionURL(value)) result.then(res => {
        if (res.ok) res.clone().text().then(raw => observe(res.url || value, raw)).catch(() => {});
      }).catch(() => {});
    } catch { /* Observation must never affect the player's fetch. */ }
    return result;
  };
  if (window.XMLHttpRequest) {
    const open = window.XMLHttpRequest.prototype.open, urls = new WeakMap();
    window.XMLHttpRequest.prototype.open = function (method, value, ...args) {
      const result = open.call(this, method, value, ...args);
      try {
        if (!urls.has(this)) this.addEventListener('load', () => {
          try {
            const url = urls.get(this);
            if (!url || this.status !== 200) return;
            const raw = this.responseType === 'document' ? new XMLSerializer().serializeToString(this.responseXML || this.response) :
              this.responseType === 'json' ? JSON.stringify(this.response) :
              this.responseType === 'arraybuffer' ? new TextDecoder().decode(this.response) : this.responseText;
            observe(this.responseURL || url.href, raw);
          } catch { /* Leave unsupported response types untouched. */ }
        });
        urls.set(this, captionURL(value));
      } catch { /* Observation must never affect the player's XHR. */ }
      return result;
    };
  }
  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== location.origin || event.data?.channel !== CHANNEL || event.data.direction !== 'request') return;
    if (event.data.command !== 'snapshot') return;
    poll(true);
    for (const payload of cache.values()) post(payload);
  });
  setInterval(poll, 200);
})();
