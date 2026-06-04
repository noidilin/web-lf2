import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { buildStatic } from '../scripts/build-static.mjs';
import { checkStatic } from '../scripts/check-static.mjs';

test('checkStatic accepts the generated static artifact', async () => {
  const outDir = await mkdtemp(path.join(tmpdir(), 'web-lf2-check-static-'));
  try {
    await buildStatic({ outDir });

    const result = await checkStatic({ artifactDir: outDir });

    assert.equal(result.artifactDir, outDir);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test('checkStatic reports missing deployed files and directories', async () => {
  const outDir = await mkdtemp(path.join(tmpdir(), 'web-lf2-check-static-'));
  try {
    await buildStatic({ outDir });
    await rm(path.join(outDir, 'LF2_19'), { recursive: true, force: true });
    await rm(path.join(outDir, 'core/util.js'), { force: true });

    await assert.rejects(
      checkStatic({ artifactDir: outDir }),
      /missing required artifact path\(s\):[\s\S]*core\/util\.js[\s\S]*LF2_19/,
    );
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test('checkStatic rejects the wrong deployed package path in game config', async () => {
  const outDir = await mkdtemp(path.join(tmpdir(), 'web-lf2-check-static-'));
  try {
    await buildStatic({ outDir });
    await writeFile(
      path.join(outDir, 'game/game.html'),
      `<pre id='flf-config' style='display:none'>\n{"root":"../","package":"assets/"}\n</pre>`,
    );

    await assert.rejects(checkStatic({ artifactDir: outDir }), /expected game config package to be LF2_19\//);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test('checkStatic rejects missing deployed lobby URL in game config', async () => {
  const outDir = await mkdtemp(path.join(tmpdir(), 'web-lf2-check-static-'));
  try {
    await buildStatic({ outDir, lobbyBaseUrl: 'https://dev.lf2-lobby.noidilin.dev' });
    await writeFile(
      path.join(outDir, 'game/game.html'),
      `<pre id='flf-config' style='display:none'>\n{"root":"../","package":"LF2_19/"}\n</pre>`,
    );

    await assert.rejects(checkStatic({ artifactDir: outDir }), /missing deployed lobby URL/);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test('checkStatic rejects insecure and protocol-relative external URLs', async () => {
  const outDir = await mkdtemp(path.join(tmpdir(), 'web-lf2-check-static-'));
  try {
    await buildStatic({ outDir });
    await mkdir(path.join(outDir, 'game/external'), { recursive: true });
    await writeFile(
      path.join(outDir, 'game/external/urls.js'),
      `const insecure = 'http://example.com/game.js';\nconst protocolRelative = '//cdn.example.com/game.js';\n`,
    );

    await assert.rejects(
      checkStatic({ artifactDir: outDir }),
      /unexpected external URL reference\(s\):[\s\S]*http:\/\/example\.com[\s\S]*\/\/cdn\.example\.com/,
    );
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
