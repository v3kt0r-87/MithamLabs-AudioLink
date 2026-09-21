# AudioLink — Zero Latency P2P Voice

A lightweight, modern, low-resource browser-based peer-to-peer voice calling application built with WebRTC and PeerJS. Runs as a completely standalone, single-file web app with zero dependencies and no build step required.

🌐 **[Launch Live App](https://v3kt0r-87.github.io/WebRTC-P2PCall/)**

---

## Highlights

- **Single-File Architecture:** The entire app lives inside [`index.html`](index.html). No Node.js, no bundlers, no build step.
- **Direct Peer-to-Peer Audio:** Audio streams directly between browsers using WebRTC and the Opus codec—no intermediate audio servers or voice logging.
- **Ultra-Low Resource Footprint:** Pure CSS transitions, no canvas animations or heavy GPU filters, engineered for near-zero idle CPU, GPU, and RAM overhead during gaming or multitasking.
- **Hardware Audio Processing:** In-app toggles for native Echo Cancellation (AEC) and Noise Suppression.
- **Synthesized Audio Alerts:** Zero-asset Web Audio API ringtones and chimes without loading external media files.
- **Shareable Invite Links:** Generate direct invite links (`?call=USERNAME`) for quick 1-click calls.
- **Live Connection Diagnostics:** Real-time round-trip latency (RTT), jitter, packet loss, and candidate connection details.
- **OLED Dark & Porcelain Light Themes:** Instant toggle with persistent local preference.
- **Screen Wake Lock:** Keeps screen active during voice calls on mobile and laptop displays.
- **Privacy First:** No tracking, no cookies, no analytics.

---

## Keyboard Shortcuts

| Key | Action |
| --- | --- |
| <kbd>Enter</kbd> | Submit username / Initiate call |
| <kbd>M</kbd> | Toggle microphone mute |
| <kbd>Esc</kbd> | Cancel outgoing call / Decline incoming / End active call |

---


## Technologies

- **WebRTC** — Real-time peer-to-peer audio streaming (Opus codec).
- **PeerJS** — WebRTC signaling and peer discovery.
- **Web Audio API** — Synthesized ringtones, call chimes, and live mic input metering.
- **HTML5 & Vanilla CSS3** — Fully responsive dual-theme design (100dvh).
- **Vanilla JavaScript** — Zero framework overhead, minimal memory footprint.

---

## License

This project is licensed under the [GNU General Public License v3.0](LICENSE).
