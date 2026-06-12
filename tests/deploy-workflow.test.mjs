import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { test } from 'node:test';

const ciWorkflow = await readFile(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
const rootPackage = await readFile(new URL('../package.json', import.meta.url), 'utf8');
const pnpmWorkspace = await readFile(new URL('../pnpm-workspace.yaml', import.meta.url), 'utf8');
const pnpmLockfile = await readFile(new URL('../pnpm-lock.yaml', import.meta.url), 'utf8');
const lobbyPackage = await readFile(new URL('../apps/lobby/package.json', import.meta.url), 'utf8');
const lobbyDockerfile = await readFile(new URL('../apps/lobby/Dockerfile', import.meta.url), 'utf8');
const lobbyDockerSmokeScript = await readFile(new URL('../apps/lobby/scripts/docker-smoke.mjs', import.meta.url), 'utf8');
const deployWorkflow = await readFile(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8');
const terraformPlanWorkflow = await readFile(new URL('../.github/workflows/terraform-plan-pr.yml', import.meta.url), 'utf8');
const deploymentIdentity = await readFile(new URL('../infra/catalog/modules/deployment-identity/main.tf', import.meta.url), 'utf8');
const lobbyTestMarker = '/tmp/f-lobby-test-stage-success';
const lobbyProductionMarker = '/app/.f-lobby-test-stage-success';

const legacyDeployWorkflowPaths = [
  '../.github/workflows/deploy-dev.yml',
  '../.github/workflows/deploy-prod.yml',
  '../.github/workflows/deploy-lobby-dev.yml',
  '../.github/workflows/deploy-lobby-prod.yml',
  '../.github/workflows/deploy-static-dev.yml',
  '../.github/workflows/deploy-static-prod.yml',
  '../.github/workflows/deploy-observability-dev.yml',
  '../.github/workflows/deploy-observability-prod.yml',
];

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
  assert.match(ciWorkflow, /npm run test:lobby:image/);
  assert.match(ciWorkflow, /npm run test:lobby/);
  assert.match(ciWorkflow, /tests\/lobby-hardening\.test\.mjs tests\/lobby-infrastructure\.test\.mjs/);
  assert.match(ciWorkflow, /npx playwright test/);
});

