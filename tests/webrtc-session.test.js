import test from 'node:test';
import assert from 'node:assert/strict';
import { CallState, CallStateMachine } from '../js/fsm.js';
import { WebRTCSessionManager } from '../js/webrtc-session.js';

class MockSignaling {
    constructor(id = 'alice') {
        this.id = id;
        this.isConnected = true;
        this.listeners = new Map();
        this.sentControlSignals = [];
    }
    on(event, handler) {
        if (!this.listeners.has(event)) this.listeners.set(event, []);
        this.listeners.get(event).push(handler);
    }
    emit(event, data) {
        const handlers = this.listeners.get(event) || [];
        handlers.forEach(h => h(data));
    }
    sendControlSignal(target, payload) {
        this.sentControlSignals.push({ target, payload });
    }
    callPeer(target, stream) {
        return new MockMediaConnection(target);
    }
}

class MockMediaConnection {
    constructor(peer) {
        this.peer = peer;
        this.peerConnection = new MockRTCPeerConnection();
        this.handlers = new Map();
        this.closed = false;
    }
    on(event, handler) {
        if (!this.handlers.has(event)) this.handlers.set(event, []);
        this.handlers.get(event).push(handler);
    }
    emit(event, data) {
        const list = this.handlers.get(event) || [];
        list.forEach(h => h(data));
    }
    answer(stream) {
        this.answeredStream = stream;
    }
    close() {
        this.closed = true;
        this.emit('close');
    }
}

class MockRTCPeerConnection {
    constructor() {
        this.addedCandidates = [];
        this.iceConnectionState = 'new';
        this.connectionState = 'new';
    }
    addIceCandidate(cand) {
        this.addedCandidates.push(cand);
        return Promise.resolve();
    }
    getSenders() {
        return [];
    }
}

class MockAudioEngine {
    constructor() {
        this.localStream = {
            getTracks: () => [{ stop: () => {}, enabled: true }]
        };
        this.ringState = null;
        this.playedSounds = [];
    }
    startRing(isIncoming) { this.ringState = isIncoming ? 'incoming' : 'outgoing'; }
    stopRing() { this.ringState = null; }
    playConnectChime() { this.playedSounds.push('connect'); }
    playDisconnectTone() { this.playedSounds.push('disconnect'); }
    playFailedTone() { this.playedSounds.push('failed'); }
    setupMeter() {}
    stopMeter() {}
    stopLocalStream() {}
    acquireLocalStream() { return Promise.resolve(this.localStream); }
}

class MockTelemetry {
    start() {}
    stop() {}
}

test('IPv6 candidate filtering safely drops IPv4 candidates when forceIPv6 is active', async () => {
    const fsm = new CallStateMachine();
    const signaling = new MockSignaling('user1');
    const audio = new MockAudioEngine();
    const telemetry = new MockTelemetry();

    const session = new WebRTCSessionManager({ fsm, signaling, audio, telemetry });
    session.setForceIPv6(true);

    const mockPc = new MockRTCPeerConnection();
    session._applyCandidateFilter(mockPc);

    // Add IPv4 candidate -> should be filtered out
    await mockPc.addIceCandidate({ candidate: 'candidate:1 1 UDP 2122260223 192.168.1.5 50000 typ host' });
    assert.equal(mockPc.addedCandidates.length, 0, 'IPv4 candidate should be dropped in IPv6-only mode');

    // Add IPv6 candidate -> should be passed through
    await mockPc.addIceCandidate({ candidate: 'candidate:2 1 UDP 2122260223 2001:db8::1 50000 typ host' });
    assert.equal(mockPc.addedCandidates.length, 1, 'IPv6 candidate should be added');
});

test('Call Glare: Polite peer yields and answers incoming call', async () => {
    const fsm = new CallStateMachine();
    // 'zara' is lexicographically greater than 'bob' -> 'zara' is polite peer
    const signaling = new MockSignaling('zara');
    const audio = new MockAudioEngine();
    const telemetry = new MockTelemetry();

    const session = new WebRTCSessionManager({ fsm, signaling, audio, telemetry });
    fsm.forceState(CallState.LOBBY);

    // Zara calls bob
    await session.initiateCall('bob');
    assert.equal(fsm.state, CallState.CALLING_OUT);

    // Simultaneous incoming call from bob arrives (Glare condition)
    const incomingCallFromBob = new MockMediaConnection('bob');
    session._handleIncomingCallOffer(incomingCallFromBob);

    // Polite peer should answer bob's call
    assert.equal(incomingCallFromBob.answeredStream, audio.localStream);
    assert.equal(session.currentCall, incomingCallFromBob);
});

test('Call Control Protocol: declines and cancellations update session cleanly', async () => {
    const fsm = new CallStateMachine();
    const signaling = new MockSignaling('alice');
    const audio = new MockAudioEngine();
    const telemetry = new MockTelemetry();

    const session = new WebRTCSessionManager({ fsm, signaling, audio, telemetry });
    fsm.forceState(CallState.LOBBY);

    await session.initiateCall('bob');
    assert.equal(fsm.state, CallState.CALLING_OUT);

    // Bob sends decline control signal
    signaling.emit('incomingControl', {
        fromPeer: 'bob',
        data: { type: 'decline' }
    });

    // Alice session should cancel outgoing call and return to lobby
    assert.equal(fsm.state, CallState.LOBBY);
    assert.equal(session.activePeer, null);
    assert.ok(audio.playedSounds.includes('failed'));
});
