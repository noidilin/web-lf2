import assert from 'node:assert/strict';
import test from 'node:test';

const lobbyBaseUrl = process.env.LOBBY_BASE_URL || 'http://127.0.0.1:8001';

test('GET /protocol preserves the F.Lobby 0.1 WebSocket contract', async () => {
  const response = await fetch(`${lobbyBaseUrl}/protocol`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') || '', /json|text\/html/);

  const protocol = await response.json();
  assert.deepEqual(protocol, {
    name: 'F.Lobby (WebSocket)',
    library: '/ws/network.js',
    port: 8001,
    path: '/peer',
    address: lobbyBaseUrl,
  });
});

test('GET /lobby returns lobby HTML', async () => {
  const response = await fetch(`${lobbyBaseUrl}/lobby`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') || '', /html/);

  const html = await response.text();
  assert.match(html, /<html|<!doctype html/i);
  assert.match(html, /lobby/i);
});

test('POST /login rejects missing legacy room and name inputs', async () => {
  const missingName = await postLogin({ room: 'phase-1-smoke', origin: lobbyBaseUrl });
  assert.equal(missingName.status, 200);
  assert.deepEqual(await missingName.json(), {
    success: false,
    mess: 'Invalid name.',
  });

  const missingRoom = await postLogin({ name: 'ralph', origin: lobbyBaseUrl });
  assert.equal(missingRoom.status, 200);
  assert.deepEqual(await missingRoom.json(), {
    success: false,
    mess: 'Invalid room.',
  });
});

async function postLogin(body) {
  return fetch(`${lobbyBaseUrl}/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}
