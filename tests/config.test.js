import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONFIG } from '../js/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('Username validation regex matches strict specifications', () => {
    const regex = CONFIG.USERNAME_REGEX;

    // Valid usernames
    assert.equal(regex.test('alice'), true);
    assert.equal(regex.test('bob_123'), true);
    assert.equal(regex.test('user-test'), true);
    assert.equal(regex.test('a'.repeat(24)), true);

    // Invalid usernames
    assert.equal(regex.test('ab'), false); // Too short (< 3)
    assert.equal(regex.test('a'.repeat(25)), false); // Too long (> 24)
    assert.equal(regex.test('user@name'), false); // Invalid char
    assert.equal(regex.test('user name'), false); // Spaces not allowed
    assert.equal(regex.test('user.name'), false); // Dots not allowed
    assert.equal(regex.test(''), false);
});

test('All configured sound files physically exist on disk', () => {
    for (const [name, relPath] of Object.entries(CONFIG.SOUND_FILES)) {
        const fullPath = path.join(rootDir, relPath);
        assert.equal(
            fs.existsSync(fullPath),
            true,
            `Sound file for '${name}' at ${relPath} must exist on disk`
        );
        const stats = fs.statSync(fullPath);
        assert.ok(stats.size > 0, `Sound file ${relPath} should not be empty`);
    }
});

test('ICE configuration has STUN and TURN entries', () => {
    assert.ok(Array.isArray(CONFIG.ICE_SERVERS));
    assert.ok(CONFIG.ICE_SERVERS.length >= 4);

    const hasStun = CONFIG.ICE_SERVERS.some(s => s.urls && s.urls.startsWith('stun:'));
    const hasTurn = CONFIG.ICE_SERVERS.some(s => s.urls && s.urls.startsWith('turn:'));

    assert.equal(hasStun, true, 'Must have STUN server for NAT discovery');
    assert.equal(hasTurn, true, 'Must have TURN server for NAT relay fallback');
});
