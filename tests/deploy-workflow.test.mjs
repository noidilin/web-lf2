import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const deployDevWorkflow = await readFile(new URL('../.github/workflows/deploy-dev.yml', import.meta.url), 'utf8');
const staticDeployWorkflow = await readFile(new URL('../.github/workflows/deploy-static-dev.yml', import.meta.url), 'utf8');
const lobbyDeployWorkflow = await readFile(new URL('../.github/workflows/deploy-lobby-dev.yml', import.meta.url), 'utf8');
const lobbyDestroyWorkflow = await readFile(new URL('../.github/workflows/destroy-lobby-dev.yml', import.meta.url), 'utf8');

test('dev deployment orchestrator models lobby before static dependency', () => {
  assert.match(deployDevWorkflow, /name: Deploy Dev/);
  assert.match(deployDevWorkflow, /group: deploy-dev/);
  assert.match(deployDevWorkflow, /deploy-lobby-dev:[\s\S]+uses: \.\/\.github\/workflows\/deploy-lobby-dev\.yml/);
  assert.match(deployDevWorkflow, /deploy-static-dev:[\s\S]+needs: deploy-lobby-dev[\s\S]+uses: \.\/\.github\/workflows\/deploy-static-dev\.yml/);
  assert.match(deployDevWorkflow, /orchestrated: true/);
});

test('dev deploy leaves keep standalone dispatches queued', () => {
  for (const workflow of [staticDeployWorkflow, lobbyDeployWorkflow]) {
    assert.match(workflow, /workflow_call:/);
    assert.match(workflow, /workflow_dispatch:/);
    assert.match(workflow, /inputs\.orchestrated/);
    assert.match(workflow, /\|\| 'deploy-dev'/);
    assert.match(workflow, /cancel-in-progress: false/);
  }

  assert.match(lobbyDestroyWorkflow, /group: deploy-dev/);
  assert.match(lobbyDestroyWorkflow, /cancel-in-progress: false/);
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
