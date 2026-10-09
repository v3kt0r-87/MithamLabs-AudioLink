import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('index.html contains all critical DOM elements and IDs required by Audiolink', () => {
    const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf-8');

    const requiredIds = [
        'btn-theme-toggle',
        'theme-icon',
        'theme-text',
        'incoming-modal',
        'incoming-caller-id',
        'btn-accept',
        'btn-decline',
        'main-view',
        'system-status',
        'system-status-text',
        'global-info',
        'setup-phase',
        'invite-banner',
        'username-input',
        'setup-error',
        'btn-init-uplink',
        'btn-init-uplink-text',
        'call-controls',
        'my-id',
        'btn-copy-id',
        'btn-copy-link',
        'outgoing-box',
        'outgoing-status-action',
        'outgoing-target-name',
        'outgoing-status-subtext',
        'btn-cancel-outgoing',
        'btn-cbr-toggle',
        'btn-ipv6-toggle',
        'peer-id',
        'call-error',
        'btn-start-call',
        'btn-start-call-text',
        'btn-start-call-icon',
        'call-stage',
        'lat-avg',
        'jitter',
        'loss',
        'network-type',
        'local-card',
        'local-user-tag',
        'local-ip',
        'call-timer',
        'safety-words-card',
        'safety-words',
        'peer-card',
        'remote-user-tag',
        'remote-ip',
        'mic-db-level',
        'meter-fill',
        'gain-db-display',
        'gain-slider',
        'btn-mute',
        'btn-ns',
        'btn-ec',
        'btn-end-call',
        'privacy-view',
        'remote-audio',
        'ring-audio',
        'dial-audio',
        'connected-audio',
        'ended-audio',
        'failed-audio'
    ];

    for (const id of requiredIds) {
        assert.ok(
            html.includes(`id="${id}"`),
            `Expected index.html to contain element with id="${id}"`
        );
    }
});

test('index.html links to modular stylesheets and main JS module', () => {
    const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf-8');

    assert.ok(html.includes('<link rel="stylesheet" href="css/theme.css">'));
    assert.ok(html.includes('<link rel="stylesheet" href="css/app.css">'));
    assert.ok(html.includes('<script type="module" src="js/app.js"></script>'));
});

test('All JavaScript modules import and export correctly without syntax errors', async () => {
    const jsFiles = [
        '../js/config.js',
        '../js/fsm.js',
        '../js/crypto-verify.js',
        '../js/telemetry.js',
        '../js/audio-engine.js',
        '../js/signaling.js',
        '../js/webrtc-session.js',
        '../js/ui-manager.js'
    ];

    for (const file of jsFiles) {
        const mod = await import(file);
        assert.ok(mod !== null, `Module ${file} should export valid object`);
    }
});