test('lobby Dockerfile exposes a test-gated production image', () => {
  assert.match(rootPackage, /"test:lobby:image": "docker build --target test apps\/lobby"/);
  assert.match(lobbyDockerfile, /FROM runtime-deps AS test/);
  assert.match(lobbyPackage, /"test:docker-smoke": "node scripts\/docker-smoke\.mjs"/);
  assert.match(lobbyDockerfile, /node --check index\.js/);
  assert.match(lobbyDockerfile, /node --check lobby\.js/);
  assert.match(lobbyDockerfile, /node --check scripts\/docker-smoke\.mjs/);
  assert.match(lobbyDockerfile, /npm run test:docker-smoke/);
  assert.match(lobbyDockerSmokeScript, /\/healthz/);
  assert.match(lobbyDockerSmokeScript, /\/protocol/);
  assert.match(lobbyDockerSmokeScript, /spawn\(process\.execPath, \['index\.js'\]/);
  assert.match(lobbyDockerSmokeScript, /server\.kill\('SIGTERM'\)/);
  assert.match(lobbyDockerfile, /FROM runtime-deps AS production/);
  assert.match(lobbyDockerfile, new RegExp(`> ${escapeRegExp(lobbyTestMarker)}`));
  assert.match(
    lobbyDockerfile,
    new RegExp(`COPY --from=test ${escapeRegExp(lobbyTestMarker)} ${escapeRegExp(lobbyProductionMarker)}`),
  );
  assert.match(lobbyDockerfile, new RegExp(`test -s ${escapeRegExp(lobbyProductionMarker)}`));

  const markerIndex = lobbyDockerfile.indexOf(lobbyTestMarker);
  assert.ok(lobbyDockerfile.indexOf('node --check index.js') < markerIndex);
  assert.ok(lobbyDockerfile.indexOf('node --check lobby.js') < markerIndex);
  assert.ok(lobbyDockerfile.indexOf('npm run test:docker-smoke') < markerIndex);
  assert.ok(lobbyDockerfile.indexOf('FROM runtime-deps AS production') < lobbyDockerfile.indexOf('COPY --from=test'));
});

test('deploy workflow is the environment-parameterized deployment entrypoint', () => {
  assert.match(deployWorkflow, /name: Deploy/);
  assert.match(deployWorkflow, /push:[\s\S]+branches: \[main\]/);
  assert.match(deployWorkflow, /workflow_dispatch:[\s\S]+environment:[\s\S]+type: choice[\s\S]+- dev[\s\S]+- prod/);
  assert.match(deployWorkflow, /lobby_image_tag:/);
  assert.match(deployWorkflow, /group: deploy-\$\{\{ github\.event_name == 'workflow_dispatch' && inputs\.environment \|\| 'dev' \}\}/);
  assert.match(deployWorkflow, /cancel-in-progress:\s*false/);
  assert.match(deployWorkflow, /id-token: write/);
  assert.match(deployWorkflow, /contents: read/);
  assert.match(deployWorkflow, /\.github\/workflows\/deploy\.yml/);
  assert.match(deployWorkflow, /pnpm-workspace\.yaml/);
  assert.doesNotMatch(deployWorkflow, /deploy-lobby-(?:dev|prod)\.yml/);
  assert.doesNotMatch(deployWorkflow, /orchestrated/);
});

test('resolve-environment maps dev and prod explicitly', () => {
  assert.match(deployWorkflow, /resolve-environment:/);
  assert.match(deployWorkflow, /case "\$REQUESTED_ENV" in/);
  assert.match(deployWorkflow, /dev\)[\s\S]+infra_dir=infra\/live\/dev[\s\S]+aws_region=ap-northeast-1[\s\S]+devops-web-lf2-dev-github-plan[\s\S]+devops-web-lf2-dev-github-apply/);
  assert.match(deployWorkflow, /prod\)[\s\S]+infra_dir=infra\/live\/prod[\s\S]+aws_region=ap-northeast-1[\s\S]+devops-web-lf2-prod-github-plan[\s\S]+devops-web-lf2-prod-github-apply/);
  assert.match(deployWorkflow, /Unsupported deployment environment/);
});

test('preflight installs lobby workspace dependencies for app checks before deploy', () => {
  assert.match(pnpmWorkspace, /packages:\n\s+- apps\/lobby/);
  assert.match(pnpmLockfile, /apps\/lobby:[\s\S]+ws:[\s\S]+specifier: ~0\.4\.25/);
  assert.match(deployWorkflow, /preflight:[\s\S]+needs: resolve-environment/);
  assert.match(deployWorkflow, /role-to-assume: \$\{\{ needs\.resolve-environment\.outputs\.plan_role_arn \}\}/);
  assert.match(deployWorkflow, /pnpm install --frozen-lockfile/);
  assert.match(deployWorkflow, /npm run build:static/);
  assert.match(deployWorkflow, /npm run check:static/);
  assert.match(deployWorkflow, /tests\/deploy-workflow\.test\.mjs/);
  assert.match(deployWorkflow, /terragrunt hcl format --check --diff --working-dir infra/);
  assert.match(deployWorkflow, /terraform fmt -check -diff -recursive infra\/catalog\/modules/);
  assert.match(deployWorkflow, /terragrunt stack run validate --non-interactive --tf-forward-stdout/);
  assert.match(deployWorkflow, /terragrunt stack run plan --non-interactive --tf-forward-stdout/);
  assert.match(deployWorkflow, /--queue-exclude-dir '\.terragrunt-stack\/deployment-identity'/);
});

