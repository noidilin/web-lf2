#!/usr/bin/env node
import { access, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), '..');

const REQUIRED_INPUTS = [
  'apps/game/game/game.html',
  'apps/game/game/game.js',
  'apps/game/LF/loader.js',
  'apps/game/core/util.js',
  'apps/game/third_party/require.js',
  'assets/manifest.js',
  'assets/data/data.js',
  'assets/sprite/icon.png',
];

const COPY_ENTRIES = [
  ['apps/game/game', 'game'],
  ['apps/game/LF', 'LF'],
  ['apps/game/core', 'core'],
  ['apps/game/third_party', 'third_party'],
  ['assets', 'LF2_19'],
];

const GAME_CONFIG_PATTERN = /<pre id='flf-config' style='display:none'>\s*\{[^<]+\}\s*<\/pre>/;
const DEFAULT_LOBBY_NAME = 'Dev F.Lobby';
const DEFAULT_LOBBY_BASE_URL = 'https://dev.lf2-lobby.noidilin.dev';

export async function buildStatic({ root: inputRoot, outDir: inputOutDir, lobbyBaseUrl: inputLobbyBaseUrl } = {}) {
  const root = inputRoot ? path.resolve(inputRoot) : repoRoot;
  const outDir = inputOutDir ? path.resolve(inputOutDir) : path.join(root, 'dist/static');

  await assertRequiredInputs(root);
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  for (const [from, to] of COPY_ENTRIES) {
    await cp(path.join(root, from), path.join(outDir, to), {
      recursive: true,
      errorOnExist: false,
      force: true,
      verbatimSymlinks: true,
    });
  }

  await rewriteGameConfig(path.join(outDir, 'game/game.html'), {
    lobbyName: process.env.LOBBY_NAME || DEFAULT_LOBBY_NAME,
    lobbyBaseUrl: inputLobbyBaseUrl || process.env.LOBBY_BASE_URL || DEFAULT_LOBBY_BASE_URL,
  });

  return { outDir };
}

async function assertRequiredInputs(root) {
  const missing = [];
  for (const input of REQUIRED_INPUTS) {
    try {
      await access(path.join(root, input));
    } catch {
      missing.push(input);
    }
  }

  if (missing.length > 0) {
    throw new Error(`Cannot build static artifact; missing required input(s):\n- ${missing.join('\n- ')}`);
  }
}

async function rewriteGameConfig(gameHtmlPath, { lobbyName, lobbyBaseUrl }) {
  const lobbyUrl = normalizedHttpsUrl(lobbyBaseUrl);
  const deployedGameConfig = `<pre id='flf-config' style='display:none'>\n${JSON.stringify({
    root: '../',
    package: 'LF2_19/',
    lobby: { name: lobbyName, url: lobbyUrl },
  })}\n</pre>`;
  const original = await readFile(gameHtmlPath, 'utf8');
  const rewritten = original.replace(GAME_CONFIG_PATTERN, deployedGameConfig);

  if (rewritten === original) {
    throw new Error(`Cannot update deployed package path in ${gameHtmlPath}`);
  }

  await writeFile(gameHtmlPath, rewritten);
}

function normalizedHttpsUrl(input) {
  const url = new URL(input);
  if (url.protocol !== 'https:') {
    throw new Error(`Lobby base URL must use HTTPS for deployed static artifacts: ${input}`);
  }
  url.pathname = url.pathname.replace(/\/$/, '');
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

if (process.argv[1] === scriptPath) {
  try {
    const { outDir } = await buildStatic();
    console.log(`Built static artifact at ${path.relative(process.cwd(), outDir) || outDir}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
