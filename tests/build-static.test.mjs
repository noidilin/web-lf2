import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { buildStatic } from '../scripts/build-static.mjs';

test('buildStatic creates the deployable legacy game artifact', async () => {
  const outDir = await mkdtemp(path.join(tmpdir(), 'web-lf2-static-'));
  try {
    await buildStatic({ outDir });

    for (const requiredPath of [
      'game/game.html',
      'game/game.js',
      'LF/loader.js',
      'core/util.js',
      'third_party/require.js',
      'LF2_19/manifest.js',
      'LF2_19/data/data.js',
      'LF2_19/sprite/icon.png',
    ]) {
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

async function fileExists(filePath) {
  try {
    const { access } = await import('node:fs/promises');
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readText(filePath) {
  const { readFile } = await import('node:fs/promises');
  return readFile(filePath, 'utf8');
}
