/**
 * Audiolink Call Finite State Machine (FSM)
 * Ensures deterministic call state transitions and prevents race conditions.
 */

export const CallState = Object.freeze({
    STANDBY: 'STANDBY',             // Before username uplink is initialized
    INITIALIZING: 'INITIALIZING',   // Connecting to PeerJS signaling uplink
    LOBBY: 'LOBBY',                 // Idle in lobby, online and ready
    CALLING_OUT: 'CALLING_OUT',     // Outgoing call placed, waiting for answer
    INCOMING_CALL: 'INCOMING_CALL', // Incoming call alert ringing
    CONNECTING: 'CONNECTING',       // Call accepted, ICE & stream establishing
    CONNECTED: 'CONNECTED',         // Media streaming active, in voice room
    TERMINATING: 'TERMINATING'      // Tearing down session & returning to lobby
});

const VALID_TRANSITIONS = {
    [CallState.STANDBY]: [CallState.INITIALIZING],
    [CallState.INITIALIZING]: [CallState.LOBBY, CallState.STANDBY],
    [CallState.LOBBY]: [
        CallState.CALLING_OUT,
        CallState.INCOMING_CALL,
        CallState.STANDBY,
        CallState.INITIALIZING
    ],
    [CallState.CALLING_OUT]: [
        CallState.CONNECTING,
        CallState.CONNECTED,
        CallState.TERMINATING,
        CallState.LOBBY
    ],
    [CallState.INCOMING_CALL]: [
        CallState.CONNECTING,
        CallState.CONNECTED,
        CallState.TERMINATING,
        CallState.LOBBY
    ],
    [CallState.CONNECTING]: [
        CallState.CONNECTED,
        CallState.TERMINATING,
        CallState.LOBBY
    ],
    [CallState.CONNECTED]: [
        CallState.TERMINATING,
        CallState.LOBBY
    ],
    [CallState.TERMINATING]: [
        CallState.LOBBY,
        CallState.STANDBY
    ]
};

export class CallStateMachine {
    constructor(initialState = CallState.STANDBY) {
        this._state = initialState;
        this._listeners = new Map();
    }

    get state() {
        return this._state;
    }

    can(nextState) {
        const allowed = VALID_TRANSITIONS[this._state];
        return Array.isArray(allowed) && allowed.includes(nextState);
    }

    transition(nextState, payload = {}) {
        if (this._state === nextState) {
            return false;
        }

        if (!this.can(nextState)) {
            console.warn(`[FSM] Invalid state transition rejected: ${this._state} -> ${nextState}`);
            return false;
        }

        const prevState = this._state;
        this._state = nextState;

        this._emit('change', {
            current: nextState,
            previous: prevState,
            payload
        });

        this._emit(`enter:${nextState}`, { previous: prevState, payload });
        return true;
    }

    on(event, listener) {
        if (!this._listeners.has(event)) {
            this._listeners.set(event, new Set());
        }
        this._listeners.get(event).add(listener);
        return () => this.off(event, listener);
    }

    off(event, listener) {
        const set = this._listeners.get(event);
        if (set) {
            set.delete(listener);
        }
    }

    _emit(event, data) {
        const set = this._listeners.get(event);
        if (set) {
            for (const listener of set) {
                try {
                    listener(data);
                } catch (err) {
                    console.error(`[FSM] Listener error for ${event}:`, err);
                }
            }
        }
    }

    forceState(forcedState, payload = {}) {
        const prevState = this._state;
        this._state = forcedState;
        this._emit('change', { current: forcedState, previous: prevState, payload });
    }
}
