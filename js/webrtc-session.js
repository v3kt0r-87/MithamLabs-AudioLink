/**
 * Audiolink WebRTC Session Orchestrator
 * Coordinates signaling, media streams, peer connection lifecycle, and FSM state.
 */

import { CONFIG } from './config.js';
import { CallState } from './fsm.js';
import { isIPv6Candidate } from './telemetry.js';

export class WebRTCSessionManager {
    constructor({ fsm, signaling, audio, telemetry }) {
        this.fsm = fsm;
        this.signaling = signaling;
        this.audio = audio;
        this.telemetry = telemetry;

        this.currentCall = null;
        this.incomingCallObj = null;
        this.activePeer = null;
        this.callStartTime = 0;
        this.forceIPv6 = false;

        this.callTimeoutTimer = null;
        this.iceDisconnectTimer = null;

        this._bindSignalingEvents();
        this._bindAudioEvents();
    }

    _bindSignalingEvents() {
        this.signaling.on('incomingCall', (call) => {
            this._handleIncomingCallOffer(call);
        });

        this.signaling.on('incomingControl', ({ fromPeer, data }) => {
            this._handleControlSignal(fromPeer, data);
        });
    }

    _bindAudioEvents() {
        this.audio.onMicRecovered = async (newStream, newTrack) => {
            if (this.currentCall && this.currentCall.peerConnection) {
                const senders = this.currentCall.peerConnection.getSenders();
                const audioSender = senders.find(s => s.track && s.track.kind === 'audio') || senders[0];
                if (audioSender) {
                    await audioSender.replaceTrack(newTrack);
                }
            }
        };

        this.audio.onMicFailed = () => {
            this.terminateCall('Microphone disconnected.');
        };
    }

    async initiateCall(targetUser) {
        if (!this.fsm.can(CallState.CALLING_OUT)) {
            return { success: false, reason: 'System busy.' };
        }

        const localId = this.signaling.id;
        if (!localId) {
            return { success: false, reason: 'Signaling uplink offline.' };
        }

        if (targetUser.toLowerCase() === localId.toLowerCase()) {
            return { success: false, reason: 'Cannot call yourself.' };
        }

        this.activePeer = targetUser;
        this.fsm.transition(CallState.CALLING_OUT, { target: targetUser, mode: 'connecting' });

        this._startCallTimeout(targetUser);

        try {
            const stream = await this.audio.acquireLocalStream();

            // If user aborted during mic prompt
            if (this.fsm.state !== CallState.CALLING_OUT || !this.activePeer) {
                this.audio.stopLocalStream(0);
                return { success: false, reason: 'Call aborted.' };
            }

            this.audio.startRing(false);
            this.fsm.transition(CallState.CALLING_OUT, { target: targetUser, mode: 'ringing' });

            const call = this.signaling.callPeer(targetUser, stream);
            if (!call) {
                this.terminateCall('Failed to place call.');
                return { success: false, reason: 'Signaling error.' };
            }

            this.currentCall = call;
            this._bindCallEvents(call, true);
            return { success: true };
        } catch (err) {
            this.cancelOutgoingCall(true);
            return { success: false, reason: 'Microphone permission denied.' };
        }
    }

    _handleIncomingCallOffer(call) {
        const caller = call.peer;

        // Resolve WebRTC Call Glare
        if (this.activePeer && this.activePeer.toLowerCase() === caller.toLowerCase()) {
            const isPolite = (this.signaling.id || '').localeCompare(caller) > 0;
            if (isPolite) {
                // Polite peer yields outgoing call and answers incoming immediately
                this.cancelOutgoingCall(true, true);
                if (this.audio.localStream) {
                    call.answer(this.audio.localStream);
                    this.currentCall = call;
                    this._bindCallEvents(call, false);
                    return;
                }
            } else {
                // Impolite peer discards incoming duplicate and waits for outgoing offer to finish
                try { call.close(); } catch (_) {}
                return;
            }
        }

        // Busy check
        if (this.fsm.state !== CallState.LOBBY) {
            this.signaling.sendControlSignal(caller, { type: 'busy' });
            try { call.close(); } catch (_) {}
            return;
        }

        this.incomingCallObj = call;
        this.activePeer = caller;
        this.audio.startRing(true);
        this.fsm.transition(CallState.INCOMING_CALL, { caller });

        call.on('close', () => {
            if (this.incomingCallObj === call) {
                this._handleCallerCancelled(caller);
            }
        });
    }

