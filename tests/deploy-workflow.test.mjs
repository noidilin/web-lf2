import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const ciWorkflow = await readFile(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
const deployDevWorkflow = await readFile(new URL('../.github/workflows/deploy-dev.yml', import.meta.url), 'utf8');
const staticDeployWorkflow = await readFile(new URL('../.github/workflows/deploy-static-dev.yml', import.meta.url), 'utf8');
const lobbyDeployWorkflow = await readFile(new URL('../.github/workflows/deploy-lobby-dev.yml', import.meta.url), 'utf8');
const lobbyDestroyWorkflow = await readFile(new URL('../.github/workflows/destroy-lobby-dev.yml', import.meta.url), 'utf8');
const deployProdWorkflow = await readFile(new URL('../.github/workflows/deploy-prod.yml', import.meta.url), 'utf8');
const staticProdWorkflow = await readFile(new URL('../.github/workflows/deploy-static-prod.yml', import.meta.url), 'utf8');
const lobbyProdWorkflow = await readFile(new URL('../.github/workflows/deploy-lobby-prod.yml', import.meta.url), 'utf8');
const observabilityDeployWorkflow = await readFile(new URL('../.github/workflows/deploy-observability-dev.yml', import.meta.url), 'utf8');
const observabilityProdWorkflow = await readFile(new URL('../.github/workflows/deploy-observability-prod.yml', import.meta.url), 'utf8');

test('CI workflow owns local test concerns before deployment', () => {
  assert.match(ciWorkflow, /name: CI/);
  assert.match(ciWorkflow, /pull_request:/);
  assert.match(ciWorkflow, /static-tests:/);
  assert.match(ciWorkflow, /lobby-tests:/);
  assert.match(ciWorkflow, /workflow-tests:/);
  assert.match(ciWorkflow, /browser-smoke:/);
  assert.match(ciWorkflow, /npm run build:static/);
  assert.match(ciWorkflow, /npm run check:static/);
  assert.match(ciWorkflow, /tests\/build-static\.test\.mjs tests\/check-static\.test\.mjs/);
  assert.match(ciWorkflow, /npm run test:lobby/);
  assert.match(ciWorkflow, /tests\/lobby-hardening\.test\.mjs tests\/lobby-infrastructure\.test\.mjs/);
  assert.match(ciWorkflow, /npx playwright test/);

  for (const workflow of [lobbyDeployWorkflow, lobbyProdWorkflow]) {
    assert.doesNotMatch(workflow, /npm run test:lobby/);
    assert.doesNotMatch(workflow, /tests\/lobby-hardening\.test\.mjs/);
    assert.doesNotMatch(workflow, /Install lobby dependencies/);
  }

  for (const workflow of [staticDeployWorkflow, staticProdWorkflow]) {
    assert.doesNotMatch(workflow, /tests\/build-static\.test\.mjs tests\/check-static\.test\.mjs/);
    assert.doesNotMatch(workflow, /npm run check:static/);
  }
});

test('dev deployment orchestrator models lobby before static dependency', () => {
  assert.match(deployDevWorkflow, /name: Deploy Dev/);
  assert.match(deployDevWorkflow, /group: deploy-dev/);
  assert.match(deployDevWorkflow, /deploy-lobby-dev:[\s\S]+uses: \.\/\.github\/workflows\/deploy-lobby-dev\.yml/);
  assert.match(deployDevWorkflow, /deploy-static-dev:[\s\S]+needs: deploy-lobby-dev[\s\S]+uses: \.\/\.github\/workflows\/deploy-static-dev\.yml/);
  assert.match(deployDevWorkflow, /deploy-observability-dev:[\s\S]+needs: deploy-static-dev[\s\S]+uses: \.\/\.github\/workflows\/deploy-observability-dev\.yml/);
  assert.match(deployDevWorkflow, /infra\/catalog\/modules\/observability\/\*\*/);
  assert.match(deployDevWorkflow, /infra\/catalog\/units\/observability\/\*\*/);
  assert.match(deployDevWorkflow, /\.github\/workflows\/deploy-observability-dev\.yml/);
  assert.match(deployDevWorkflow, /orchestrated: true/);
  assert.doesNotMatch(deployDevWorkflow, /secrets: inherit/);
});

test('dev deploy leaves keep standalone dispatches queued', () => {
  for (const workflow of [staticDeployWorkflow, lobbyDeployWorkflow, observabilityDeployWorkflow]) {
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
  const generateStepIndex = staticDeployWorkflow.indexOf('- name: Prepare Terragrunt stack outputs');
  const getLobbyStepIndex = staticDeployWorkflow.indexOf('- name: Get lobby URL');
  const waitStepIndex = staticDeployWorkflow.indexOf('- name: Wait for deployed lobby');
  const smokeStepIndex = staticDeployWorkflow.indexOf('- name: Run deployed smoke test');

  assert.notEqual(generateStepIndex, -1);
  assert.notEqual(getLobbyStepIndex, -1);
  assert.notEqual(waitStepIndex, -1);
  assert.notEqual(smokeStepIndex, -1);
  assert.ok(generateStepIndex < getLobbyStepIndex);
  assert.ok(waitStepIndex < smokeStepIndex);
  assert.match(staticDeployWorkflow, /terragrunt stack generate --non-interactive/);
  assert.match(staticDeployWorkflow, /terragrunt stack run init --non-interactive/);
  assert.match(staticDeployWorkflow, /--queue-include-dir '\.terragrunt-stack\/lobby-service'/);
  assert.match(staticDeployWorkflow, /\$LOBBY_BASE_URL\/healthz/);
  assert.match(staticDeployWorkflow, /\$LOBBY_BASE_URL\/protocol/);
  assert.match(staticDeployWorkflow, /terragrunt stack output --format raw lobby-service\.lobby_url --non-interactive --queue-include-dir '\.terragrunt-stack\/lobby-service' --queue-strict-include/);
  assert.match(staticDeployWorkflow, /LOBBY_BASE_URL: \$\{\{ steps\.lobby\.outputs\.lobby_url \}\}/);
  assert.doesNotMatch(staticDeployWorkflow, /LOBBY_BASE_URL: https:\/\/dev\.lf2-lobby\.noidilin\.dev/);
});

test('observability deployment applies after app infrastructure outputs exist', () => {
  assert.match(observabilityDeployWorkflow, /name: Deploy Observability Dev/);
  assert.match(observabilityDeployWorkflow, /environment: dev/);
  assert.match(observabilityDeployWorkflow, /role\/devops-web-lf2-dev-github-apply/);
  assert.match(observabilityDeployWorkflow, /working-directory: infra\/live\/dev/);
  assert.match(observabilityDeployWorkflow, /--queue-include-dir '\.terragrunt-stack\/observability'/);
  assert.match(observabilityDeployWorkflow, /--queue-strict-include/);
  assert.match(observabilityDeployWorkflow, /terragrunt stack output --format json observability/);

  assert.match(observabilityProdWorkflow, /name: Deploy Observability Prod/);
  assert.match(observabilityProdWorkflow, /environment: prod/);
  assert.match(observabilityProdWorkflow, /role\/devops-web-lf2-prod-github-apply/);
  assert.match(observabilityProdWorkflow, /working-directory: infra\/live\/prod/);
  assert.match(observabilityProdWorkflow, /--queue-include-dir '\.terragrunt-stack\/observability'/);
});

test('prod deployment is manually dispatched, gated, and deploys lobby before static', () => {
  assert.match(deployProdWorkflow, /name: Deploy Prod/);
  assert.doesNotMatch(deployProdWorkflow, /push:/);
  assert.match(deployProdWorkflow, /workflow_dispatch:/);
  assert.match(deployProdWorkflow, /group: deploy-prod/);
  assert.match(deployProdWorkflow, /cancel-in-progress:\s*false/);
  assert.doesNotMatch(deployProdWorkflow, /secrets: inherit/);
  assert.match(deployProdWorkflow, /deploy-lobby-prod:[\s\S]+uses: \.\/\.github\/workflows\/deploy-lobby-prod\.yml/);
  assert.match(deployProdWorkflow, /deploy-static-prod:[\s\S]+needs: deploy-lobby-prod[\s\S]+uses: \.\/\.github\/workflows\/deploy-static-prod\.yml/);
  assert.match(deployProdWorkflow, /deploy-observability-prod:[\s\S]+needs: deploy-static-prod[\s\S]+uses: \.\/\.github\/workflows\/deploy-observability-prod\.yml/);
});

test('prod reusable deployments target prod stack, roles, endpoints, and protected environment', () => {
  for (const workflow of [staticProdWorkflow, lobbyProdWorkflow, observabilityProdWorkflow]) {
    assert.match(workflow, /workflow_call:/);
    assert.match(workflow, /workflow_dispatch:/);
    assert.match(workflow, /environment: prod/);
    assert.match(workflow, /role\/devops-web-lf2-prod-github-apply/);
    assert.match(workflow, /working-directory: infra\/live\/prod/);
    assert.match(workflow, /\|\| 'deploy-prod'/);
    assert.match(workflow, /cancel-in-progress: false/);
  }

  assert.match(staticProdWorkflow, /terragrunt stack generate --non-interactive/);
  assert.match(staticProdWorkflow, /terragrunt stack run init --non-interactive/);
  assert.match(staticProdWorkflow, /terragrunt stack output --format raw lobby-service\.lobby_url --non-interactive --queue-include-dir '\.terragrunt-stack\/lobby-service' --queue-strict-include/);
  assert.match(staticProdWorkflow, /LOBBY_BASE_URL: \$\{\{ steps\.lobby\.outputs\.lobby_url \}\}/);
  assert.doesNotMatch(staticProdWorkflow, /LOBBY_BASE_URL: https:\/\/lf2-lobby\.noidilin\.dev/);
  assert.match(staticProdWorkflow, /LOBBY_NAME: Prod F\.Lobby/);
  assert.match(staticProdWorkflow, /npx playwright test --config playwright\.deployed\.config\.mjs/);
  assert.match(lobbyProdWorkflow, /Run deployed lobby contract checks/);
});
