# AudioLink — Zero Latency P2P Voice (WebRTC & PeerJS)

A lightweight, modern, low-resource peer-to-peer voice calling application built using WebRTC and PeerJS, designed for zero-latency communication during gaming sessions or when standard VOIP apps fail. Available both as an instant web app and as a standalone desktop app for Linux and Windows.

- 🌐 **[Launch Web App](https://v3kt0r-87.github.io/WebRTC-P2PCall/)**
- 🖥️ **Desktop Releases:** Download precompiled Linux (`.AppImage`, `.deb`) and Windows (`.exe`, portable) binaries from the [GitHub Releases](../../releases) page or Actions artifacts.

## Features

- **P2P Audio Communication:** Direct WebRTC browser-to-browser voice streaming with no intermediate audio servers.
- **Dark & Light Themes:** Instant toggle between OLED Pure Black and Crisp Minimal Light themes with persistent preference storage.
- **Ultra-Low Resource Footprint:** Zero continuous background canvas animations and zero heavy GPU blur filters for near-zero idle CPU, GPU, and RAM usage.
- **Microphone Mute & Hotkeys:** Instant mic mute toggle with keyboard shortcut support (<kbd>M</kbd> to toggle mute, <kbd>Esc</kbd> to end/decline).
- **Remote Speech Detection:** Subtle speaking indicator on your teammate's user card when they are speaking.
- **Hardware Audio Processing:** Real-time toggles for Noise Suppression and Echo Cancellation via WebRTC track constraints.
- **Call Management & Synthesized Ringtones:** Zero-latency Web Audio ringtones, connect chimes, and background desktop alerts.
- **Screen Wake Lock:** Prevents mobile and laptop displays from dimming or sleeping during active voice sessions.
- **One-Click Direct Invite Links:** Share direct invite links (`?call=USERNAME`) with automated setup and 1-click joining.
- **Hardware Echo Cancellation & Volume Control:** Native WebRTC AEC3 hardware echo cancellation with built-in remote volume balance control.
- **Live Telemetry & Diagnostics:** Real-time stats for average RTT latency, jitter, packet loss, connection integrity, network routing type, and IP resolution.
- **Lightweight Audio Level Meter:** Efficient, low-frequency mic intensity bar with live dB input metering.
- **Zero External Tracking:** No cookies, third-party analytics, or external asset dependencies.
- **Session Persistence:** Remembers your chosen username via local storage.

## Keyboard Shortcuts

| Key | Action |
| --- | --- |
| <kbd>Enter</kbd> | Submit username / Initiate call |
| <kbd>M</kbd> | Toggle Microphone Mute / Live |
| <kbd>Esc</kbd> | Cancel outgoing call / Decline incoming / Terminate active call |

## Desktop Applications (Linux & Windows)

AudioLink can be run as a standalone desktop app powered by Electron:
- **Zero Local Toolchain Needed:** Binaries are automatically built in the cloud via GitHub Actions.
- **Linux:** `.AppImage` (portable, runs anywhere) and `.deb` (Debian, Ubuntu, Mint).
- **Windows:** NSIS Installer (`Setup.exe`) and Portable executable.
- **Microphone Permissions:** Pre-authorized native audio pipeline with full hardware AEC and Noise Suppression.

To build manually in your fork:
1. Navigate to the **Actions** tab on GitHub.
2. Select **Build Desktop Apps** and click **Run workflow**.
3. Download the compiled packages directly from the workflow artifacts or tag a release (`v1.0.0`) to generate automated GitHub releases.

## Technologies Used

- **WebRTC** (Real-Time Communications, Opus Codec)
- **PeerJS** (P2P Signaling with automatic reconnection watchdog)
- **Web Audio API** (Unified audio graph processing, dynamic compression, sound cues)
- **Electron & electron-builder** (Cross-platform desktop packaging with automated GitHub Actions CI)
- **HTML5 & Vanilla CSS3** (Dual-theme modern interface, responsive 100dvh layout)
- **Vanilla JavaScript** (Zero framework bloat, minimal CPU/memory footprint)

## License

This project is licensed under the GNU GPL v3 License.
