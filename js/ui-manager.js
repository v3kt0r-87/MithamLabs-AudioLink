/**
 * Audiolink UI Manager
 * Handles DOM rendering, theme switching, call timer, clipboard, wake lock, and notifications.
 */

import { CallState } from './fsm.js';

export class UIManager {
    constructor() {
        this.callTimerInterval = null;
        this.titleAlertInterval = null;
        this.bannerTimeout = null;
        this.wakeLock = null;
        this.incomingNotification = null;
        this.originalTitle = 'Audiolink by MithamLabs — Zero Latency P2P Voice';
    }

    initTheme() {
        const saved = localStorage.getItem('audiolink_theme') || 
            (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
        this.applyTheme(saved);

        const btn = document.getElementById('btn-theme-toggle');
        if (btn) {
            btn.addEventListener('click', () => {
                const curr = document.documentElement.getAttribute('data-theme') || 'dark';
                const next = curr === 'dark' ? 'light' : 'dark';
                this.applyTheme(next);
                try { localStorage.setItem('audiolink_theme', next); } catch (_) {}
            });
        }
    }

    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        const icon = document.getElementById('theme-icon');
        const text = document.getElementById('theme-text');
        if (icon && text) {
            if (theme === 'light') {
                icon.innerText = '🌙';
                text.innerText = 'Dark';
            } else {
                icon.innerText = '☀️';
                text.innerText = 'Light';
            }
        }
    }

    initRouting() {
        const handleRoute = () => {
            const isPrivacy = window.location.hash === '#privacy';
            const mainView = document.getElementById('main-view');
            const privacyView = document.getElementById('privacy-view');
            if (mainView && privacyView) {
                mainView.style.display = isPrivacy ? 'none' : 'block';
                privacyView.style.display = isPrivacy ? 'block' : 'none';
                window.scrollTo(0, 0);
            }
        };
        window.addEventListener('hashchange', handleRoute);
        handleRoute();
    }

    renderFSMState(state, payload = {}) {
        const setupEl = document.getElementById('setup-phase');
        const lobbyEl = document.getElementById('call-controls');
        const stageEl = document.getElementById('call-stage');
        const outgoingBox = document.getElementById('outgoing-box');
        const incomingModal = document.getElementById('incoming-modal');

        switch (state) {
            case CallState.STANDBY:
                if (setupEl) setupEl.style.display = 'block';
                if (lobbyEl) lobbyEl.style.display = 'none';
                if (stageEl) stageEl.style.display = 'none';
                if (outgoingBox) outgoingBox.style.display = 'none';
                if (incomingModal) incomingModal.style.display = 'none';
                this.updateStatusBadge('Standby', 'var(--text-muted)');
                this.stopCallTimer();
                this.releaseWakeLock();
                break;

            case CallState.INITIALIZING:
                this.updateStatusBadge('Connecting', 'var(--warning)');
                const btnInit = document.getElementById('btn-init-uplink');
                if (btnInit) {
                    btnInit.disabled = true;
                    btnInit.innerText = 'Connecting Uplink...';
                }
                break;

            case CallState.LOBBY:
                if (setupEl) setupEl.style.display = 'none';
                if (lobbyEl) lobbyEl.style.display = 'block';
                if (stageEl) stageEl.style.display = 'none';
                if (outgoingBox) outgoingBox.style.display = 'none';
                if (incomingModal) incomingModal.style.display = 'none';
                this.resetCallButton();
                this.updateStatusBadge('Online', 'var(--brand)');
                this.stopCallTimer();
                this.clearTitleAlert();
                this.releaseWakeLock();

                if (payload.bannerMsg) {
                    this.showInfoBanner(payload.bannerMsg);
                }
                break;

            case CallState.CALLING_OUT:
                if (outgoingBox) {
                    outgoingBox.style.display = 'block';
                    const actionEl = document.getElementById('outgoing-status-action');
                    const targetEl = document.getElementById('outgoing-target-name');
                    const subtext = document.getElementById('outgoing-status-subtext');
                    const btn = document.getElementById('btn-start-call');
                    const btnText = document.getElementById('btn-start-call-text');
                    const btnIcon = document.getElementById('btn-start-call-icon');

                    if (targetEl) targetEl.innerText = payload.target || '---';
                    if (btn) btn.disabled = true;
                    if (btnIcon) btnIcon.style.display = 'none';

                    if (payload.mode === 'ringing') {
                        if (actionEl) actionEl.innerText = 'Ringing';
                        if (subtext) subtext.innerText = `Waiting for ${payload.target} to answer...`;
                        if (btnText) btnText.innerText = 'Ringing...';
                        this.updateStatusBadge('Ringing', 'var(--cyan)');
                    } else {
                        if (actionEl) actionEl.innerText = 'Connecting to';
                        if (subtext) subtext.innerText = 'Initializing audio & network uplink...';
                        if (btnText) btnText.innerText = 'Connecting...';
                        this.updateStatusBadge('Connecting', 'var(--cyan)');
                    }
                }
                break;

            case CallState.INCOMING_CALL:
                if (incomingModal) {
                    incomingModal.style.display = 'flex';
                    const callerEl = document.getElementById('incoming-caller-id');
                    if (callerEl) callerEl.innerText = payload.caller || 'CALLER';
                }
                this.updateStatusBadge('Incoming', 'var(--cyan)');
                this.setTitleAlert(`🔔 Call from ${payload.caller}`);
                this.notifyIncomingCall(payload.caller);
                break;

            case CallState.CONNECTING:
                if (incomingModal) incomingModal.style.display = 'none';
                this.clearTitleAlert();
                this.updateStatusBadge('Connecting', 'var(--cyan)');
                break;

            case CallState.CONNECTED:
                if (setupEl) setupEl.style.display = 'none';
                if (lobbyEl) lobbyEl.style.display = 'none';
                if (stageEl) stageEl.style.display = 'block';
                if (outgoingBox) outgoingBox.style.display = 'none';
                if (incomingModal) incomingModal.style.display = 'none';
                this.resetCallButton();
                this.clearTitleAlert();
                this.updateStatusBadge('Active', 'var(--brand)');

                const remoteUser = document.getElementById('remote-user-tag');
                if (remoteUser && payload.peer) remoteUser.innerText = payload.peer;

                this.startCallTimer(payload.peer);
                this.acquireWakeLock();
                break;

            default:
                break;
        }
    }

