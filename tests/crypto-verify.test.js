import test from 'node:test';
import assert from 'node:assert/strict';
import {
    WORDLIST,
    extractFingerprintsFromSdp,
    extractFingerprintsFromStats,
    computeSafetyWords
} from '../js/crypto-verify.js';

test('WORDLIST has exactly 256 unique, non-empty, lowercase words', () => {
    assert.equal(WORDLIST.length, 256, 'Wordlist must have exactly 256 words (1 byte = 1 word)');

    const uniqueSet = new Set(WORDLIST);
    assert.equal(uniqueSet.size, 256, 'All 256 words must be unique');

    for (const word of WORDLIST) {
        assert.equal(typeof word, 'string');
        assert.ok(word.length >= 3, `Word "${word}" must have at least 3 characters`);
        assert.equal(word, word.toLowerCase(), `Word "${word}" must be lowercase`);
    }
});

test('extractFingerprintsFromSdp extracts SHA-256 fingerprint from SDP string', () => {
    const mockSdp = `
v=0
o=- 2890844526 2890844526 IN IP4 127.0.0.1
s=-
t=0 0
a=fingerprint:sha-256 26:80:66:32:04:F7:62:00:AE:58:63:F5:F4:A4:7E:AA:C5:58:69:B8:31:37:37:A2:AE:65:87:BA:9F:DF:D3:5F
m=audio 9 UDP/TLS/RTP/SAVPF 111
    `;

    const fp = extractFingerprintsFromSdp(mockSdp);
    assert.equal(fp, '26:80:66:32:04:F7:62:00:AE:58:63:F5:F4:A4:7E:AA:C5:58:69:B8:31:37:37:A2:AE:65:87:BA:9F:DF:D3:5F');

    assert.equal(extractFingerprintsFromSdp(null), null);
    assert.equal(extractFingerprintsFromSdp('no-fingerprint-here'), null);
});

test('extractFingerprintsFromStats parses local and remote certificates from RTCStatsReport', () => {
    const mockStats = new Map();
    mockStats.set('transport-0', {
        type: 'transport',
        localCertificateId: 'cert-local',
        remoteCertificateId: 'cert-remote'
    });
    mockStats.set('cert-local', {
        type: 'certificate',
        fingerprint: '11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00'
    });
    mockStats.set('cert-remote', {
        type: 'certificate',
        fingerprint: 'AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99'
    });

    const fps = extractFingerprintsFromStats(mockStats);
    assert.ok(fps !== null);
    assert.equal(fps.local, '11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00');
    assert.equal(fps.remote, 'AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99');
});

test('computeSafetyWords is order-independent and deterministic', async () => {
    const fpAlice = '26:80:66:32:04:F7:62:00:AE:58:63:F5:F4:A4:7E:AA:C5:58:69:B8:31:37:37:A2:AE:65:87:BA:9F:DF:D3:5F';
    const fpBob = '9B:45:C2:11:8A:77:E3:42:01:DF:88:31:A0:04:F1:C9:88:12:44:B9:33:71:02:AA:EE:61:94:CC:12:DE:AA:50';

    // Alice calculates: (fpAlice, fpBob)
    const wordsAlice = await computeSafetyWords(fpAlice, fpBob);
    // Bob calculates: (fpBob, fpAlice)
    const wordsBob = await computeSafetyWords(fpBob, fpAlice);

    assert.ok(wordsAlice !== null);
    assert.ok(wordsBob !== null);

    // Must be exactly 4 words joined with ' • '
    const parts = wordsAlice.split(' • ');
    assert.equal(parts.length, 4, 'Should contain exactly 4 words');
    for (const word of parts) {
        assert.ok(WORDLIST.includes(word), `Word "${word}" must be from WORDLIST`);
    }

    // Both peers MUST compute identical safety words
    assert.equal(wordsAlice, wordsBob, 'Alice and Bob must compute identical safety words regardless of parameter order');

    // Different certificate fingerprint MUST yield completely different words
    const fpEve = '00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00';
    const wordsEve = await computeSafetyWords(fpAlice, fpEve);
    assert.notEqual(wordsAlice, wordsEve, 'MITM certificate must produce different safety words');
});
