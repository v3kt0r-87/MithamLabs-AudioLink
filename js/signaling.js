/**
 * Audiolink Signaling Client
 * Manages PeerJS connection, signaling heartbeat, and Call Control Protocol over DataChannels.
 */

import { CONFIG } from './config.js';

export class SignalingClient {
    constructor() {
        this.peer = null;
        this.activeControlConn = null;
        this.reconnectTimer = null;
        this._listeners = new Map();
    }

    get isConnected() {
        return !!(this.peer && !this.peer.disconnected && !this.peer.destroyed);
    }

    get id() {
        return this.peer ? this.peer.id : null;
    }

    initialize(username) {
        if (this.peer) {
            this.destroy();
        }

        const peerConfig = {
            config: {
                iceCandidatePoolSize: CONFIG.ICE_CANDIDATE_POOL_SIZE,
                iceServers: CONFIG.ICE_SERVERS
            }
        };

        this.peer = new window.Peer(username, peerConfig);

        this.peer.on('open', (id) => {
            this._emit('open', id);
        });

        this.peer.on('disconnected', () => {
            this._emit('disconnected');
            this._scheduleReconnect();
        });

        this.peer.on('connection', (conn) => {
            this._bindControlConnection(conn);
        });

        this.peer.on('call', (call) => {
            this._emit('incomingCall', call);
        });

        this.peer.on('error', (err) => {
            if (err.type === 'network') {
                this._scheduleReconnect();
            }
            this._emit('error', err);
        });
    }

    _scheduleReconnect() {
        if (this.reconnectTimer) return;
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            if (this.peer && !this.peer.destroyed && this.peer.disconnected) {
                this.peer.reconnect();
            }
        }, CONFIG.TIMINGS.RECONNECT_DEBOUNCE_MS);
    }

    _bindControlConnection(conn) {
        if (!conn) return;

        this.activeControlConn = conn;

        conn.on('data', (data) => {
            if (!data || typeof data !== 'object' || !data.type) return;
            this._emit('incomingControl', {
                fromPeer: conn.peer,
                data
            });
        });

        conn.on('close', () => {
            if (this.activeControlConn === conn) {
                this.activeControlConn = null;
            }
        });

        conn.on('error', () => {
            if (this.activeControlConn === conn) {
                this.activeControlConn = null;
            }
        });
    }

    sendControlSignal(target, payload) {
        if (!target || !this.peer || this.peer.destroyed) return;

        if (this.activeControlConn && this.activeControlConn.peer === target && this.activeControlConn.open) {
            try {
                this.activeControlConn.send(payload);
                return;
            } catch (_) {}
        }

        try {
            const conn = this.peer.connect(target, { reliable: true });
            const sendAndClose = () => {
                try { conn.send(payload); } catch (_) {}
                setTimeout(() => {
                    try { conn.close(); } catch (_) {}
                }, 1000);
            };

            if (typeof conn.once === 'function') {
                conn.once('open', sendAndClose);
            } else {
                conn.on('open', sendAndClose);
            }
        } catch (_) {}
    }

    callPeer(target, stream) {
        if (!this.peer) return null;
        return this.peer.call(target, stream);
    }

    destroy() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.activeControlConn) {
            try { this.activeControlConn.close(); } catch (_) {}
            this.activeControlConn = null;
        }
        if (this.peer) {
            try { this.peer.destroy(); } catch (_) {}
            this.peer = null;
        }
    }

    on(event, handler) {
        if (!this._listeners.has(event)) {
            this._listeners.set(event, new Set());
        }
        this._listeners.get(event).add(handler);
        return () => this.off(event, handler);
    }

    off(event, handler) {
        const set = this._listeners.get(event);
        if (set) set.delete(handler);
    }

    _emit(event, data) {
        const set = this._listeners.get(event);
        if (set) {
            for (const h of set) {
                try { h(data); } catch (e) {
                    console.error(`[Signaling] Error in event ${event}:`, e);
                }
            }
        }
    }
}
