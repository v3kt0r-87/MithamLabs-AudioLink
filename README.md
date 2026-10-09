# Audiolink by MithamLabs — Zero Latency P2P Voice

A lightweight, modern, privacy-hardened browser-based peer-to-peer voice calling application built with WebRTC. Runs as a completely standalone, zero-build web app using native browser ES modules with zero bundlers, transpilers, or external framework dependencies.

🌐 **[Launch Live App](https://v3kt0r-87.github.io/MithamLabs-AudioLink/)**

---

## 🎮 The Origin Story (Why We Built This)

Audiolink was created in **2026** under **MithamLabs** out of pure frustration. 

During a period when Telegram was banned / heavily restricted in India, our voice calls kept constantly dropping in the middle of intense co-op gaming sessions (specifically playing ***Dying Light***). Having to repeatedly alt-tab mid-game to manually re-dial while fighting off volatiles was unbearable. 

Heavy desktop voice apps like Discord or Steam either hogged precious RAM and CPU cycles or introduced severe routing latency spikes. We wanted a clean, uncompromising solution:
1. **Zero Install & Zero Accounts:** Works instantly in any browser tab without installing software or registering phone numbers.
2. **Direct Peer-to-Peer:** Streams directly between players via UDP without routing audio through intermediate servers.
3. **Rock-Solid Connection:** Auto-reconnects cleanly, handles call glare politely, and never drops out unexpectedly.
4. **Near-Zero System Overhead:** Pure CSS, zero heavy canvas/GPU shaders, and pure Web Audio API synthesis so your CPU and GPU stay 100% dedicated to gaming frame rates.

---

## Key Highlights

### 🛡️ Privacy & Traffic Masking
- **Constant Bitrate (CBR) Traffic Masking:** Enforces RFC 7587 `cbr=1;usedtx=0;maxaveragebitrate=32000` via SDP and `RTCRtpSender` parameters. Masks speech and silence into an invariant, metronomic ~128–140 byte packet stream every 20ms, defeating ISP Deep Packet Inspection (DPI) Voice Activity Detection (VAD) and conversational turn timing attacks.
- **End-to-End Cryptographic Verification (SAS):** Generates deterministic, order-independent 4-word Short Authentication Strings (SAS) derived from SHA-256 DTLS certificate fingerprints to visually confirm zero Man-in-the-Middle (MITM) tampering.
- **IPv6-Only Privacy Mode:** In-app toggle drops IPv4 ICE candidates to prevent IPv4 NAT leaks and enforce direct IPv6 peer routing.
- **IP Obfuscation in Diagnostics:** In-app network metrics mask sensitive IP octets (`192.168.*.*` / `2001:0db8:****` / `LAN (mDNS)`).
- **Zero Logging & Zero Tracking:** No analytics, no cookies, no database. Audio streams directly between peer browsers via DTLS-SRTP.

### ⚡ Performance & Engineering
- **Modular Zero-Build Architecture:** Clean native browser ES modules (`import`/`export`) running directly in all modern browsers without Webpack, Vite, or Babel.
- **Finite State Machine (FSM):** Strict mathematical state machine (`STANDBY`, `LOBBY`, `CALLING_OUT`, `INCOMING_CALL`, `CONNECTING`, `CONNECTED`) preventing illegal transitions, race conditions, or hung audio states.
- **WebRTC Call Glare Resolution:** RFC-compliant polite/impolite peer arbitration gracefully resolves simultaneous dialing attempts.
- **Ultra-Low Resource Footprint:** Pure CSS transitions, no heavy canvas animations or GPU shaders, engineered for near-zero CPU and memory usage while gaming or running intensive workloads.
- **Synthesized Audio Engine:** Pure Web Audio API chimes and incoming ringtones synthesized on the fly—zero external sound asset load latency.
- **Hardware Audio Processing:** In-app toggles for native browser Acoustic Echo Cancellation (AEC) and Noise Suppression.
- **Live Connection Diagnostics:** Real-time sliding-window RTT latency, jitter, packet loss, and candidate connection route classification (`IPv6 Direct • CBR`, `P2P (STUN) • CBR`, `Relay (TURN)`).
- **OLED Dark & Porcelain Light Themes:** Instant toggle with persistent local preference.
- **Screen Wake Lock:** Prevents mobile and laptop screens from sleeping during active calls.

---

## ⚖️ Legal & Regulatory Compliance Disclaimer

Audiolink is an open-source software implementation of standard W3C WebRTC specifications and IETF cryptographic protocols. Depending on your jurisdiction, local telecommunications laws and lawful interception mandates differ:

### 🟢 Permitted / Fully Legal
* **United States, Canada, European Union, United Kingdom, Japan, Australia:** Fully protected under freedom of speech, open-source software publication, and statutory privacy regulations (GDPR, ECHR). Open-source client-side cryptography is completely legal.
* **India:** 100% legal for pure internet-to-internet browser calling. Indian Department of Telecommunications (DoT) regulations apply strictly to VoIP interconnected with the Public Switched Telephone Network (PSTN / telecom mobile numbers). Audiolink operates strictly over P2P IP without PSTN bridging.

### 🔴 Restricted / Prohibited Jurisdictions
* **United Arab Emirates (UAE) & Oman:** Unlicensed VoIP tools that are not explicitly authorized by state telecom authorities (e.g. TDRA / Etisalat / du / Omantel) are legally restricted. State firewalls actively block WebRTC/VoIP traffic, and bypassing these restrictions using unauthorized tools can carry statutory fines under local cybercrime laws.
* **China, Russia, Iran:** National telecommunications regulations mandate that voice communication platforms provide state lawful interception backdoors (e.g. SORM, MIIT business licensing, real-name registration). Because Audiolink is serverless and end-to-end encrypted with zero backdoor capability, it is subject to state DPI firewall blocking.
* **North Korea & Turkmenistan:** Total statutory prohibition on unauthorized encrypted communications and internet telephony.

> **Disclaimer:** *This documentation provides technical and regulatory analysis for educational and architectural transparency only. It does not constitute formal legal counsel. Users are solely responsible for ensuring compliance with the communications and telecommunications laws of their respective countries.*

---

## Keyboard Shortcuts

| Key | Action |
| :--- | :--- |
| <kbd>Enter</kbd> | Submit username / Initiate call |
| <kbd>M</kbd> | Toggle microphone mute |
| <kbd>Esc</kbd> | Cancel outgoing call / Decline incoming / End active call |

---

## Project Structure

```text
.
├── index.html              # Main application markup & accessibility attributes
├── css/
│   ├── app.css             # Component layout, responsive grid, UI states
│   └── theme.css           # CSS variables for OLED Dark & Porcelain Light themes
├── js/
│   ├── app.js              # Application bootloader, DOM wiring, shortcut handlers
│   ├── config.js           # Central configuration, timings, and wordlists
│   ├── fsm.js              # Finite State Machine for call lifecycle
│   ├── signaling.js        # PeerJS signaling broker wrapper & custom control signals
│   ├── webrtc-session.js   # PeerConnection lifecycle, candidate filters & CBR hooks
│   ├── audio-engine.js     # Web Audio API synthesizers, meters, and media streams
│   ├── telemetry.js        # WebRTC getStats parser, CBR SDP transformer, IP masking
│   ├── crypto-verify.js    # DTLS certificate fingerprint extractor & SAS word generator
│   └── ui-manager.js       # View transitions, banner alerts, and DOM updates
├── tests/                  # 29 automated unit & integration tests
│   ├── config.test.js
│   ├── crypto-verify.test.js
│   ├── fsm.test.js
│   ├── integration.test.js
│   ├── server.test.js
│   ├── telemetry.test.js
│   └── webrtc-session.test.js
└── package.json            # Node.js test runner metadata
```

---

## Running Locally

Because Audiolink uses zero build tools, you can serve it with any static web server:

```bash
# Using Python 3:
python3 -m http.server 8000

# Using Node.js:
npx serve .
```

Open `http://localhost:8000` in any modern web browser (Chrome, Brave, Firefox, Safari, Edge).

---

## Running the Automated Test Suite

Audiolink includes a comprehensive Node.js test suite with 29 unit and integration tests covering:
- Cryptographic SAS word computation & order independence
- SDP Constant Bitrate (CBR) transformation and injection
- State machine transition guards
- ICE candidate filtering (IPv6 enforcement)
- WebRTC call glare and signaling control protocols
- DOM element binding integrity

Run the test suite using Node.js (v18+):

```bash
npm test
# or
node --test tests/*.test.js
```

---

## Technologies

- **WebRTC** — Real-time peer-to-peer audio streaming encrypted via DTLS-SRTP (Opus codec).
- **RFC 7587 Opus CBR** — SDP parameter munging for constant packet size and DTX suppression.
- **Web Crypto API & SAS Wordlist** — Deterministic Short Authentication String generation for MITM verification.
- **PeerJS** — Public WebRTC signaling broker and connection negotiation.
- **Web Audio API** — Synthesized ringtones, call chimes, and live mic input metering.
- **HTML5 & Vanilla CSS3** — Fully responsive dual-theme design supporting mobile viewports down to 360px.
- **Vanilla ES Modules** — Zero bundlers, zero external dependencies.

---

## 👥 Authors & Contributors

Audiolink is created and maintained under **MithamLabs** by its two contributors:

* **Shankar Vallabhan** — [@v3kt0r-87](https://github.com/v3kt0r-87) (MithamLabs)
* **Priyanshu Pandey** — [@LordShenron](https://github.com/LordShenron) (MithamLabs)

---

## License

This project is licensed under the [GNU General Public License v3.0](LICENSE).