    updateStatusBadge(text, color) {
        const statusText = document.getElementById('system-status-text');
        const statusDot = document.getElementById('system-status');
        if (statusText) statusText.innerText = text;
        if (statusDot) statusDot.style.background = color;
    }

    resetCallButton() {
        const btn = document.getElementById('btn-start-call');
        const btnText = document.getElementById('btn-start-call-text');
        const btnIcon = document.getElementById('btn-start-call-icon');
        if (btn) btn.disabled = false;
        if (btnText) btnText.innerText = 'Establish Connection';
        if (btnIcon) btnIcon.style.display = '';
    }

    startCallTimer(peerName = 'User') {
        this.stopCallTimer();
        const timerDisplay = document.getElementById('call-timer');
        if (timerDisplay) timerDisplay.innerText = '00:00';
        const startTime = Date.now();

        this.callTimerInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const totalSeconds = Math.floor(elapsed / 1000);
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
            const seconds = (totalSeconds % 60).toString().padStart(2, '0');

            const formatted = hours > 0 
                ? `${hours.toString().padStart(2, '0')}:${minutes}:${seconds}`
                : `${minutes}:${seconds}`;

            if (timerDisplay) timerDisplay.innerText = formatted;
            document.title = `🟢 [${formatted}] ${peerName} — Audiolink by MithamLabs`;
        }, 1000);
    }

    stopCallTimer() {
        if (this.callTimerInterval) {
            clearInterval(this.callTimerInterval);
            this.callTimerInterval = null;
        }
        const timerDisplay = document.getElementById('call-timer');
        if (timerDisplay) timerDisplay.innerText = '00:00';
        document.title = this.originalTitle;
    }

    setTitleAlert(alertText) {
        this.clearTitleAlert();
        let toggle = false;
        this.titleAlertInterval = setInterval(() => {
            document.title = toggle ? alertText : 'Audiolink by MithamLabs — P2P Voice';
            toggle = !toggle;
        }, 1000);
    }

    clearTitleAlert() {
        if (this.titleAlertInterval) {
            clearInterval(this.titleAlertInterval);
            this.titleAlertInterval = null;
        }
        document.title = this.originalTitle;
    }

    requestNotificationPerm() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission().catch(() => {});
        }
    }

    notifyIncomingCall(callerId) {
        if ('Notification' in window && Notification.permission === 'granted') {
            try {
                this.incomingNotification = new Notification('Incoming Voice Call', {
                    body: `${callerId} is calling you on Audiolink by MithamLabs.`,
                    tag: 'audiolink-incoming'
                });
                this.incomingNotification.onclick = () => {
                    window.focus();
                    if (this.incomingNotification) {
                        this.incomingNotification.close();
                        this.incomingNotification = null;
                    }
                };
            } catch (_) {}
        }
    }

    async acquireWakeLock() {
        if ('wakeLock' in navigator) {
            try {
                this.wakeLock = await navigator.wakeLock.request('screen');
                this.wakeLock.addEventListener('release', () => {
                    this.wakeLock = null;
                });
            } catch (_) {}
        }
    }

    releaseWakeLock() {
        if (this.wakeLock) {
            this.wakeLock.release().catch(() => {});
            this.wakeLock = null;
        }
    }

    showInfoBanner(msg, duration = 4000) {
        const banner = document.getElementById('global-info');
        if (!banner) return;
        banner.innerText = msg;
        banner.style.display = 'block';
        if (this.bannerTimeout) clearTimeout(this.bannerTimeout);
        this.bannerTimeout = setTimeout(() => {
            banner.style.display = 'none';
            this.bannerTimeout = null;
        }, duration);
    }

    showError(el, msg) {
        if (el) {
            el.innerText = msg;
            el.style.display = 'block';
        }
    }

    hideError(el) {
        if (el) {
            el.style.display = 'none';
        }
    }

    copyToClipboard(text, btnElement, successMsg) {
        if (!text || text === '---' || !navigator.clipboard) return;
        navigator.clipboard.writeText(text).then(() => {
            const originalContent = btnElement.innerHTML;
            btnElement.innerHTML = `<span>${successMsg}</span>`;
            btnElement.style.color = 'var(--brand)';
            btnElement.style.borderColor = 'var(--brand)';
            setTimeout(() => {
                btnElement.innerHTML = originalContent;
                btnElement.style.color = '';
                btnElement.style.borderColor = '';
            }, 2000);
        }).catch(() => {});
    }

    checkUrlInviteParams(onAutoCall) {
        const params = new URLSearchParams(window.location.search);
        const targetPeer = params.get('call') || params.get('join');
        if (targetPeer) {
            const cleanTarget = targetPeer.trim().toLowerCase();
            const peerInput = document.getElementById('peer-id');
            if (peerInput) peerInput.value = cleanTarget;

            const banner = document.getElementById('invite-banner');
            if (banner) {
                banner.textContent = 'Incoming invite to connect with ';
                const strong = document.createElement('strong');
                strong.textContent = cleanTarget;
                banner.appendChild(strong);
                banner.style.display = 'flex';
            }

            const savedUser = localStorage.getItem('audiolink_username');
            if (savedUser) {
                const btnInit = document.getElementById('btn-init-uplink');
                if (btnInit) {
                    btnInit.textContent = `Connect to ${cleanTarget} as "${savedUser}"`;
                }
            }

            try {
                window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
            } catch (_) {}

            if (onAutoCall) {
                onAutoCall(cleanTarget);
            }
        }
    }

    updateMuteUI(isMuted) {
        const btn = document.getElementById('btn-mute');
        if (!btn) return;
        if (isMuted) {
            btn.innerText = 'Mic: Muted';
            btn.classList.add('is-muted');
            btn.classList.remove('is-active');
        } else {
            btn.innerText = 'Mic: Live';
            btn.classList.remove('is-muted');
            btn.classList.add('is-active');
        }
    }

    updateNSUI(isOn) {
        const btn = document.getElementById('btn-ns');
        if (btn) {
            btn.innerText = `Noise Suppress: ${isOn ? 'On' : 'Off'}`;
            btn.className = isOn ? 'toggle-btn is-active' : 'toggle-btn';
        }
    }

    updateECUI(isOn) {
        const btn = document.getElementById('btn-ec');
        if (btn) {
            btn.innerText = `Echo Cancel: ${isOn ? 'On' : 'Off'}`;
            btn.className = isOn ? 'toggle-btn is-active' : 'toggle-btn';
        }
    }

    updateIPv6UI(isOn) {
        const btn = document.getElementById('btn-ipv6-toggle');
        if (btn) {
            btn.innerText = `IPv6 Only: ${isOn ? 'On' : 'Off'}`;
            btn.className = isOn ? 'toggle-btn is-active' : 'toggle-btn';
        }
    }
}
