# YouTube Duo CC

**Keep the previous caption language visible when you switch YouTube CC.**

A lightweight desktop Chrome and Microsoft Edge extension with one button and no settings panel. YouTube controls the current captions; Duo displays the previous track above them.

## How to use

1. Open a YouTube video, turn on its **CC**, and choose your first language.
2. Let the captions load, then click **Duo** in the player controls. A gold label and underline indicate that Duo is on.
3. Choose a second language through **YouTube’s own subtitle settings**.

YouTube displays the new track. Duo displays the previous one in gold, matching the native caption font size and typeface.

Every language change shifts a two-track queue:

| Selected in YouTube | Displayed by Duo |
| --- | --- |
| English, immediately after enabling Duo | Nothing yet; waiting for a language change |
| Chinese | English |
| Spanish | Chinese |

Click **Duo** again to turn it off. Turning YouTube CC off hides both lines. Opening another video resets Duo to off and clears its track history. Hover over the button to see its current state or capture guidance.

## Install in Chrome or Edge

This repository contains an unpacked Manifest V3 extension. No build step or dependency installation is required to use it.

1. Download this repository using **Code → Download ZIP** and extract it, or clone it.
2. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the directory containing `manifest.json`.
5. Refresh any YouTube tabs that were already open.

To update, replace the installed files or pull the latest version, click **Reload** on the extension card, then refresh YouTube.

## How it works

Duo observes the caption responses that YouTube’s player already requests. It copies the returned text and timestamps into a temporary in-memory cache, then displays the previous track in sync with the video clock.

- **No additional caption requests:** Duo forwards YouTube’s existing requests and reads copies of their responses. It does not download, translate, select, or reload tracks itself.
- **Two visible slots:** the current YouTube selection and the immediately previous selection. A small temporary buffer retains up to four recent captured responses to handle late arrivals and revisiting languages.
- **Native controls:** language selection, caption size, and the main CC switch stay in YouTube’s interface.

The data flow is:

```text
YouTube caption response
  → bridge.js: copy and identify the track
  → captions.js: parse timed caption lines
  → queue.js: remember current and previous selections
  → content.js: display the previous line at video.currentTime
```

## Privacy and permissions

- Content scripts run only on `https://www.youtube.com/*`.
- Captions and track metadata are processed locally in the page and extension scripts.
- The extension initiates no network requests, uploads, analytics, or external translation calls.
- Caption caches live in memory and clear when changing videos or refreshing the page.
- Cookies, signed caption URLs, and authentication tokens are not saved to the cache or written to disk.
- No `storage`, `tabs`, microphone, or additional API permissions are requested. The extension still requires access to YouTube pages through its content-script match rule.
- No account setup, API key, or payment is required.

## Limitations and troubleshooting

**Duo must capture the first track before you switch away from it.** It cannot directly read an unexposed cache inside YouTube’s player. If the first track loaded before the observer started, refresh the video while that language is selected, let captions appear, then enable Duo and switch languages.

If no previous captions appear, hover over **Duo** for its status. Make sure the extension was reloaded and the YouTube tab refreshed after installation or an update. A video must offer actual caption tracks; subtitles burned into the video image cannot be captured.

Desktop watch pages, theater mode, fullscreen, pause, seeking, and playback-speed changes are supported by the implementation. Shorts, embedded players, live caption streams, mobile browsers, and picture-in-picture are outside the supported scope. Native captions moved to the top of the player are not used to position Duo’s line.

YouTube’s player interfaces and caption formats are not stable public APIs. Some videos or browser sessions may not expose a response that Duo can capture. Automated tests simulate the player; they do not guarantee every live YouTube configuration works.

## Development

Use Node.js to run the checks. There are no npm dependencies to install.

```sh
npm test
npm run check
```

Tests cover caption timing, passive fetch/XHR capture, stale-video protection, queue shifts, late responses, CC off/on, video resets, and distinguishing uploaded and auto-generated captions.

| File | Purpose |
| --- | --- |
| `manifest.json` | Browser extension configuration and script injection |
| `bridge.js` | Observes native caption responses and selected-track changes in the page’s JavaScript context |
| `captions.js` | Parses JSON/XML captions and looks up text by playback time |
| `queue.js` | Maintains the current and previous track selections and parsed cue cache |
| `content.js`, `content.css` | Duo button, previous-caption overlay, and native font/position matching |
| `popup.html`, `popup.css` | Toolbar help page |
| `tests/` | Automated tests and a simulated UI fixture |

To inspect the UI fixture, serve the repository locally, for example with `python -m http.server 8765`, and open `http://localhost:8765/tests/preview.html`. Its simulated CC button cycles languages; it does not contact YouTube.

For live verification, check English → Chinese → Spanish, toggling Duo, CC off/on, seeking, fullscreen, and navigation to another video in both Chrome and Edge.
