/**
 * Audiolink Configuration & Constants
 */

export const CONFIG = {
    ICE_SERVERS: [
        { urls: 'stun:stun.cloudflare.com:3478' },
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' },
        { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
        { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
        { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' }
    ],

    ICE_CANDIDATE_POOL_SIZE: 2,

    AUDIO_CONSTRAINTS: {
        audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1
        }
    },

    SOUND_FILES: {
        ring: 'audio/ring.opus',
        dial: 'audio/dial.opus',
        connected: 'audio/connected.opus',
        ended: 'audio/ended.opus',
        failed: 'audio/failed.opus'
    },

    TIMINGS: {
        CALL_TIMEOUT_MS: 40000,
        ICE_DISCONNECT_TIMEOUT_MS: 6000,
        STATS_INTERVAL_MS: 2500,
        METER_INTERVAL_MS: 66, // ~15 FPS
        RECONNECT_DEBOUNCE_MS: 2000,
        BANNER_DURATION_MS: 4000,
        DISCONNECT_GRACE_MS: 400
    },

    SYNTH_AUDIO: {
        INCOMING_RING: { high: 659.25, low: 523.25, interval: 1800 },
        OUTGOING_DIAL: { high: 480, low: 440, interval: 2500 },
        CONNECT_CHIME: { startFreq: 440, endFreq: 880 },
        DISCONNECT_TONE: { startFreq: 440, endFreq: 220 },
        MUTE_BEEP: { mutedFreq: 320, unmutedFreq: 640 }
    },

    USERNAME_REGEX: /^[a-zA-Z0-9_-]{3,24}$/
};
