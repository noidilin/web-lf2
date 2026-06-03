import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import test from 'node:test';

const LOBBY_CWD = new URL('../apps/lobby/', import.meta.url);
const require = createRequire(new URL('package.json', LOBBY_CWD));
const WebSocket = require('ws');

async function startLobby(env = {}) {
  const port = await getFreePort();
  const child = spawn(process.execPath, ['index.js', '--port', String(port)], {
    cwd: LOBBY_CWD,
    env: { ...process.env, ...env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let output = '';
  child.stdout.on('data', (chunk) => {
    output += String(chunk);
  });
  child.stderr.on('data', (chunk) => {
    output += String(chunk);
  });

  try {
    await waitFor(async () => {
      const response = await fetch(`http://127.0.0.1:${port}/healthz`);
      assert.equal(response.status, 200);
    });
  } catch (error) {
    child.kill('SIGTERM');
    throw new Error(`Lobby did not start: ${output}\n${error.message}`);
  }

  return {
    port,
    baseUrl: `http://127.0.0.1:${port}`,
    child,
    getOutput() {
      return output;
    },
    async stop() {
      if (child.exitCode === null) {
        child.kill('SIGTERM');
        await once(child, 'exit');
      }
    },
  };
}

test('GET /healthz reports lobby health for load balancers', async (t) => {
  const lobby = await startLobby();
  t.after(() => lobby.stop());

  const response = await fetch(`${lobby.baseUrl}/healthz`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
});

test('GET /protocol reports the public origin behind a trusted reverse proxy', async (t) => {
  const lobby = await startLobby({ TRUST_PROXY: 'true' });
  t.after(() => lobby.stop());

  const response = await fetch(`${lobby.baseUrl}/protocol`, {
    headers: {
      host: 'internal-target.local',
      'x-forwarded-proto': 'https',
      'x-forwarded-host': 'lobby.example.test',
    },
  });

  assert.equal(response.status, 200);
  const protocol = await response.json();
  assert.equal(protocol.address, 'https://lobby.example.test');
});

test('POST /login preserves legacy invalid input shapes before hardening checks', async (t) => {
  const lobby = await startLobby({ ALLOWED_ORIGINS: 'https://game.example.test' });
  t.after(() => lobby.stop());

  const response = await postLogin(lobby.baseUrl, {
    room: 'phase-2',
    origin: 'https://denied.example.test',
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: false, mess: 'Invalid name.' });
});

test('POST /login allows configured origins and denies unconfigured origins', async (t) => {
  const lobby = await startLobby({ ALLOWED_ORIGINS: 'https://game.example.test' });
  t.after(() => lobby.stop());

  const allowed = await postLogin(lobby.baseUrl, {
    name: 'ralph',
    room: 'phase-2',
    origin: 'https://game.example.test/play.html',
  });
  assert.equal(allowed.status, 200);
  assert.deepEqual(await allowed.json(), { success: true });

  const denied = await postLogin(lobby.baseUrl, {
    name: 'bad-origin',
    room: 'phase-2',
    origin: 'https://evil.example.test/play.html',
  });
  assert.equal(denied.status, 200);
  assert.deepEqual(await denied.json(), {
    success: false,
    mess: 'Hostname evil.example.test not in server whitelist.',
  });
});

test('POST /login rate limits repeated attempts from the same client', async (t) => {
  const lobby = await startLobby({ LOGIN_RATE_LIMIT_MAX: '2', LOGIN_RATE_LIMIT_WINDOW_MS: '60000' });
  t.after(() => lobby.stop());

  await postLogin(lobby.baseUrl, { name: 'one', room: 'phase-2', origin: lobby.baseUrl });
  await postLogin(lobby.baseUrl, { name: 'two', room: 'phase-2', origin: lobby.baseUrl });
  const limited = await postLogin(lobby.baseUrl, { name: 'three', room: 'phase-2', origin: lobby.baseUrl });

  assert.equal(limited.status, 429);
  assert.deepEqual(await limited.json(), { success: false, mess: 'Login rate limit exceeded.' });
});

test('POST /login uses bounded trusted proxy hops for rate limit keys', async (t) => {
  const lobby = await startLobby({
    TRUST_PROXY: 'true',
    TRUST_PROXY_HOPS: '1',
    LOGIN_RATE_LIMIT_MAX: '2',
    LOGIN_RATE_LIMIT_WINDOW_MS: '60000',
  });
  t.after(() => lobby.stop());

  await postLogin(lobby.baseUrl, { name: 'one', room: 'phase-2', origin: lobby.baseUrl }, {
    'x-forwarded-for': '198.51.100.1, 203.0.113.10',
  });
  await postLogin(lobby.baseUrl, { name: 'two', room: 'phase-2', origin: lobby.baseUrl }, {
    'x-forwarded-for': '198.51.100.2, 203.0.113.10',
  });
  const limited = await postLogin(lobby.baseUrl, { name: 'three', room: 'phase-2', origin: lobby.baseUrl }, {
    'x-forwarded-for': '198.51.100.3, 203.0.113.10',
  });

  assert.equal(limited.status, 429);
  assert.deepEqual(await limited.json(), { success: false, mess: 'Login rate limit exceeded.' });
});

test('startup log reports PUBLIC_LOBBY resolved mode', async (t) => {
  const lobby = await startLobby({ PUBLIC_LOBBY: 'true' });
  t.after(() => lobby.stop());

  assert.match(lobby.getOutput(), /public server/);
  assert.doesNotMatch(lobby.getOutput(), /private server/);
});

test('POST /login cleans stale room users after the room TTL', async (t) => {
  const lobby = await startLobby({ ROOM_TTL_MS: '150' });
  t.after(() => lobby.stop());

  const first = await postLogin(lobby.baseUrl, { name: 'stale', room: 'phase-2', origin: lobby.baseUrl });
  assert.deepEqual(await first.json(), { success: true });

  await new Promise((resolve) => setTimeout(resolve, 350));

  const second = await postLogin(lobby.baseUrl, { name: 'stale', room: 'phase-2', origin: lobby.baseUrl });
  assert.deepEqual(await second.json(), { success: true });
});

test('chat WebSocket closes oversized messages', async (t) => {
  const lobby = await startLobby({ MAX_WS_MESSAGE_SIZE: '8' });
  t.after(() => lobby.stop());

  const ws = new WebSocket(`ws://127.0.0.1:${lobby.port}/chat`);
  await once(ws, 'open');
  ws.send('{"too":"large"}');
  await once(ws, 'close');
  assert.equal(ws.readyState, WebSocket.CLOSED);
});

async function postLogin(baseUrl, body, headers = {}) {
  return fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

async function waitFor(assertion, timeoutMs = 5000) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeoutMs) {
    try {
      await assertion();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  throw lastError;
}

async function getFreePort() {
  const { createServer } = await import('node:net');
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  server.close();
  await once(server, 'close');
  return port;
}
