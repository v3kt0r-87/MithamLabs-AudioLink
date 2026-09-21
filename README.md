# P2P Voice Call (WebRTC & PeerJS)

A lightweight, modern, low-resource browser-based peer-to-peer voice calling web application built using WebRTC and PeerJS, designed for zero-latency communication during gaming sessions or when standard VOIP apps fail.

[View Live App](https://v3kt0r-87.github.io/WebRTC-P2PCall/)

## Features

- **P2P Audio Communication:** Direct WebRTC browser-to-browser voice streaming with no intermediate audio servers.
- **Dark & Light Themes:** Instant toggle between OLED Pure Black and Crisp Minimal Light themes with persistent preference storage.
- **Ultra-Low Resource Footprint:** Zero continuous background canvas animations and zero heavy GPU blur filters for near-zero idle CPU, GPU, and RAM usage.
- **Gaming Voice Modes:** Switch between Voice Activity (toggle mute with <kbd>M</kbd>) and Push-to-Talk (<kbd>Space</kbd> hold to transmit).
- **Remote Speech Detection:** Subtle speaking indicator on your teammate's avatar when they are speaking.
- **Hardware Audio Processing:** Real-time toggles for Noise Suppression and Echo Cancellation via WebRTC track constraints.
- **Microphone Mute & Hotkeys:** Quick mic mute toggle with keyboard shortcut support (<kbd>M</kbd> to mute, <kbd>Space</kbd> for PTT, <kbd>Esc</kbd> to end/decline).
- **Call Management & Synthesized Ringtones:** Zero-latency Web Audio ringtones, connect chimes, and background desktop alerts.
- **Screen Wake Lock:** Prevents mobile and laptop displays from dimming or sleeping during active voice sessions.
- **One-Click Direct Invite Links:** Share direct invite links (`?call=USERNAME`) with automated setup and 1-click joining.
- **Audio Dynamic Compression & Gain:** Gain slider (0x to 3.0x with decibel calculation) and dynamics compression to prevent clipping.
- **Live Telemetry & Diagnostics:** Real-time stats for average RTT latency, jitter, packet loss, connection integrity, network routing type, and IP resolution.
- **Lightweight Audio Level Meter:** Efficient, low-frequency mic intensity bar with live dB input metering.
- **Zero External Tracking:** Offline-ready, deterministic client-side SVG identicons (no third-party avatar CDNs or tracking).
- **Session Persistence:** Remembers your chosen username via local storage.

## Keyboard Shortcuts

| Key | Action |
| --- | --- |
| <kbd>Enter</kbd> | Submit username / Initiate call |
| <kbd>M</kbd> | Toggle Microphone Mute / Live (in Live Mode) |
| <kbd>Space</kbd> | Hold to Transmit (in Push-to-Talk Mode) |
| <kbd>Esc</kbd> | Cancel outgoing call / Decline incoming / Terminate active call |

## Technologies Used

- **WebRTC** (Real-Time Communications, Opus Codec)
- **PeerJS** (P2P Signaling with automatic reconnection watchdog)
- **Web Audio API** (Unified audio graph processing, dynamic compression, sound cues)
- **HTML5 & Vanilla CSS3** (Dual-theme modern interface, responsive 100dvh layout)
- **Vanilla JavaScript** (Zero framework bloat, minimal CPU/memory footprint)

## License

This project is licensed under the GNU GPL v3 License.
