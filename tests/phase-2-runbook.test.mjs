import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const runbook = await readFile(new URL('../docs/phase/phase-2-runbook.md', import.meta.url), 'utf8');

test('Phase 2 runbook covers deployment validation and planning', () => {
  assert.match(runbook, /## Validate and plan infrastructure changes/);
  assert.match(runbook, /terragrunt hcl format --check --diff/);
  assert.match(runbook, /terragrunt stack run validate --non-interactive/);
  assert.match(runbook, /terragrunt stack run plan --non-interactive/);
  assert.match(runbook, /deployment-identity/);
});

test('Phase 2 runbook covers dev and prod deployments', () => {
  assert.match(runbook, /## Deploy dev/);
  assert.match(runbook, /\.github\/workflows\/deploy-dev\.yml/);
  assert.match(runbook, /## Deploy prod/);
  assert.match(runbook, /\.github\/workflows\/deploy-prod\.yml/);
  assert.match(runbook, /Deploy Lobby Prod/);
  assert.match(runbook, /Deploy Static Site Prod/);
});

test('Phase 2 runbook covers local and deployed smoke tests', () => {
  assert.match(runbook, /## Local smoke tests/);
  assert.match(runbook, /npm run build:static/);
  assert.match(runbook, /npm run test:e2e/);
  assert.match(runbook, /## Deployed smoke tests/);
  assert.match(runbook, /tests\/deployed-lobby-contract\.test\.mjs/);
  assert.match(runbook, /playwright\.deployed\.config\.mjs/);
});

test('Phase 2 runbook covers observability and portfolio scope', () => {
  assert.match(runbook, /## Operate the dashboard and alarms/);
  assert.match(runbook, /CloudFront delivery/);
  assert.match(runbook, /Lobby load balancer/);
  assert.match(runbook, /ecs_running_task_count/);
  assert.match(runbook, /## Completed portfolio architecture/);
  assert.match(runbook, /## Out of scope for Phase 2 follow-up/);
  assert.match(runbook, /Redis or ElastiCache/);
  assert.match(runbook, /EKS\/Kubernetes/);
});
