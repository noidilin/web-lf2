import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const staticDeployWorkflow = await readFile(new URL('../.github/workflows/deploy-static.yml', import.meta.url), 'utf8');
const lobbyDeployWorkflow = await readFile(new URL('../.github/workflows/deploy-lobby-dev.yml', import.meta.url), 'utf8');
const lobbyDestroyWorkflow = await readFile(new URL('../.github/workflows/destroy-lobby-dev.yml', import.meta.url), 'utf8');

test('dev deployment workflows share one concurrency queue', () => {
  for (const workflow of [staticDeployWorkflow, lobbyDeployWorkflow, lobbyDestroyWorkflow]) {
    assert.match(workflow, /group: deploy-dev/);
    assert.match(workflow, /cancel-in-progress: false/);
  }
});

test('static deployment waits for deployed lobby readiness before browser smoke', () => {
  const waitStepIndex = staticDeployWorkflow.indexOf('- name: Wait for deployed lobby');
  const smokeStepIndex = staticDeployWorkflow.indexOf('- name: Run deployed smoke test');

  assert.notEqual(waitStepIndex, -1);
  assert.notEqual(smokeStepIndex, -1);
  assert.ok(waitStepIndex < smokeStepIndex);
  assert.match(staticDeployWorkflow, /\$LOBBY_BASE_URL\/healthz/);
  assert.match(staticDeployWorkflow, /\$LOBBY_BASE_URL\/protocol/);
});
