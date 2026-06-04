import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { buildStatic } from '../scripts/build-static.mjs';

test('buildStatic creates the deployable legacy game artifact', async () => {
  const outDir = await mkdtemp(path.join(tmpdir(), 'web-lf2-static-'));
  try {
    await buildStatic({ outDir });

    const requiredArtifactPaths = [
      'game/game.html',
      'game/game.js',
      'LF/loader.js',
      'core/util.js',
      'third_party/require.js',
      'LF2_19/manifest.js',
      'LF2_19/data/data.js',
      'LF2_19/sprite/icon.png',
    ];

    for (const requiredPath of requiredArtifactPaths) {
      assert.ok(
        await fileExists(path.join(outDir, requiredPath)),
        `expected ${requiredPath} in static artifact`,
      );
    }

    const gameHtml = await readText(path.join(outDir, 'game/game.html'));
    assert.match(gameHtml, /"package"\s*:\s*"LF2_19\/"/);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test('buildStatic injects the environment-specific lobby URL into the game config', async () => {
  const outDir = await mkdtemp(path.join(tmpdir(), 'web-lf2-static-'));
  try {
    await buildStatic({ outDir, lobbyBaseUrl: 'https://dev.lf2-lobby.noidilin.dev' });

    const gameHtml = await readText(path.join(outDir, 'game/game.html'));
    assert.match(gameHtml, /"lobby"\s*:\s*\{"name":"Dev F\.Lobby","url":"https:\/\/dev\.lf2-lobby\.noidilin\.dev"\}/);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readText(filePath) {
  return readFile(filePath, 'utf8');
}
