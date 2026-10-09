(() => {
  const CHANNEL = 'youtube-duo-cc-v2';
  const queue = new DuoQueue.CaptionQueue();
  let player, button, overlay, status, currentId = '';
  const snapshot = () => window.postMessage({ channel: CHANNEL, direction: 'request', command: 'snapshot' }, location.origin);
  function applyState(state) { queue.update(state); updateButton(); }
  window.addEventListener('message', event => {
    const message = event.data;
    if (event.source !== window || event.origin !== location.origin || message?.channel !== CHANNEL || message.direction !== 'notice') return;
    const id = new URL(location.href).searchParams.get('v') || '';
    if (message.type === 'state' && message.state?.videoId === id) applyState(message.state);
    if (message.type === 'captions' && message.track?.videoId === id) {
      if (queue.videoId !== id) queue.reset(id);
      try { queue.remember(message.track, DuoCaptions.parse(message.raw)); } catch { /* Ignore malformed captions without affecting native CC. */ }
      updateButton();
    }
  });
  function updateButton() {
    if (!button) return;
    let label = 'Duo off — click to remember the current CC';
    if (queue.enabled) {
      if (!queue.ccOn || !queue.current) label = 'Duo on — turn on YouTube CC to remember a track';
      else if (queue.previous) label = queue.cached(queue.previous).length ?
        `Duo on — showing previous CC: ${queue.previous.label || queue.previous.translation || queue.previous.sourceLanguage}` :
        'Duo on — previous track was not captured. Reload with that CC selected, then switch languages.';
      else label = queue.cached(queue.current).length ?
        `Duo on — remembered ${queue.current.label || queue.current.sourceLanguage}; choose another CC in YouTube` :
        'Duo on — waiting to capture current CC before you switch languages';
    }
    button.setAttribute('aria-pressed', String(queue.enabled));
    button.setAttribute('aria-label', label); button.title = label;
    if (status && status.textContent !== label) status.textContent = label;
  }
  function mount(target) {
    if (target === player && button?.isConnected && overlay?.isConnected) return;
    button?.remove(); overlay?.remove(); status?.remove();
    player = target;
    button = document.createElement('button'); button.className = 'ytp-button duo-button';
    const label = document.createElement('span'); label.className = 'duo-button-label'; label.textContent = 'Duo'; button.append(label);
    overlay = document.createElement('div'); overlay.id = 'duo-cc-overlay'; overlay.hidden = true;
    const line = document.createElement('div'); line.className = 'duo-line'; line.append(document.createElement('span')); overlay.append(line);
    status = document.createElement('div'); status.className = 'duo-sr-status'; status.setAttribute('role', 'status');
    button.addEventListener('click', event => {
      event.stopPropagation(); queue.toggle(); overlay.hidden = true; updateButton(); snapshot();
    });
    player.querySelector('.ytp-right-controls').prepend(button); player.append(overlay, status);
    updateButton(); snapshot();
  }
  function tick() {
    const id = location.pathname === '/watch' ? new URL(location.href).searchParams.get('v') || '' : '';
    if (id !== currentId) { currentId = id; queue.reset(id); if (overlay) overlay.hidden = true; updateButton(); snapshot(); }
    const target = document.getElementById('movie_player');
    if (target?.querySelector('.ytp-right-controls')) mount(target);
    if (!overlay) return;
    const video = player.querySelector('video');
    const track = queue.display();
    const text = video && !player.classList.contains('ad-showing') && !video.ended ? DuoCaptions.at(track, video.currentTime) : '';
    overlay.hidden = !id || !text;
    const span = overlay.querySelector('span');
    if (span.textContent !== text) span.textContent = text;
    if (overlay.hidden) return;
    const bounds = player.getBoundingClientRect();
    let bottom = Math.max(60, bounds.height * .14);
    for (const box of player.querySelectorAll('.ytp-caption-window-container .caption-window')) {
      const rect = box.getBoundingClientRect();
      if (box.textContent.trim() && rect.height && rect.top > bounds.top + bounds.height / 2) bottom = Math.max(bottom, bounds.bottom - rect.top + 10);
    }
    overlay.style.bottom = `${bottom}px`;
    const native = player.querySelector('.ytp-caption-window-container .ytp-caption-segment') || player.querySelector('.ytp-caption-window-container .caption-window');
    if (native) {
      const style = getComputedStyle(native);
      for (const property of ['fontSize', 'fontFamily', 'fontWeight', 'fontStyle', 'lineHeight', 'letterSpacing']) overlay.style[property] = style[property];
    }
  }
  setInterval(tick, 150); tick();
})();
