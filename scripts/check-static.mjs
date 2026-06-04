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
const MAX_SCANNED_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const GAME_CONFIG_PATTERN = /<pre id=['"]flf-config['"] style=['"]display:none['"]>\s*(\{[^<]+\})\s*<\/pre>/;
const EXTERNAL_URL_PATTERNS = [
  /http:\/\/[^\s'"<>)]+/g,
  /(?<!:)\/\/[A-Za-z0-9.-]+\.[A-Za-z]{2,}[^\s'"<>)]+/g,
];
const SOURCE_PATH_MAPPINGS = [
  ['game/', 'apps/game/game/'],
  ['LF/', 'apps/game/LF/'],
  ['core/', 'apps/game/core/'],
  ['third_party/', 'apps/game/third_party/'],
  ['LF2_19/', 'assets/'],
];

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
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Static artifact is invalid; flf-config is not valid JSON: ${reason}`);
  }

  if (config.package !== EXPECTED_PACKAGE) {
    throw new Error(
      `Static artifact is invalid; expected game config package to be ${EXPECTED_PACKAGE} but found ${JSON.stringify(config.package)}`,
    );
  }

  if (!config.lobby || typeof config.lobby.url !== 'string') {
    throw new Error('Static artifact is invalid; missing deployed lobby URL in game config');
  }

  const lobbyUrl = new URL(config.lobby.url);
  if (lobbyUrl.protocol !== 'https:') {
    throw new Error(`Static artifact is invalid; deployed lobby URL must use HTTPS: ${config.lobby.url}`);
  }
}

async function assertNoUnexpectedExternalUrls(artifactDir) {
  const findings = [];
  for await (const filePath of walkFiles(artifactDir)) {
    const relativePath = path.relative(artifactDir, filePath).split(path.sep).join('/');
    const content = await readFile(filePath, 'utf8');
    const externalUrls = collectExternalUrls(content);
    const allowedReferences = await legacyReferencesFor(relativePath);

    for (const externalUrl of externalUrls) {
      if (!allowedReferences.has(externalUrl)) {
        findings.push(`${relativePath}: ${externalUrl}`);
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
    return new Set(collectExternalUrls(content));
  } catch {
    return new Set();
  }
}

function sourcePathForArtifactPath(relativePath) {
  for (const [artifactPrefix, sourcePrefix] of SOURCE_PATH_MAPPINGS) {
    if (relativePath.startsWith(artifactPrefix)) {
      return `${sourcePrefix}${relativePath.slice(artifactPrefix.length)}`;
    }
  }

  return undefined;
}

function collectExternalUrls(content) {
  return EXTERNAL_URL_PATTERNS.flatMap((pattern) => [...content.matchAll(pattern)].map((match) => match[0]));
}

async function* walkFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkFiles(entryPath);
    } else if (entry.isFile()) {
      const entryStat = await stat(entryPath);
      if (entryStat.size <= MAX_SCANNED_FILE_SIZE_BYTES) {
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
