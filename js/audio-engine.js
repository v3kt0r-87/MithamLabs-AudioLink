/**
 * Audiolink Audio Engine
 * Encapsulates Web Audio API, synthesizer fallbacks, hardware AEC, and voice metering.
 */

import { CONFIG } from './config.js';

export class AudioEngine {
    constructor() {
        this.ctx = null;
        this.soundBuffers = {};
        this.ringSource = null;
        this.ringInterval = null;
        this.meterInterval = null;

        this.localStream = null;
        this.localSource = null;
        this.remoteSource = null;
        this.localAnalyser = null;
        this.remoteAnalyser = null;
        this.localAudioData = null;
        this.remoteAudioData = null;

        this.isMuted = false;
        this.isNsOn = true;
        this.isEcOn = true;
        this.onMicRecovered = null;
        this.onMicFailed = null;
    }

    getAudioContext() {
        if (!this.ctx && (typeof window !== 'undefined')) {
            const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
            if (AudioCtxClass) {
                this.ctx = new AudioCtxClass();
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }
        return this.ctx;
    }

    async unlock() {
        try {
            const ctx = this.getAudioContext();
            if (ctx && ctx.state === 'suspended') {
                await ctx.resume();
            }
            this.preloadBuffers();
            this._unlockMediaElements();
        } catch (_) {}
    }

    _unlockMediaElements() {
        const audioIds = ['ring-audio', 'dial-audio', 'connected-audio', 'ended-audio', 'failed-audio'];
        audioIds.forEach(id => {
            const el = document.getElementById(id);
            if (el && !el.dataset.unlocked) {
                const origVolume = el.volume;
                el.volume = 0.001;
                const p = el.play();
                if (p !== undefined) {
                    p.then(() => {
                        el.dataset.unlocked = 'true';
                        if (!el.dataset.playing) {
                            el.pause();
                            el.currentTime = 0;
                        }
                        el.volume = origVolume || 1.0;
                    }).catch(() => {
                        delete el.dataset.unlocked;
                        el.volume = origVolume || 1.0;
                    });
                }
            }
        });
    }

    async preloadBuffers() {
        const ctx = this.getAudioContext();
        if (!ctx) return;

        for (const [key, path] of Object.entries(CONFIG.SOUND_FILES)) {
            if (this.soundBuffers[key]) continue;
            fetch(path)
                .then(res => res.arrayBuffer())
                .then(ab => ctx.decodeAudioData(ab))
                .then(decoded => { this.soundBuffers[key] = decoded; })
                .catch(() => {});
        }
    }

    playSound(name, fallbackElId, synthFallback) {
        const ctx = this.getAudioContext();
        if (ctx && ctx.state === 'suspended') {
            ctx.resume().catch(() => {});
        }

        if (ctx && ctx.state === 'running' && this.soundBuffers[name]) {
            try {
                const src = ctx.createBufferSource();
                src.buffer = this.soundBuffers[name];
                src.connect(ctx.destination);
                src.start(0);
                return;
            } catch (_) {}
        }

        const el = fallbackElId ? document.getElementById(fallbackElId) : null;
        if (el) {
            el.volume = 1.0;
            el.currentTime = 0;
            const p = el.play();
            if (p !== undefined) {
                p.catch(() => {
                    if (synthFallback) synthFallback();
                });
                return;
            }
        }

        if (synthFallback) synthFallback();
    }

    startRing(isIncoming = true) {
        this.stopRing();
        const key = isIncoming ? 'ring' : 'dial';
        const elId = isIncoming ? 'ring-audio' : 'dial-audio';
        const el = document.getElementById(elId);

        if (isIncoming && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            try { navigator.vibrate([300, 200, 300, 200, 500]); } catch (_) {}
        }

        const ctx = this.getAudioContext();
        if (ctx && ctx.state === 'suspended') {
            ctx.resume().catch(() => {});
        }

        // 1. If Web Audio Context is running and buffer is ready, use high-precision Web Audio buffer
        if (ctx && ctx.state === 'running' && this.soundBuffers[key]) {
            try {
                const src = ctx.createBufferSource();
                src.buffer = this.soundBuffers[key];
                src.loop = true;
                src.connect(ctx.destination);
                src.start(0);
                this.ringSource = src;
                return;
            } catch (_) {}
        }

        // 2. Fallback to native HTML5 <audio> element (works on mobile when AudioContext is suspended)
        if (el) {
            el.dataset.playing = 'true';
            el.volume = 1.0;
            el.muted = false;
            el.currentTime = 0;
            const p = el.play();
            if (p !== undefined) {
                p.catch(() => {
                    delete el.dataset.playing;
                    this.playSynthRing(isIncoming);
                });
                return;
            }
        }

        // 3. Fallback to synthesized Web Audio oscillator tone
        this.playSynthRing(isIncoming);
    }

    stopRing() {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            try { navigator.vibrate(0); } catch (_) {}
        }

        if (this.ringSource) {
            try {
                this.ringSource.stop();
                this.ringSource.disconnect();
            } catch (_) {}
            this.ringSource = null;
        }

        ['ring-audio', 'dial-audio'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                delete el.dataset.playing;
                el.pause();
                el.currentTime = 0;
            }
        });

        if (this.ringInterval) {
            clearInterval(this.ringInterval);
            this.ringInterval = null;
        }
    }

    playSynthRing(isIncoming = true) {
        if (this.ringInterval) {
            clearInterval(this.ringInterval);
            this.ringInterval = null;
        }
        const cfg = isIncoming ? CONFIG.SYNTH_AUDIO.INCOMING_RING : CONFIG.SYNTH_AUDIO.OUTGOING_DIAL;
        const playTone = () => {
            const ctx = this.getAudioContext();
            if (!ctx) return;
            if (ctx.state === 'suspended') {
                ctx.resume().catch(() => {});
            }
            try {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                const now = ctx.currentTime;

                osc.frequency.setValueAtTime(cfg.low, now);
                osc.frequency.setValueAtTime(cfg.high, now + 0.14);

                gain.gain.setValueAtTime(0.08, now);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now);
                osc.stop(now + 0.35);
            } catch (_) {}
        };

        playTone();
        this.ringInterval = setInterval(playTone, cfg.interval);
    }

    playConnectChime() {
        this.playSound('connected', 'connected-audio', () => this.playSynthConnectChime());
    }

    playSynthConnectChime() {
        const ctx = this.getAudioContext();
        if (!ctx) return;
        try {
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(CONFIG.SYNTH_AUDIO.CONNECT_CHIME.startFreq, now);
            osc.frequency.exponentialRampToValueAtTime(CONFIG.SYNTH_AUDIO.CONNECT_CHIME.endFreq, now + 0.16);
            gain.gain.setValueAtTime(0.09, now);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.28);
        } catch (_) {}
    }

    playDisconnectTone() {
        this.playSound('ended', 'ended-audio', () => this.playSynthDisconnectTone());
    }

    playFailedTone() {
        this.playSound('failed', 'failed-audio', () => this.playSynthDisconnectTone());
    }

    playSynthDisconnectTone() {
        const ctx = this.getAudioContext();
        if (!ctx) return;
        try {
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(CONFIG.SYNTH_AUDIO.DISCONNECT_TONE.startFreq, now);
            osc.frequency.exponentialRampToValueAtTime(CONFIG.SYNTH_AUDIO.DISCONNECT_TONE.endFreq, now + 0.2);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.24);
        } catch (_) {}
    }

    playMuteBeep(muted) {
        const ctx = this.getAudioContext();
        if (!ctx) return;
        try {
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const freq = muted ? CONFIG.SYNTH_AUDIO.MUTE_BEEP.mutedFreq : CONFIG.SYNTH_AUDIO.MUTE_BEEP.unmutedFreq;
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now);
            gain.gain.setValueAtTime(0.06, now);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.08);
        } catch (_) {}
    }

    async acquireLocalStream() {
        const constraints = {
            audio: {
                echoCancellation: this.isEcOn,
                noiseSuppression: this.isNsOn,
                autoGainControl: true,
                channelCount: 1
            }
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        this.localStream = stream;
        this._bindTrackEnded(stream);
        return stream;
    }

    _bindTrackEnded(stream) {
        if (!stream) return;
        stream.getAudioTracks().forEach(track => {
            track.onended = async () => {
                try {
                    const fallback = await navigator.mediaDevices.getUserMedia(CONFIG.AUDIO_CONSTRAINTS);
                    const newTrack = fallback.getAudioTracks()[0];
                    if (newTrack) {
                        newTrack.enabled = !this.isMuted;
                        this.localStream = fallback;
                        this._bindTrackEnded(fallback);
                        if (this.onMicRecovered) this.onMicRecovered(fallback, newTrack);
                        return;
                    }
                } catch (_) {}
                if (this.onMicFailed) this.onMicFailed();
            };
        });
    }

    setMute(muted) {
        this.isMuted = muted;
        if (this.localStream) {
            this.localStream.getAudioTracks().forEach(track => {
                track.enabled = !muted;
            });
        }
        this.playMuteBeep(muted);
    }

    async setNoiseSuppression(enabled) {
        this.isNsOn = enabled;
        return this.applyConstraints();
    }

    async setEchoCancellation(enabled) {
        this.isEcOn = enabled;
        return this.applyConstraints();
    }

    async applyConstraints() {
        if (this.localStream) {
            const track = this.localStream.getAudioTracks()[0];
            if (track && typeof track.applyConstraints === 'function') {
                try {
                    await track.applyConstraints({
                        echoCancellation: this.isEcOn,
                        noiseSuppression: this.isNsOn
                    });
                    return true;
                } catch (err) {
                    console.warn('[AudioEngine] applyConstraints failed:', err);
                    return false;
                }
            }
        }
        return true;
    }

    setupMeter(localStream, remoteStream, onUpdate) {
        const ctx = this.getAudioContext();
        if (!ctx) return;

        try {
            if (this.localSource) this.localSource.disconnect();
            if (localStream) {
                this.localSource = ctx.createMediaStreamSource(localStream);
                this.localAnalyser = ctx.createAnalyser();
                this.localAnalyser.fftSize = 64;
                this.localAudioData = new Uint8Array(this.localAnalyser.frequencyBinCount);
                this.localSource.connect(this.localAnalyser);
            }

            if (this.remoteSource) this.remoteSource.disconnect();
            if (remoteStream) {
                this.remoteSource = ctx.createMediaStreamSource(remoteStream);
                this.remoteAnalyser = ctx.createAnalyser();
                this.remoteAnalyser.fftSize = 64;
                this.remoteAudioData = new Uint8Array(this.remoteAnalyser.frequencyBinCount);
                this.remoteSource.connect(this.remoteAnalyser);
            }

            if (this.meterInterval) clearInterval(this.meterInterval);

            this.meterInterval = setInterval(() => {
                if (typeof document !== 'undefined' && document.hidden) return;

                let localPct = 0;
                let localDb = '-∞ dB';
                let isSpeaking = false;

                if (this.localAnalyser && this.localAudioData) {
                    this.localAnalyser.getByteFrequencyData(this.localAudioData);
                    let sum = 0;
                    for (let i = 0; i < this.localAudioData.length; i++) sum += this.localAudioData[i];
                    const avg = sum / this.localAudioData.length;

                    if (this.isMuted) {
                        localPct = 100;
                        localDb = '-∞ dB';
                    } else {
                        localPct = Math.min(100, Math.round((avg / 128) * 100));
                        const db = (20 * Math.log10((avg || 1) / 255)).toFixed(1);
                        localDb = `${db} dB`;
                    }
                }

                if (this.remoteAnalyser && this.remoteAudioData) {
                    this.remoteAnalyser.getByteFrequencyData(this.remoteAudioData);
                    let rSum = 0;
                    for (let i = 0; i < this.remoteAudioData.length; i++) rSum += this.remoteAudioData[i];
                    const rAvg = rSum / this.remoteAudioData.length;
                    isSpeaking = rAvg > 14;
                }

                if (onUpdate) {
                    onUpdate({ localPct, localDb, isSpeaking, isMuted: this.isMuted });
                }
            }, CONFIG.TIMINGS.METER_INTERVAL_MS);
        } catch (err) {
            console.warn('[AudioEngine] Meter setup failed:', err);
        }
    }

    stopMeter() {
        if (this.meterInterval) {
            clearInterval(this.meterInterval);
            this.meterInterval = null;
        }
        try { if (this.localSource) { this.localSource.disconnect(); this.localSource = null; } } catch (_) {}
        try { if (this.remoteSource) { this.remoteSource.disconnect(); this.remoteSource = null; } } catch (_) {}
        this.localAnalyser = null;
        this.remoteAnalyser = null;
    }

    applyVolume(value, remoteAudioEl) {
        const numeric = Math.max(0, Math.min(100, Number(value)));
        const fraction = numeric / 100;
        if (remoteAudioEl) {
            try {
                remoteAudioEl.volume = fraction;
            } catch (_) {}
        }
        return Math.round(numeric);
    }

    stopLocalStream(gracePeriodMs = CONFIG.TIMINGS.DISCONNECT_GRACE_MS) {
        if (this.localStream) {
            const stream = this.localStream;
            this.localStream = null;
            setTimeout(() => {
                stream.getTracks().forEach(t => t.stop());
            }, gracePeriodMs);
        }
    }

    reset() {
        this.stopRing();
        this.stopMeter();
        this.stopLocalStream();
        this.isMuted = false;
        this.isNsOn = true;
        this.isEcOn = true;
    }
}