    async acceptIncomingCall() {
        this.audio.stopRing();
        if (this.audio && typeof this.audio.unlock === 'function') {
            this.audio.unlock();
        }

        if (!this.incomingCallObj) return false;
        const call = this.incomingCallObj;
        this.incomingCallObj = null;

        this.fsm.transition(CallState.CONNECTING, { peer: call.peer });

        try {
            const stream = await this.audio.acquireLocalStream();
            call.answer(stream);
            this.currentCall = call;
            this._bindCallEvents(call, false);
            return true;
        } catch (err) {
            this.signaling.sendControlSignal(call.peer, { type: 'decline' });
            try { call.close(); } catch (_) {}
            this.terminateCall('Microphone permission denied.');
            return false;
        }
    }

    declineIncomingCall() {
        this.audio.stopRing();
        if (this.incomingCallObj) {
            const caller = this.incomingCallObj.peer;
            this.signaling.sendControlSignal(caller, { type: 'decline' });
            try { this.incomingCallObj.close(); } catch (_) {}
            this.incomingCallObj = null;
        }
        this.terminateCall('Call declined.', false);
    }

    cancelOutgoingCall(skipSignal = false, preserveMedia = false) {
        this._clearCallTimeout();
        this.audio.stopRing();

        const target = this.activePeer;
        if (!skipSignal && target) {
            this.signaling.sendControlSignal(target, { type: 'cancel' });
        }

        if (this.currentCall) {
            try { this.currentCall.close(); } catch (_) {}
            this.currentCall = null;
        }

        if (!preserveMedia) {
            this.audio.stopLocalStream(0);
        }

        this.activePeer = null;
        this.fsm.forceState(CallState.LOBBY);
    }

    _bindCallEvents(call, isOutgoing) {
        const pc = call.peerConnection;
        if (pc) {
            this._applyCandidateFilter(pc);

            pc.oniceconnectionstatechange = () => {
                const iceState = pc.iceConnectionState;
                if (iceState === 'disconnected') {
                    if (!this.iceDisconnectTimer) {
                        this.iceDisconnectTimer = setTimeout(() => {
                            this.terminateCall('Connection timed out (network lost).');
                        }, CONFIG.TIMINGS.ICE_DISCONNECT_TIMEOUT_MS);
                    }
                } else if (iceState === 'connected' || iceState === 'completed') {
                    this._clearIceDisconnectTimer();
                } else if (iceState === 'failed' || iceState === 'closed') {
                    this._clearIceDisconnectTimer();
                    this.terminateCall(iceState === 'failed' ? 'Connection failed (NAT / Firewall).' : 'Call ended.');
                }
            };

            pc.onconnectionstatechange = () => {
                if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
                    this.terminateCall('Call ended.');
                }
            };
        }

        call.on('stream', (remoteStream) => {
            this._clearCallTimeout();
            this.audio.stopRing();

            this.callStartTime = Date.now();
            this.fsm.transition(CallState.CONNECTED, { peer: call.peer });

            const remoteAudio = document.getElementById('remote-audio');
            if (remoteAudio) {
                remoteAudio.srcObject = remoteStream;
                remoteAudio.muted = false;
                remoteAudio.play().catch(() => {});
            }

            remoteStream.getTracks().forEach(track => {
                track.onended = () => this.terminateCall('Call ended.');
            });

            this.audio.playConnectChime();

            this.audio.setupMeter(
                this.audio.localStream,
                remoteStream,
                (meterData) => this._onMeterUpdate(meterData)
            );

            if (pc) {
                this.telemetry.start(pc, (metrics) => this._onTelemetryUpdate(metrics));
            }
        });

        call.on('close', () => {
            this.terminateCall('Call ended.');
        });

