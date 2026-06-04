import assert from 'node:assert/strict';
import test from 'node:test';

const lobbyBaseUrl = process.env.LOBBY_BASE_URL;
const run = lobbyBaseUrl ? test : test.skip;

run('deployed lobby preserves HTTP F.Lobby contract', async () => {
  const health = await fetch(`${lobbyBaseUrl}/healthz`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { ok: true });

  const protocolResponse = await fetch(`${lobbyBaseUrl}/protocol`);
  assert.equal(protocolResponse.status, 200);
  const protocol = await protocolResponse.json();
  assert.equal(protocol.name, 'F.Lobby (WebSocket)');
  assert.equal(protocol.library, '/ws/network.js');
  assert.equal(protocol.path, '/peer');
  assert.equal(protocol.address, lobbyBaseUrl);

  const lobby = await fetch(`${lobbyBaseUrl}/lobby`);
  assert.equal(lobby.status, 200);
  const lobbyHtml = await lobby.text();
  assert.match(lobbyHtml, /lobby/i);
  assert.doesNotMatch(lobbyHtml, /<script\s+[^>]*src=['"]http:\/\//i);

  const invalidLogin = await postLogin({ room: 'deployed-smoke', origin: lobbyBaseUrl });
  assert.equal(invalidLogin.status, 200);
  assert.deepEqual(await invalidLogin.json(), { success: false, mess: 'Invalid name.' });
});

run('deployed lobby accepts chat and peer WebSocket upgrades', async () => {
  await assertWebSocketOpens('/chat');
  await assertWebSocketOpens('/peer');
});

async function postLogin(body) {
  return fetch(`${lobbyBaseUrl}/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function assertWebSocketOpens(path) {
  const url = new URL(lobbyBaseUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = path;

  const ws = new WebSocket(url);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out opening ${path}`)), 5000);
    ws.addEventListener('open', () => {
      clearTimeout(timer);
      ws.close();
      resolve();
    }, { once: true });
    ws.addEventListener('error', (event) => {
      clearTimeout(timer);
      reject(new Error(`WebSocket ${path} failed: ${event.type}`));
    }, { once: true });
  });
}
