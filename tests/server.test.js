import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.opus': 'audio/ogg'
};

test('Static HTTP Server serves all project assets with HTTP 200', async () => {
    const server = http.createServer((req, res) => {
        let reqPath = req.url.split('?')[0];
        if (reqPath === '/') reqPath = '/index.html';
        const filePath = path.join(rootDir, reqPath);

        if (!fs.existsSync(filePath)) {
            res.writeHead(404);
            res.end('Not found');
            return;
        }

        const ext = path.extname(filePath);
        const mime = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': mime });
        fs.createReadStream(filePath).pipe(res);
    });

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}`;

    const filesToTest = [
        '/',
        '/index.html',
        '/css/theme.css',
        '/css/app.css',
        '/js/app.js',
        '/js/config.js',
        '/js/fsm.js',
        '/js/crypto-verify.js',
        '/js/telemetry.js',
        '/js/audio-engine.js',
        '/js/signaling.js',
        '/js/webrtc-session.js',
        '/js/ui-manager.js',
        '/audio/ring.opus',
        '/audio/dial.opus',
        '/audio/connected.opus',
        '/audio/ended.opus',
        '/audio/failed.opus'
    ];

    try {
        for (const file of filesToTest) {
            const res = await fetch(`${baseUrl}${file}`);
            assert.equal(res.status, 200, `Expected 200 OK for ${file}`);
            const buf = await res.arrayBuffer();
            assert.ok(buf.byteLength > 0, `Expected content for ${file}`);
        }
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
});