        call.on('error', () => {
            this.terminateCall('Call connection error.');
        });
    }

    _applyCandidateFilter(pc) {
        if (!this.forceIPv6 || !pc) return;

        // Clean candidate filtering during ICE gathering without munging SDP descriptions
        const origAddIceCandidate = pc.addIceCandidate;
        pc.addIceCandidate = function(candidate, ...args) {
            if (candidate && candidate.candidate && !isIPv6Candidate(candidate.candidate)) {
                return Promise.resolve(); // Drop IPv4 candidate safely
            }
            return origAddIceCandidate.apply(this, [candidate, ...args]);
        };
    }

    _handleControlSignal(fromPeer, data) {
        if (data.type === 'decline' || data.type === 'busy') {
            if (this.activePeer && fromPeer.toLowerCase() === this.activePeer.toLowerCase()) {
                this.cancelOutgoingCall(true);
                this.audio.playFailedTone();
                const msg = data.type === 'decline' ? `Call declined by ${fromPeer}.` : `${fromPeer} is busy.`;
                this.fsm.forceState(CallState.LOBBY, { bannerMsg: msg, bannerType: 'danger' });
            }
        } else if (data.type === 'cancel') {
            if (this.incomingCallObj && this.incomingCallObj.peer.toLowerCase() === fromPeer.toLowerCase()) {
                this._handleCallerCancelled(fromPeer);
            }
        } else if (data.type === 'end') {
            if (this.activePeer && fromPeer.toLowerCase() === this.activePeer.toLowerCase()) {
                this.terminateCall('Call ended by peer.', false);
            }
        }
    }

    _handleCallerCancelled(fromPeer) {
        this.audio.stopRing();
        if (this.incomingCallObj) {
            try { this.incomingCallObj.close(); } catch (_) {}
            this.incomingCallObj = null;
        }
        this.activePeer = null;
        this.audio.playFailedTone();
        this.fsm.forceState(CallState.LOBBY, {
            bannerMsg: `${fromPeer} cancelled the call.`,
            bannerType: 'info'
        });
    }

    terminateCall(reason = 'Call ended.', sendSignal = true) {
        if (this.fsm.state === CallState.LOBBY || this.fsm.state === CallState.STANDBY) {
            return;
        }

        this._clearCallTimeout();
        this._clearIceDisconnectTimer();

        if (sendSignal && this.activePeer) {
            this.signaling.sendControlSignal(this.activePeer, { type: 'end' });
        }

        if (this.currentCall) {
            try { this.currentCall.close(); } catch (_) {}
            this.currentCall = null;
        }

        if (this.incomingCallObj) {
            try { this.incomingCallObj.close(); } catch (_) {}
            this.incomingCallObj = null;
        }

        const remoteAudio = document.getElementById('remote-audio');
        if (remoteAudio) {
            remoteAudio.pause();
            remoteAudio.srcObject = null;
        }

        this.telemetry.stop();
        this.audio.stopMeter();
        this.audio.stopRing();

        if (this.callStartTime > 0) {
            this.audio.playDisconnectTone();
        } else {
            this.audio.playFailedTone();
        }

        this.audio.stopLocalStream();
        this.activePeer = null;
        this.callStartTime = 0;

        const safetyWordsEl = document.getElementById('safety-words');
        const safetyBadgeEl = document.getElementById('safety-words-card');
        if (safetyWordsEl) safetyWordsEl.innerText = 'Verifying...';
        if (safetyBadgeEl) safetyBadgeEl.classList.remove('is-verified');

        this.fsm.forceState(CallState.LOBBY, { bannerMsg: reason, bannerType: 'info' });
    }

    _startCallTimeout(targetUser) {
        this._clearCallTimeout();
        this.callTimeoutTimer = setTimeout(() => {
            if (this.fsm.state === CallState.CALLING_OUT) {
                this.cancelOutgoingCall(true);
                this.audio.playFailedTone();
                this.fsm.forceState(CallState.LOBBY, {
                    bannerMsg: `No answer from ${targetUser}.`,
                    bannerType: 'danger'
                });
            }
        }, CONFIG.TIMINGS.CALL_TIMEOUT_MS);
    }

    _clearCallTimeout() {
        if (this.callTimeoutTimer) {
            clearTimeout(this.callTimeoutTimer);
            this.callTimeoutTimer = null;
        }
    }

    _clearIceDisconnectTimer() {
        if (this.iceDisconnectTimer) {
            clearTimeout(this.iceDisconnectTimer);
            this.iceDisconnectTimer = null;
        }
    }

    setForceIPv6(enabled) {
        this.forceIPv6 = enabled;
    }

    _onMeterUpdate(data) {
        const meterFill = document.getElementById('meter-fill');
        const dbLabel = document.getElementById('mic-db-level');
        const peerCard = document.getElementById('peer-card');

        if (meterFill) {
            if (data.isMuted) {
                meterFill.classList.add('is-muted');
                meterFill.style.width = '100%';
            } else {
                meterFill.classList.remove('is-muted');
                meterFill.style.width = `${data.localPct}%`;
            }
        }

        if (dbLabel) {
            dbLabel.innerText = data.localDb;
        }

        if (peerCard) {
            if (data.isSpeaking) {
                peerCard.classList.add('is-speaking');
            } else {
                peerCard.classList.remove('is-speaking');
            }
        }
    }

    _onTelemetryUpdate(metrics) {
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.innerText = val;
        };
        setVal('lat-avg', metrics.latency);
        setVal('jitter', metrics.jitter);
        setVal('loss', metrics.loss);
        setVal('network-type', metrics.networkRoute);
        setVal('local-ip', metrics.localIP);
        setVal('remote-ip', metrics.remoteIP);

        const safetyWordsEl = document.getElementById('safety-words');
        const safetyBadgeEl = document.getElementById('safety-words-card');
        if (safetyWordsEl && metrics.safetyWords) {
            safetyWordsEl.innerText = metrics.safetyWords;
            if (safetyBadgeEl) safetyBadgeEl.classList.add('is-verified');
        }
    }
}
