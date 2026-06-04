import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const deployDevWorkflow = await readFile(new URL('../.github/workflows/deploy-dev.yml', import.meta.url), 'utf8');
const staticDeployWorkflow = await readFile(new URL('../.github/workflows/deploy-static-dev.yml', import.meta.url), 'utf8');
const lobbyDeployWorkflow = await readFile(new URL('../.github/workflows/deploy-lobby-dev.yml', import.meta.url), 'utf8');
const lobbyDestroyWorkflow = await readFile(new URL('../.github/workflows/destroy-lobby-dev.yml', import.meta.url), 'utf8');
const deployProdWorkflow = await readFile(new URL('../.github/workflows/deploy-prod.yml', import.meta.url), 'utf8');
const staticProdWorkflow = await readFile(new URL('../.github/workflows/deploy-static-prod.yml', import.meta.url), 'utf8');
const lobbyProdWorkflow = await readFile(new URL('../.github/workflows/deploy-lobby-prod.yml', import.meta.url), 'utf8');

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

test('prod deployment is manually dispatched, gated, and deploys lobby before static', () => {
  assert.match(deployProdWorkflow, /name: Deploy Prod/);
  assert.doesNotMatch(deployProdWorkflow, /push:/);
  assert.match(deployProdWorkflow, /workflow_dispatch:/);
  assert.match(deployProdWorkflow, /group: deploy-prod/);
  assert.match(deployProdWorkflow, /deploy-lobby-prod:[\s\S]+uses: \.\/\.github\/workflows\/deploy-lobby-prod\.yml/);
  assert.match(deployProdWorkflow, /deploy-static-prod:[\s\S]+needs: deploy-lobby-prod[\s\S]+uses: \.\/\.github\/workflows\/deploy-static-prod\.yml/);
});

test('prod reusable deployments target prod stack, roles, endpoints, and protected environment', () => {
  for (const workflow of [staticProdWorkflow, lobbyProdWorkflow]) {
    assert.match(workflow, /workflow_call:/);
    assert.match(workflow, /workflow_dispatch:/);
    assert.match(workflow, /environment: prod/);
    assert.match(workflow, /role\/devops-web-lf2-prod-github-apply/);
    assert.match(workflow, /working-directory: infra\/live\/prod/);
    assert.match(workflow, /\|\| 'deploy-prod'/);
    assert.match(workflow, /cancel-in-progress: false/);
  }

  assert.match(staticProdWorkflow, /LOBBY_BASE_URL: https:\/\/lf2-lobby\.noidilin\.dev/);
  assert.match(staticProdWorkflow, /LOBBY_NAME: Prod F\.Lobby/);
  assert.match(staticProdWorkflow, /npx playwright test --config playwright\.deployed\.config\.mjs/);
  assert.match(lobbyProdWorkflow, /Run deployed lobby contract checks/);
});
