import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const port = process.env.PORT || '8001';
const baseUrl = `http://127.0.0.1:${port}`;
const startupTimeoutMs = Number(process.env.SMOKE_STARTUP_TIMEOUT_MS || 5000);
const shutdownGraceMs = Number(process.env.SMOKE_SHUTDOWN_GRACE_MS || 250);

let serverExit;
const server = spawn(process.execPath, ['index.js'], {
  env: {
    ...process.env,
    PUBLIC_LOBBY: process.env.PUBLIC_LOBBY || 'true',
    SHUTDOWN_TIMEOUT_MS: process.env.SHUTDOWN_TIMEOUT_MS || '100',
  },
  stdio: 'inherit',
});

const serverExited = new Promise((resolve) => {
  server.once('exit', (code, signal) => {
    serverExit = { code, signal };
    resolve(serverExit);
  });
});

async function waitFor(path) {
  const deadline = Date.now() + startupTimeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    if (serverExit) {
      throw new Error(`Lobby exited before ${path} responded: ${formatExit(serverExit)}`);
    }

    try {
      const response = await fetch(`${baseUrl}${path}`);
      if (response.ok) return response;
      lastError = new Error(`${path} returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await delay(100);
  }

  throw lastError || new Error(`${path} did not respond before ${startupTimeoutMs}ms`);
}

function formatExit({ code, signal }) {
  return signal ? `signal ${signal}` : `exit code ${code}`;
}

async function stopServer() {
  if (serverExit) return;

  server.kill('SIGTERM');
  await Promise.race([serverExited, delay(shutdownGraceMs)]);

  if (!serverExit) {
    server.kill('SIGKILL');
    await serverExited;
  }
}

try {
  const health = await waitFor('/healthz');
  const protocol = await waitFor('/protocol');
  const healthBody = await health.json();
  const protocolBody = await protocol.json();

  if (healthBody.ok !== true) {
    throw new Error('/healthz did not report ok');
  }

  if (protocolBody.name !== 'F.Lobby (WebSocket)') {
    throw new Error('/protocol did not report websocket lobby');
  }
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await stopServer();
}
