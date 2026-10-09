// Local fixture only. Clicking native CC cycles the selection.
history.replaceState(null, '', '/watch?v=preview');
const demoTracks = [
  { videoId: 'preview', sourceLanguage: 'en', kind: 'asr', translation: '', label: 'English', text: 'A walk through the forest.' },
  { videoId: 'preview', sourceLanguage: 'en', kind: 'asr', translation: 'zh-Hans', label: 'Chinese', text: '在森林中散步。' },
  { videoId: 'preview', sourceLanguage: 'en', kind: 'asr', translation: 'es', label: 'Spanish', text: 'Un paseo por el bosque.' }
];
let demoIndex = 0;
const demoCache = new Set([0]);
function demoPost(value) { window.postMessage({ channel: 'youtube-duo-cc-v2', direction: 'notice', ...value }, location.origin); }
function demoState() { demoPost({ type: 'state', state: { videoId: 'preview', ccOn: true, track: demoTracks[demoIndex] } }); }
function demoCaptions(index) {
  demoPost({ type: 'captions', track: demoTracks[index], raw: JSON.stringify({ events: [{ tStartMs: 0, dDurationMs: 60000, segs: [{ utf8: demoTracks[index].text }] }] }) });
}
window.addEventListener('message', event => {
  if (event.data.channel !== 'youtube-duo-cc-v2' || event.data.direction !== 'request' || event.data.command !== 'snapshot') return;
  demoState(); demoCache.forEach(demoCaptions);
});
document.querySelector('.ytp-subtitles-button').addEventListener('click', () => {
  demoIndex = (demoIndex + 1) % demoTracks.length; demoCache.add(demoIndex);
  document.querySelector('.caption-window').textContent = demoTracks[demoIndex].text;
  demoState(); demoCaptions(demoIndex);
});