test('deploy job is GitHub Environment-bound and applies lobby before static before observability', () => {
  assert.match(deployWorkflow, /deploy:[\s\S]+environment: \$\{\{ needs\.resolve-environment\.outputs\.environment \}\}/);
  assert.match(deployWorkflow, /role-to-assume: \$\{\{ needs\.resolve-environment\.outputs\.apply_role_arn \}\}/);

  const lobbyIndex = deployWorkflow.indexOf('- name: Terragrunt apply lobby service');
  const staticIndex = deployWorkflow.indexOf('- name: Terragrunt apply static site');
  const observabilityIndex = deployWorkflow.indexOf('- name: Terragrunt apply observability');
  assert.notEqual(lobbyIndex, -1);
  assert.notEqual(staticIndex, -1);
  assert.notEqual(observabilityIndex, -1);
  assert.ok(lobbyIndex < staticIndex);
  assert.ok(staticIndex < observabilityIndex);
});

test('dev deployment builds and pushes immutable SHA-tagged artifacts', () => {
  assert.match(deployWorkflow, /LOBBY_IMAGE_TAG:\s+\$\{\{ needs\.resolve-environment\.outputs\.environment == 'prod' && github\.event_name == 'workflow_dispatch' && inputs\.lobby_image_tag \|\| format\('sha-\{0\}', github\.sha\) \}\}/);
  assert.match(deployWorkflow, /- name: Build lobby image[\s\S]+if: env\.TARGET_ENVIRONMENT == 'dev'[\s\S]+docker build/);
  assert.match(deployWorkflow, /--tag "\$\{\{ steps\.outputs\.outputs\.ecr_repository_url \}\}:\$\{\{ env\.LOBBY_IMAGE_TAG \}\}"/);
  assert.match(deployWorkflow, /aws ecr get-login-password/);
  assert.match(deployWorkflow, /aws ecr describe-images/);
  assert.match(deployWorkflow, /docker push "\$\{\{ steps\.outputs\.outputs\.ecr_repository_url \}\}:\$\{\{ env\.LOBBY_IMAGE_TAG \}\}"/);
  assert.doesNotMatch(deployWorkflow, /:latest/);
  assert.doesNotMatch(deployWorkflow, /aws ecs update-service/);
  assert.doesNotMatch(deployWorkflow, /force-new-deployment/);
});

test('prod promotion verifies an existing SHA-tagged artifact without rebuilding', () => {
  assert.match(deployWorkflow, /Validate prod lobby image tag[\s\S]+\^sha-\[0-9a-f\]\{40\}\$/);
  assert.match(deployWorkflow, /Verify promoted image exists in ECR[\s\S]+aws ecr describe-images[\s\S]+--image-ids "imageTag=\$\{LOBBY_IMAGE_TAG\}"/);
  assert.match(deployWorkflow, /Promote lobby image alias[\s\S]+aws ecr batch-get-image[\s\S]+--image-ids "imageTag=\$\{LOBBY_IMAGE_TAG\}"[\s\S]+aws ecr put-image[\s\S]+--image-tag "\$\{TARGET_ENVIRONMENT\}"/);

  assert.match(deployWorkflow, /- name: Build lobby image[\s\S]+if: env\.TARGET_ENVIRONMENT == 'dev'/);
  assert.match(deployWorkflow, /- name: Push lobby image[\s\S]+if: env\.TARGET_ENVIRONMENT == 'dev'/);
  assert.match(deployWorkflow, /- name: Verify promoted image exists in ECR[\s\S]+if: env\.TARGET_ENVIRONMENT == 'prod'/);
});

