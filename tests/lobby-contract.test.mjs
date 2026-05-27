import assert from 'node:assert/strict';
import test from 'node:test';

const lobbyBaseUrl = process.env.LOBBY_BASE_URL || 'http://127.0.0.1:8001';

const expectedProtocol = {
  name: 'F.Lobby (WebSocket)',
  library: '/ws/network.js',
  port: 8001,
  path: '/peer',
  address: lobbyBaseUrl,
};

const invalidLoginCases = [
  {
    body: { room: 'phase-1-smoke', origin: lobbyBaseUrl },
    expected: { success: false, mess: 'Invalid name.' },
  },
  {
    body: { name: 'ralph', origin: lobbyBaseUrl },
    expected: { success: false, mess: 'Invalid room.' },
  },
];

test('GET /protocol preserves the F.Lobby 0.1 WebSocket contract', async () => {
  const response = await getLobbyPath('/protocol');
  assertOk(response);
  assertContentType(response, /json|text\/html/);

  assert.deepEqual(await response.json(), expectedProtocol);
});

test('GET /lobby returns lobby HTML', async () => {
  const response = await getLobbyPath('/lobby');
  assertOk(response);
  assertContentType(response, /html/);

  const html = await response.text();
  assert.match(html, /<html|<!doctype html/i);
  assert.match(html, /lobby/i);
});

test('POST /login rejects missing legacy room and name inputs', async () => {
  for (const { body, expected } of invalidLoginCases) {
    const response = await postLogin(body);
    assertOk(response);
    assert.deepEqual(await response.json(), expected);
  }
});

async function getLobbyPath(path) {
  return fetch(`${lobbyBaseUrl}${path}`);
}

async function postLogin(body) {
  return fetch(`${lobbyBaseUrl}/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function assertOk(response) {
  assert.equal(response.status, 200);
}

function assertContentType(response, expectedPattern) {
  assert.match(response.headers.get('content-type') || '', expectedPattern);
}
