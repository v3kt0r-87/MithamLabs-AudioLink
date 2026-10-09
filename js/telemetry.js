import { CONFIG } from './config.js';
import {
    extractFingerprintsFromStats,
    extractFingerprintsFromSdp,
    computeSafetyWords
} from './crypto-verify.js';

export function maskIP(ip) {
    if (!ip || ip === '---' || ip === '[Masked]') return ip;
    if (ip.endsWith('.local')) return 'LAN (mDNS)';
    if (ip.includes('.')) {
        const parts = ip.split('.');
        if (parts.length === 4) return `${parts[0]}.${parts[1]}.*.*`;
    }
    if (ip.includes(':')) {
        const parts = ip.split(':');
        return parts.slice(0, 2).join(':') + ':****';
    }
    return ip;
}

export function isIPv6Candidate(candidateStr) {
    if (!candidateStr || typeof candidateStr !== 'string') return false;
    const parts = candidateStr.trim().split(/\s+/);
    return parts.length > 4 && parts[4].includes(':');
}

export function classifyNetworkRoute(candidateType, address) {
    if (!candidateType && !address) return '---';
    if (candidateType === 'relay') return 'Relay (TURN)';
    if (address && address.endsWith('.local')) return 'LAN (mDNS)';
    if (address && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|f[cd])/.test(address)) {
        return 'LAN / Private';
    }
    if (address && address.includes(':')) return 'IPv6 Direct';
    return candidateType === 'srflx' ? 'P2P (STUN)' : 'P2P Direct';
}

export class TelemetryMonitor {
    constructor() {
        this.interval = null;
        this.latencyHistory = [];
    }

    recordLatency(rtt) {
        if (isNaN(rtt) || rtt <= 0) return null;
        this.latencyHistory.push(rtt);
        if (this.latencyHistory.length > 30) {
            this.latencyHistory.shift();
        }
        return Math.round(
            this.latencyHistory.reduce((a, b) => a + b, 0) / this.latencyHistory.length
        );
    }

    start(pc, onUpdate) {
        this.stop();
        this.latencyHistory = [];
        if (!pc || typeof pc.getStats !== 'function') return;

        const pollStats = async () => {
            try {
                const stats = await pc.getStats();
                const metrics = await this.extractMetrics(stats, pc);
                if (onUpdate) onUpdate(metrics);
            } catch (_) {}
        };

        // First read with slight delay to allow ICE candidate resolution
        setTimeout(pollStats, 1200);
        this.interval = setInterval(pollStats, CONFIG.TIMINGS.STATS_INTERVAL_MS);
    }

    async extractMetrics(stats, pc = null) {
        let rttAvg = null;
        let jitter = '--';
        let loss = 0;
        let hasRtt = false;

        stats.forEach(r => {
            if (r.type === 'remote-inbound-rtp') {
                const rtt = Math.round(r.roundTripTime * 1000);
                if (!isNaN(rtt) && rtt > 0) {
                    hasRtt = true;
                    rttAvg = this.recordLatency(rtt);
                    jitter = r.jitter ? (r.jitter * 1000).toFixed(1) + 'ms' : '--';
                    loss = r.packetsLost || 0;
                }
            }
        });

        // Resolve active candidate pair
        let activePair = null;
        stats.forEach(report => {
            if (report.type === 'transport' && report.selectedCandidatePairId) {
                activePair = stats.get(report.selectedCandidatePairId);
            }
        });

        if (!activePair) {
            stats.forEach(report => {
                if (report.type === 'candidate-pair') {
                    if (report.selected) {
                        activePair = report;
                    } else if (!activePair && report.nominated && report.state === 'succeeded') {
                        activePair = report;
                    }
                }
            });
        }

        let localIP = '---';
        let remoteIP = '---';
        let networkRoute = '---';

        if (activePair) {
            if (!hasRtt && activePair.currentRoundTripTime) {
                const rtt = Math.round(activePair.currentRoundTripTime * 1000);
                if (!isNaN(rtt) && rtt > 0) {
                    rttAvg = this.recordLatency(rtt);
                }
            }

            const localCandidate = stats.get(activePair.localCandidateId);
            const remoteCandidate = stats.get(activePair.remoteCandidateId);

            if (localCandidate) {
                const rawLocal = localCandidate.address || localCandidate.ip || '[Masked]';
                localIP = maskIP(rawLocal);
                networkRoute = classifyNetworkRoute(localCandidate.candidateType, rawLocal);
            }

            if (remoteCandidate) {
                const rawRemote = remoteCandidate.address || remoteCandidate.ip || '---';
                remoteIP = maskIP(rawRemote);
            }
        }

        // Compute E2E Cryptographic DTLS Safety Words
        let safetyWords = null;
        const certFps = extractFingerprintsFromStats(stats);
        if (certFps) {
            safetyWords = await computeSafetyWords(certFps.local, certFps.remote);
        } else if (pc && pc.currentLocalDescription && pc.currentRemoteDescription) {
            const localSdpFp = extractFingerprintsFromSdp(pc.currentLocalDescription.sdp);
            const remoteSdpFp = extractFingerprintsFromSdp(pc.currentRemoteDescription.sdp);
            if (localSdpFp && remoteSdpFp) {
                safetyWords = await computeSafetyWords(localSdpFp, remoteSdpFp);
            }
        }

        return {
            latency: rttAvg !== null ? `${rttAvg}ms` : '--',
            jitter,
            loss,
            networkRoute,
            localIP,
            remoteIP,
            safetyWords
        };
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        this.latencyHistory = [];
    }
}
