import test from 'node:test';
import assert from 'node:assert/strict';
import { maskIP, classifyNetworkRoute, TelemetryMonitor, enforceCBRInSdp } from '../js/telemetry.js';

test('maskIP correctly obfuscates IPv4, IPv6, and mDNS', () => {
    assert.equal(maskIP('192.168.1.100'), '192.168.*.*');
    assert.equal(maskIP('10.0.5.23'), '10.0.*.*');
    assert.equal(maskIP('172.20.10.2'), '172.20.*.*');
    assert.equal(maskIP('8.8.8.8'), '8.8.*.*');

    assert.equal(maskIP('2001:0db8:85a3:0000:0000:8a2e:0370:7334'), '2001:0db8:****');
    assert.equal(maskIP('fe80::1ff:fe23:4567:890a'), 'fe80::****');

    assert.equal(maskIP('desktop-abc.local'), 'LAN (mDNS)');

    assert.equal(maskIP('---'), '---');
    assert.equal(maskIP('[Masked]'), '[Masked]');
    assert.equal(maskIP(null), null);
});

test('classifyNetworkRoute accurately classifies candidate types and networks', () => {
    assert.equal(classifyNetworkRoute('relay', '104.21.5.1'), 'Relay (TURN)');
    assert.equal(classifyNetworkRoute('srflx', '152.57.1.1'), 'P2P (STUN)');
    assert.equal(classifyNetworkRoute('host', 'laptop.local'), 'LAN (mDNS)');
    assert.equal(classifyNetworkRoute('host', '192.168.1.50'), 'LAN / Private');
    assert.equal(classifyNetworkRoute('host', '10.0.0.12'), 'LAN / Private');
    assert.equal(classifyNetworkRoute('host', '172.25.0.1'), 'LAN / Private');
    assert.equal(classifyNetworkRoute('host', '2405:201:2000::1'), 'IPv6 Direct');
    assert.equal(classifyNetworkRoute('host', '45.12.34.56'), 'P2P Direct');
    assert.equal(classifyNetworkRoute(null, null), '---');
});

test('TelemetryMonitor correctly calculates rolling latency average', () => {
    const monitor = new TelemetryMonitor();

    assert.equal(monitor.recordLatency(null), null);
    assert.equal(monitor.recordLatency(-5), null);
    assert.equal(monitor.recordLatency(NaN), null);

    assert.equal(monitor.recordLatency(40), 40);
    assert.equal(monitor.recordLatency(60), 50); // (40 + 60) / 2
    assert.equal(monitor.recordLatency(80), 60); // (40 + 60 + 80) / 3

    // Fill beyond 30 samples to test sliding window
    for (let i = 0; i < 40; i++) {
        monitor.recordLatency(100);
    }
    assert.equal(monitor.latencyHistory.length, 30);
    assert.equal(monitor.recordLatency(100), 100);
});

test('TelemetryMonitor extracts metrics from RTCStatsReport map', async () => {
    const monitor = new TelemetryMonitor();

    const mockStats = new Map();
    mockStats.set('transport-1', {
        type: 'transport',
        selectedCandidatePairId: 'cp-1'
    });
    mockStats.set('cp-1', {
        type: 'candidate-pair',
        localCandidateId: 'cand-local',
        remoteCandidateId: 'cand-remote',
        currentRoundTripTime: 0.045
    });
    mockStats.set('cand-local', {
        type: 'local-candidate',
        candidateType: 'srflx',
        address: '152.58.12.34'
    });
    mockStats.set('cand-remote', {
        type: 'remote-candidate',
        candidateType: 'host',
        address: '192.168.1.15'
    });
    mockStats.set('inbound-audio', {
        type: 'remote-inbound-rtp',
        roundTripTime: 0.042,
        jitter: 0.0035,
        packetsLost: 2
    });

    const metrics = await monitor.extractMetrics(mockStats);

    assert.equal(metrics.latency, '42ms');
    assert.equal(metrics.jitter, '3.5ms');
    assert.equal(metrics.loss, 2);
    assert.equal(metrics.networkRoute, 'P2P (STUN)');
    assert.equal(metrics.localIP, '152.58.*.*');
    assert.equal(metrics.remoteIP, '192.168.*.*');
});

test('enforceCBRInSdp modifies existing fmtp line to force cbr=1, usedtx=0, and maxaveragebitrate', () => {
    const sdpWithFmtp = [
        'v=0',
        'm=audio 9 UDP/TLS/RTP/SAVPF 111 126',
        'a=rtpmap:111 opus/48000/2',
        'a=fmtp:111 minptime=10;useinbandfec=1',
        'a=rtpmap:126 telephone-event/8000'
    ].join('\r\n');

    const result = enforceCBRInSdp(sdpWithFmtp, 32000);
    assert.match(result, /a=fmtp:111 minptime=10;useinbandfec=1;cbr=1;usedtx=0;maxaveragebitrate=32000/);

    // Overwrites existing cbr and usedtx if present
    const sdpWithOldParams = [
        'v=0',
        'm=audio 9 UDP/TLS/RTP/SAVPF 111',
        'a=rtpmap:111 opus/48000/2',
        'a=fmtp:111 minptime=10;cbr=0;usedtx=1;maxaveragebitrate=64000'
    ].join('\r\n');

    const result2 = enforceCBRInSdp(sdpWithOldParams, 32000);
    assert.match(result2, /a=fmtp:111 minptime=10;cbr=1;usedtx=0;maxaveragebitrate=32000/);
    assert.doesNotMatch(result2, /cbr=0/);
    assert.doesNotMatch(result2, /usedtx=1/);
});

test('enforceCBRInSdp injects fmtp line when opus rtpmap exists without fmtp', () => {
    const sdpWithoutFmtp = [
        'v=0',
        'm=audio 9 UDP/TLS/RTP/SAVPF 96',
        'a=rtpmap:96 opus/48000/2',
        'a=mid:0'
    ].join('\r\n');

    const result = enforceCBRInSdp(sdpWithoutFmtp, 32000);
    assert.match(result, /a=fmtp:96 minptime=10;cbr=1;usedtx=0;maxaveragebitrate=32000/);
});

test('enforceCBRInSdp leaves SDP untouched when opus is not present or sdp is invalid', () => {
    const sdpNoOpus = [
        'v=0',
        'm=audio 9 UDP/TLS/RTP/SAVPF 0',
        'a=rtpmap:0 PCMU/8000'
    ].join('\r\n');

    assert.equal(enforceCBRInSdp(sdpNoOpus), sdpNoOpus);
    assert.equal(enforceCBRInSdp(null), null);
    assert.equal(enforceCBRInSdp(''), '');
});
