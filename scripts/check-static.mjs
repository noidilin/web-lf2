#!/usr/bin/env node
import { access, readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), '..');

const REQUIRED_ARTIFACT_PATHS = [
  'game',
  'game/game.html',
  'game/game.js',
  'LF',
  'LF/loader.js',
  'core',
  'core/util.js',
  'third_party',
  'third_party/require.js',
  'LF2_19',
  'LF2_19/manifest.js',
  'LF2_19/data/data.js',
  'LF2_19/sprite/icon.png',
];

const EXPECTED_PACKAGE = 'LF2_19/';
const GAME_CONFIG_PATTERN = /<pre id=['"]flf-config['"] style=['"]display:none['"]>\s*(\{[^<]+\})\s*<\/pre>/;
const HTTP_URL_PATTERN = /http:\/\/[^\s'"<>)]+/g;
const PROTOCOL_RELATIVE_URL_PATTERN = /(?<!:)\/\/[A-Za-z0-9.-]+\.[A-Za-z]{2,}[^\s'"<>)]+/g;

export async function checkStatic({ artifactDir: inputArtifactDir } = {}) {
  const artifactDir = inputArtifactDir
    ? path.resolve(inputArtifactDir)
    : path.join(repoRoot, 'dist/static');

  await assertRequiredArtifactPaths(artifactDir);
  await assertGameConfig(artifactDir);
  await assertNoUnexpectedExternalUrls(artifactDir);

  return { artifactDir };
}

async function assertRequiredArtifactPaths(artifactDir) {
  const missing = [];

  for (const artifactPath of REQUIRED_ARTIFACT_PATHS) {
    try {
      await access(path.join(artifactDir, artifactPath));
    } catch {
      missing.push(artifactPath);
    }
  }

  if (missing.length > 0) {
    throw new Error(`Static artifact is invalid; missing required artifact path(s):\n- ${missing.join('\n- ')}`);
  }
}

async function assertGameConfig(artifactDir) {
  const gameHtmlPath = path.join(artifactDir, 'game/game.html');
  const gameHtml = await readFile(gameHtmlPath, 'utf8');
  const match = gameHtml.match(GAME_CONFIG_PATTERN);

  if (!match) {
    throw new Error('Static artifact is invalid; missing flf-config in game/game.html');
  }

  let config;
  try {
    config = JSON.parse(match[1]);
  } catch (error) {
    throw new Error(`Static artifact is invalid; flf-config is not valid JSON: ${error.message}`);
  }

  if (config.package !== EXPECTED_PACKAGE) {
    throw new Error(
      `Static artifact is invalid; expected game config package to be ${EXPECTED_PACKAGE} but found ${JSON.stringify(config.package)}`,
    );
  }
}

async function assertNoUnexpectedExternalUrls(artifactDir) {
  const findings = [];
  for await (const filePath of walkFiles(artifactDir)) {
    const relativePath = path.relative(artifactDir, filePath).split(path.sep).join('/');
    const content = await readFile(filePath, 'utf8');
    const matches = [
      ...content.matchAll(HTTP_URL_PATTERN),
      ...content.matchAll(PROTOCOL_RELATIVE_URL_PATTERN),
    ];

    const allowedReferences = await legacyReferencesFor(relativePath);
    for (const match of matches) {
      if (!allowedReferences.has(match[0])) {
        findings.push(`${relativePath}: ${match[0]}`);
      }
    }
  }

  if (findings.length > 0) {
    throw new Error(`Static artifact is invalid; unexpected external URL reference(s):\n- ${findings.join('\n- ')}`);
  }
}

async function legacyReferencesFor(relativePath) {
  const sourcePath = sourcePathForArtifactPath(relativePath);
  if (!sourcePath) {
    return new Set();
  }

  try {
    const content = await readFile(path.join(repoRoot, sourcePath), 'utf8');
    return new Set([
      ...content.matchAll(HTTP_URL_PATTERN),
      ...content.matchAll(PROTOCOL_RELATIVE_URL_PATTERN),
    ].map((match) => match[0]));
  } catch {
    return new Set();
  }
}

function sourcePathForArtifactPath(relativePath) {
  if (relativePath.startsWith('game/')) {
    return `apps/game/${relativePath}`;
  }
  if (relativePath.startsWith('LF/')) {
    return `apps/game/${relativePath}`;
  }
  if (relativePath.startsWith('core/')) {
    return `apps/game/${relativePath}`;
  }
  if (relativePath.startsWith('third_party/')) {
    return `apps/game/${relativePath}`;
  }
  if (relativePath.startsWith('LF2_19/')) {
    return `assets/${relativePath.slice('LF2_19/'.length)}`;
  }
  return undefined;
}

async function* walkFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkFiles(entryPath);
    } else if (entry.isFile()) {
      const entryStat = await stat(entryPath);
      if (entryStat.size <= 10 * 1024 * 1024) {
        yield entryPath;
      }
    }
  }
}

if (process.argv[1] === scriptPath) {
  try {
    const { artifactDir } = await checkStatic();
    console.log(`Static artifact is valid at ${path.relative(process.cwd(), artifactDir) || artifactDir}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
