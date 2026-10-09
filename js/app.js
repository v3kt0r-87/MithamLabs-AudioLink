/**
 * Audiolink Application Entry Point
 * Bootstraps all subsystems, wires dependency injection, and binds user inputs.
 */

import { CONFIG } from './config.js';
import { CallState, CallStateMachine } from './fsm.js';
import { AudioEngine } from './audio-engine.js';
import { TelemetryMonitor } from './telemetry.js';
import { SignalingClient } from './signaling.js';
import { WebRTCSessionManager } from './webrtc-session.js';
import { UIManager } from './ui-manager.js';

document.addEventListener('DOMContentLoaded', () => {
    // 1. Instantiate Core Subsystems
    const fsm = new CallStateMachine();
    const audio = new AudioEngine();
    const telemetry = new TelemetryMonitor();
    const signaling = new SignalingClient();
    const session = new WebRTCSessionManager({ fsm, signaling, audio, telemetry });
    const ui = new UIManager();

    let autoCallTarget = null;

    // 2. Initialize UI & Routing
    ui.initTheme();
    ui.initRouting();

    // 3. Bind FSM State Changes directly to UI rendering
    fsm.on('change', ({ current, payload }) => {
        ui.renderFSMState(current, payload);
    });

    // 4. Signaling Events
    signaling.on('open', (id) => {
        try {
            localStorage.setItem('audiolink_username', id);
        } catch (_) {}

        const btnInit = document.getElementById('btn-init-uplink');
        const btnInitText = document.getElementById('btn-init-uplink-text');
        if (btnInit) {
            btnInit.disabled = false;
            if (btnInitText) btnInitText.innerText = 'Initialize Uplink';
            else btnInit.innerText = 'Initialize Uplink';
        }

        const myIdEl = document.getElementById('my-id');
        const localTagEl = document.getElementById('local-user-tag');
        if (myIdEl) myIdEl.innerText = id;
        if (localTagEl) localTagEl.innerText = id;

        fsm.transition(CallState.LOBBY);

        if (autoCallTarget) {
            const target = autoCallTarget;
            autoCallTarget = null;
            const peerInput = document.getElementById('peer-id');
            if (peerInput) peerInput.value = target;
            session.initiateCall(target);
        }
    });

    signaling.on('disconnected', () => {
        ui.updateStatusBadge('Reconnecting', 'var(--warning)');
    });

    signaling.on('error', (err) => {
        const btnInit = document.getElementById('btn-init-uplink');
        const btnInitText = document.getElementById('btn-init-uplink-text');
        if (btnInit) {
            btnInit.disabled = false;
            if (btnInitText) btnInitText.innerText = 'Initialize Uplink';
            else btnInit.innerText = 'Initialize Uplink';
        }

        let errorMsg = `System Error: ${err.type}`;

        if (err.type === 'peer-unavailable') {
            errorMsg = 'Target username is offline or does not exist.';
            audio.playFailedTone();
            session.cancelOutgoingCall(true);
        } else if (err.type === 'network') {
            errorMsg = 'Signaling network dropped. Reconnecting...';
        } else if (err.type === 'browser-incompatible') {
            errorMsg = 'Your browser does not support WebRTC audio.';
        } else if (err.type === 'unavailable-id') {
            errorMsg = 'This username is already taken. Please choose another.';
            fsm.forceState(CallState.STANDBY);
        }

        const isSetup = fsm.state === CallState.STANDBY || fsm.state === CallState.INITIALIZING;
        const targetBox = isSetup ? document.getElementById('setup-error') : document.getElementById('call-error');
        ui.showError(targetBox, errorMsg);

        if (signaling.isConnected && !isSetup) {
            setTimeout(() => {
                if (fsm.state === CallState.LOBBY) {
                    ui.updateStatusBadge('Online', 'var(--brand)');
                }
            }, 3500);
        } else {
            ui.updateStatusBadge('Error', 'var(--danger)');
        }
    });

    // 5. Saved Username & URL Invite Parameters
    try {
        const savedUser = localStorage.getItem('audiolink_username');
        if (savedUser) {
            const input = document.getElementById('username-input');
            if (input) input.value = savedUser;
        }
    } catch (_) {}

    ui.checkUrlInviteParams((target) => {
        autoCallTarget = target;
    });

    // 6. User Action Handlers
    function handleInitialize() {
        audio.unlock();
        ui.requestNotificationPerm();

        const input = document.getElementById('username-input');
        const errorBox = document.getElementById('setup-error');
        const username = input ? input.value.trim().toLowerCase() : '';

        if (!CONFIG.USERNAME_REGEX.test(username)) {
            ui.showError(errorBox, 'Username must be 3-24 characters (alphanumeric, -, _).');
            return;
        }

        ui.hideError(errorBox);
        fsm.transition(CallState.INITIALIZING);
        signaling.initialize(username);
    }

    async function handleStartCall() {
        audio.unlock();
        const input = document.getElementById('peer-id');
        const errorBox = document.getElementById('call-error');
        const target = input ? input.value.trim().toLowerCase() : '';

        if (!CONFIG.USERNAME_REGEX.test(target)) {
            ui.showError(errorBox, 'Target username must be 3-24 characters (alphanumeric, -, _).');
            return;
        }

        ui.hideError(errorBox);
        const res = await session.initiateCall(target);
        if (!res.success) {
            ui.showError(errorBox, res.reason);
        }
    }

    // 7. Hardware & Volume Controls
    const gainSlider = document.getElementById('gain-slider');
    const gainDisplay = document.getElementById('gain-db-display');
    const remoteAudioEl = document.getElementById('remote-audio');
    if (gainSlider) {
        gainSlider.addEventListener('input', () => {
            const pct = audio.applyVolume(gainSlider.value, remoteAudioEl);
            if (gainDisplay) gainDisplay.innerText = `${pct}%`;
        });
    }

    // 8. IPv6 & CBR Privacy Preferences
    try {
        const savedIpv6 = localStorage.getItem('audiolink_force_ipv6') === 'true';
        session.setForceIPv6(savedIpv6);
        ui.updateIPv6UI(savedIpv6);
    } catch (_) {}

    const btnIpv6 = document.getElementById('btn-ipv6-toggle');
    if (btnIpv6) {
        btnIpv6.addEventListener('click', () => {
            const next = !session.forceIPv6;
            session.setForceIPv6(next);
            try { localStorage.setItem('audiolink_force_ipv6', next); } catch (_) {}
            ui.updateIPv6UI(next);
            ui.showInfoBanner(next ? 'IPv6 Only enforced (peer requires IPv6).' : 'IPv6 Only disabled (Auto IPv4/IPv6).');
        });
    }

    try {
        const savedCbr = localStorage.getItem('audiolink_cbr_masking');
        const cbrEnabled = savedCbr !== null ? savedCbr === 'true' : true;
        session.setCBRMasking(cbrEnabled);
        ui.updateCBRUI(cbrEnabled);
    } catch (_) {}

    const btnCbr = document.getElementById('btn-cbr-toggle');
    if (btnCbr) {
        btnCbr.addEventListener('click', () => {
            const next = !session.cbrMasking;
            session.setCBRMasking(next);
            try { localStorage.setItem('audiolink_cbr_masking', next); } catch (_) {}
            ui.updateCBRUI(next);
            ui.showInfoBanner(next ? 'CBR Masking enabled: constant packet stream protects against DPI.' : 'CBR Masking disabled (Standard VBR/DTX).');
        });
    }

    // 9. Button Bindings
    document.getElementById('btn-init-uplink')?.addEventListener('click', handleInitialize);
    document.getElementById('btn-start-call')?.addEventListener('click', handleStartCall);
    document.getElementById('btn-cancel-outgoing')?.addEventListener('click', () => session.cancelOutgoingCall(false));
    document.getElementById('btn-accept')?.addEventListener('click', () => session.acceptIncomingCall());
    document.getElementById('btn-decline')?.addEventListener('click', () => session.declineIncomingCall());
    document.getElementById('btn-end-call')?.addEventListener('click', () => session.terminateCall('Call ended.'));

    document.getElementById('btn-copy-id')?.addEventListener('click', () => {
        const myId = document.getElementById('my-id')?.innerText.trim();
        ui.copyToClipboard(myId, document.getElementById('btn-copy-id'), 'Copied!');
    });

    document.getElementById('btn-copy-link')?.addEventListener('click', () => {
        const myId = document.getElementById('my-id')?.innerText.trim();
        if (!myId || myId === '---') return;
        const url = new URL(window.location.href);
        url.searchParams.delete('join');
        url.searchParams.set('call', myId);
        ui.copyToClipboard(url.toString(), document.getElementById('btn-copy-link'), 'Link Copied!');
    });

    document.getElementById('safety-words-card')?.addEventListener('click', () => {
        const words = document.getElementById('safety-words')?.innerText.trim();
        if (words && words !== 'Verifying...') {
            ui.copyToClipboard(words, document.getElementById('safety-words-card'), 'Copied!');
        }
    });

    document.getElementById('btn-mute')?.addEventListener('click', () => {
        audio.setMute(!audio.isMuted);
        ui.updateMuteUI(audio.isMuted);
    });

    document.getElementById('btn-ns')?.addEventListener('click', async () => {
        const ok = await audio.setNoiseSuppression(!audio.isNsOn);
        ui.updateNSUI(audio.isNsOn);
        if (!ok) ui.showInfoBanner('Hardware noise suppression not supported by browser.');
    });

    document.getElementById('btn-ec')?.addEventListener('click', async () => {
        const ok = await audio.setEchoCancellation(!audio.isEcOn);
        ui.updateECUI(audio.isEcOn);
        if (!ok) ui.showInfoBanner('Hardware echo cancellation not supported by browser.');
    });

    // 10. Global Interaction Listeners for AudioContext Autoplay Unlocking
    ['click', 'touchstart', 'keydown'].forEach(evt => {
        document.addEventListener(evt, () => audio.unlock(), { once: true, passive: true });
    });

    // 11. Audio Device Change Detection
    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
        navigator.mediaDevices.addEventListener('devicechange', () => {
            if (remoteAudioEl && remoteAudioEl.srcObject) {
                remoteAudioEl.play().catch(() => {});
            }
            audio.unlock();
        });
    }

    // 12. Global Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
        const isTextInput = document.activeElement && 
                            document.activeElement.tagName === 'INPUT' && 
                            document.activeElement.type === 'text';

        if (isTextInput) {
            if (e.key === 'Enter') {
                if (document.activeElement.id === 'username-input') handleInitialize();
                if (document.activeElement.id === 'peer-id') handleStartCall();
            }
            return;
        }

        if (e.key === 'm' || e.key === 'M') {
            if (fsm.state === CallState.CONNECTED) {
                audio.setMute(!audio.isMuted);
                ui.updateMuteUI(audio.isMuted);
            }
        } else if (e.key === 'Escape') {
            if (fsm.state === CallState.INCOMING_CALL) {
                session.declineIncomingCall();
            } else if (fsm.state === CallState.CALLING_OUT) {
                session.cancelOutgoingCall(false);
            } else if (fsm.state === CallState.CONNECTED) {
                session.terminateCall('Call ended.');
            }
        }
    });
});
