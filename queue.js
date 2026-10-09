/* Two-slot caption history, independent of the DOM and YouTube networking. */
(() => {
  function same(a, b) {
    return !!a && !!b && a.sourceLanguage === b.sourceLanguage && (a.translation || '') === (b.translation || '') &&
      (a.kind === undefined || b.kind === undefined || a.kind === b.kind) &&
      (a.name === undefined || b.name === undefined || a.name === b.name);
  }
  class CaptionQueue {
    constructor() { this.reset(''); }
    reset(videoId) {
      this.videoId = videoId; this.enabled = false; this.ccOn = false;
      this.current = null; this.previous = null; this.cache = [];
    }
    update(state) {
      if (state.videoId !== this.videoId) this.reset(state.videoId);
      this.ccOn = !!state.ccOn;
      if (!state.track || !state.ccOn) return;
      if (this.enabled && this.current && !same(this.current, state.track)) this.previous = this.current;
      this.current = { ...state.track };
    }
    toggle() {
      this.enabled = !this.enabled;
      this.previous = null;
      if (!this.ccOn) this.current = null;
    }
    remember(track, cues) {
      if (track.videoId !== this.videoId || !cues.length) return;
      this.cache = this.cache.filter(item => !same(item.track, track));
      this.cache.push({ track: { ...track }, cues });
      while (this.cache.length > 4) {
        const index = this.cache.findIndex(item => !same(item.track, this.current) && !same(item.track, this.previous));
        this.cache.splice(index < 0 ? 0 : index, 1);
      }
    }
    cached(track) { return this.cache.slice().reverse().find(item => same(item.track, track))?.cues || []; }
    display() {
      return this.enabled && this.ccOn && this.previous && !same(this.previous, this.current) ? this.cached(this.previous) : [];
    }
  }
  const api = { CaptionQueue, same };
  if (typeof module !== 'undefined') module.exports = api;
  else globalThis.DuoQueue = api;
})();