test('static deployment uses deployed lobby URL before smoke tests', () => {
  const generateStepIndex = deployWorkflow.indexOf('- name: Prepare Terragrunt stack outputs');
  const getLobbyStepIndex = deployWorkflow.indexOf('- name: Get lobby URL');
  const waitStepIndex = deployWorkflow.indexOf('- name: Wait for deployed lobby');
  const smokeStepIndex = deployWorkflow.indexOf('- name: Run deployed smoke test');

  assert.notEqual(generateStepIndex, -1);
  assert.notEqual(getLobbyStepIndex, -1);
  assert.notEqual(waitStepIndex, -1);
  assert.notEqual(smokeStepIndex, -1);
  assert.ok(generateStepIndex < getLobbyStepIndex);
  assert.ok(waitStepIndex < smokeStepIndex);
  assert.match(deployWorkflow, /terragrunt stack generate --non-interactive/);
  assert.match(deployWorkflow, /terragrunt stack run init --non-interactive/);
  assert.match(deployWorkflow, /terragrunt stack output --format raw lobby-service\.lobby_url --non-interactive --queue-include-dir '\.terragrunt-stack\/lobby-service' --queue-strict-include/);
  assert.match(deployWorkflow, /LOBBY_BASE_URL: \$\{\{ steps\.lobby\.outputs\.lobby_url \}\}/);
  assert.match(deployWorkflow, /\$LOBBY_BASE_URL\/healthz/);
  assert.match(deployWorkflow, /\$LOBBY_BASE_URL\/protocol/);
  assert.doesNotMatch(deployWorkflow, /LOBBY_BASE_URL: https:\/\//);
  assert.doesNotMatch(deployWorkflow, /LOBBY_NAME/);
});

test('terraform plan workflow uses explicit matrix and sticky artifact-backed comments', () => {
  assert.equal(existsSync(new URL('../.github/workflows/terraform-plan.yml', import.meta.url)), false);
  assert.match(terraformPlanWorkflow, /name: Terraform Plan/);
  assert.match(terraformPlanWorkflow, /\.github\/workflows\/terraform-plan-pr\.yml/);
  assert.match(terraformPlanWorkflow, /matrix:[\s\S]+include:[\s\S]+environment: dev[\s\S]+infra_dir: infra\/live\/dev[\s\S]+devops-web-lf2-dev-github-plan/);
  assert.match(terraformPlanWorkflow, /environment: prod[\s\S]+infra_dir: infra\/live\/prod[\s\S]+devops-web-lf2-prod-github-plan/);
  assert.match(terraformPlanWorkflow, /LOBBY_IMAGE_TAG:\s+sha-\$\{\{ github\.sha \}\}/);
  assert.match(terraformPlanWorkflow, /PLAN_FILE: \$\{\{ runner\.temp \}\}\/\$\{\{ matrix\.environment \}\}-plan\.txt/);
  assert.match(terraformPlanWorkflow, /name: \$\{\{ matrix\.environment \}\}-terraform-plan/);
  assert.match(terraformPlanWorkflow, /web-lf2-terraform-plan:\$\{process\.env\.ENVIRONMENT\}/);
  assert.match(terraformPlanWorkflow, /updateComment/);
  assert.match(terraformPlanWorkflow, /createComment/);
  assert.doesNotMatch(terraformPlanWorkflow, /sha-0{40}/);
});

test('plan role trust is limited to pull requests and main branch only', () => {
  assert.doesNotMatch(deploymentIdentity, /ForAnyValue:StringEquals/);
  assert.match(deploymentIdentity, /StringEquals\s*=\s*\{[\s\S]+token\.actions\.githubusercontent\.com:aud[\s\S]+token\.actions\.githubusercontent\.com:sub/);
  assert.match(deploymentIdentity, /repo:\$\{var\.github_repo\}:pull_request/);
  assert.match(deploymentIdentity, /repo:\$\{var\.github_repo\}:ref:refs\/heads\/main/);
  assert.match(deploymentIdentity, /repo:\$\{var\.github_repo\}:environment:\$\{var\.environment\}/);
  assert.doesNotMatch(deploymentIdentity, /repo:\$\{var\.github_repo\}:ref:refs\/heads\/\*/);
});

test('legacy environment and component deployment workflows are removed', () => {
  for (const path of legacyDeployWorkflowPaths) {
    assert.equal(existsSync(new URL(path, import.meta.url)), false, `${path} should be removed`);
  }
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
