/**
 * Audiolink Cryptographic E2E Identity & Media Verification
 * Computes Short Authentication String (SAS) 4-word safety fingerprints
 * from DTLS certificates to prove end-to-end encryption against MITM attacks.
 */

// 256 phonetically distinct, recognizable words (1 byte = 1 word)
export const WORDLIST = Object.freeze([
    "amber", "anchor", "anthem", "apex", "apron", "arch", "arrow", "atlas",
    "azure", "bacon", "badge", "baker", "bamboo", "banner", "basin", "beacon",
    "bison", "blaze", "bloom", "bluff", "breeze", "brick", "bridge", "bronze",
    "bubble", "cabin", "cactus", "camel", "candle", "canyon", "castle", "cedar",
    "chalk", "charm", "cherry", "chest", "cider", "cigar", "circus", "cliff",
    "cloud", "clover", "cobalt", "comet", "compass", "copper", "coral", "crater",
    "creek", "crown", "crystal", "dagger", "dawn", "delta", "desert", "diver",
    "dolphin", "dragon", "drift", "drum", "eagle", "echo", "ember", "falcon",
    "feather", "field", "flame", "flask", "fleet", "flint", "forest", "fossil",
    "frost", "galaxy", "garnet", "geyser", "glacier", "globe", "granite", "gravel",
    "harbor", "haven", "hawk", "hazel", "helmet", "horizon", "hound", "hunter",
    "icicle", "island", "ivory", "jasper", "jungle", "kayak", "kettle", "knife",
    "lagoon", "lantern", "latch", "lava", "lemon", "leopard", "lightning", "lizard",
    "lotus", "lumber", "magnet", "maple", "marble", "meadow", "meteor", "mirage",
    "monarch", "moon", "moss", "motel", "mountain", "nebula", "needle", "nest",
    "nickel", "nova", "oasis", "ocean", "olive", "onyx", "opal", "orbit",
    "otter", "paddle", "palace", "palm", "panther", "parrot", "pearl", "pebble",
    "pelican", "penny", "pepper", "phoenix", "pillar", "pilot", "planet", "plasma",
    "plume", "polar", "pond", "poppy", "prism", "puzzle", "pyramid", "quartz",
    "quiver", "radar", "rainbow", "raven", "reef", "rhino", "ridge", "river",
    "robin", "rocket", "ruby", "sailor", "salmon", "saturn", "scale", "scarlet",
    "shadow", "shield", "sierra", "silver", "siren", "slate", "smoke", "solar",
    "sparrow", "spark", "sphinx", "spider", "spiral", "spring", "summit", "sunset",
    "swan", "swift", "sword", "table", "talon", "tempo", "tiger", "timber",
    "titan", "topaz", "torch", "totem", "tower", "tractor", "trail", "tulip",
    "tunnel", "valley", "vapor", "velvet", "vessel", "viper", "vision", "vortex",
    "voyage", "walnut", "wave", "whisper", "willow", "wizard", "wolf", "zenith",
    "acorn", "alder", "almond", "alpine", "badger", "balsam", "barley", "basalt",
    "beaver", "birch", "boulder", "bronco", "cavern", "chisel", "cobra", "condor",
    "coyote", "crag", "denim", "fawn", "ferret", "finch", "fir", "fox",
    "gecko", "ginkgo", "grove", "gull", "hemlock", "heron", "holly", "iguana",
    "jaguar", "juniper", "koala", "larch", "lichen", "llama", "lynx", "magpie"
]);

/**
 * Extracts DTLS sha-256 fingerprints from SDP string
 */
export function extractFingerprintsFromSdp(sdp) {
    if (!sdp || typeof sdp !== 'string') return null;
    const match = sdp.match(/a=fingerprint:sha-256\s+([0-9a-fA-F:]+)/i);
    return match ? match[1].toUpperCase() : null;
}

/**
 * Extracts local and remote DTLS certificate fingerprints from RTCStatsReport
 */
export function extractFingerprintsFromStats(stats) {
    if (!stats || typeof stats.forEach !== 'function') return null;

    let localFp = null;
    let remoteFp = null;

    // 1. Direct from transport pointer
    stats.forEach(report => {
        if (report.type === 'transport') {
            if (report.localCertificateId && stats.has(report.localCertificateId)) {
                localFp = stats.get(report.localCertificateId).fingerprint;
            }
            if (report.remoteCertificateId && stats.has(report.remoteCertificateId)) {
                remoteFp = stats.get(report.remoteCertificateId).fingerprint;
            }
        }
    });

    // 2. Fallback to iterating certificates
    if (!localFp || !remoteFp) {
        stats.forEach(report => {
            if (report.type === 'certificate' && report.fingerprint) {
                if (report.isRemote) {
                    remoteFp = report.fingerprint;
                } else if (!localFp) {
                    localFp = report.fingerprint;
                }
            }
        });
    }

    if (localFp && remoteFp) {
        return {
            local: localFp.toUpperCase(),
            remote: remoteFp.toUpperCase()
        };
    }

    return null;
}

/**
 * Computes deterministic 4-word safety code from two fingerprints
 * Order-independent: SHA256(sort([fp1, fp2]).join(':'))
 */
export async function computeSafetyWords(fp1, fp2) {
    if (!fp1 || !fp2) return null;

    // Normalizing and sorting guarantees both peers produce the identical 4 words
    const sorted = [fp1.trim().toUpperCase(), fp2.trim().toUpperCase()].sort();
    const combinedString = sorted.join(':');

    let hashBuffer;
    if (typeof crypto !== 'undefined' && crypto.subtle && crypto.subtle.digest) {
        const encoder = new TextEncoder();
        hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(combinedString));
    } else {
        // Fallback for Node.js test environment if crypto.subtle is not present
        const nodeCrypto = await import('node:crypto');
        hashBuffer = nodeCrypto.createHash('sha256').update(combinedString).digest();
    }

    const bytes = new Uint8Array(hashBuffer);

    return [
        WORDLIST[bytes[0] % WORDLIST.length],
        WORDLIST[bytes[1] % WORDLIST.length],
        WORDLIST[bytes[2] % WORDLIST.length],
        WORDLIST[bytes[3] % WORDLIST.length]
    ].join(' • ');
}
