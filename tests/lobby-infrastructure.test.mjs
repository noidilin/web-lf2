import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const lobbyMain = await readFile(new URL('../infra/catalog/modules/lobby-service/main.tf', import.meta.url), 'utf8');
const lobbyVars = await readFile(new URL('../infra/catalog/modules/lobby-service/variables.tf', import.meta.url), 'utf8');
const lobbyBootstrapMain = await readFile(new URL('../infra/catalog/modules/lobby-bootstrap/main.tf', import.meta.url), 'utf8');
const deploymentIdentityMain = await readFile(new URL('../infra/catalog/modules/deployment-identity/main.tf', import.meta.url), 'utf8');
const lobbyUnit = await readFile(new URL('../infra/catalog/units/lobby-service/terragrunt.hcl', import.meta.url), 'utf8');
const devStack = await readFile(new URL('../infra/live/dev/terragrunt.stack.hcl', import.meta.url), 'utf8');
const prodStack = await readFile(new URL('../infra/live/prod/terragrunt.stack.hcl', import.meta.url), 'utf8');
const deployWorkflow = await readFile(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8');
const deployLobbyAction = await readFile(new URL('../.github/actions/deploy-lobby/action.yml', import.meta.url), 'utf8');
const deploymentAutomation = `${deployWorkflow}\n${deployLobbyAction}`;

test('lobby infrastructure exposes F.Lobby through ECS Fargate behind HTTPS ALB', () => {
  assert.match(lobbyBootstrapMain, /aws_ecr_repository"\s+"lobby"/);
  assert.match(lobbyBootstrapMain, /image_tag_mutability\s+=\s+"IMMUTABLE_WITH_EXCLUSION"/);
  assert.match(lobbyBootstrapMain, /image_tag_mutability_exclusion_filter[\s\S]+filter\s+=\s+"dev"[\s\S]+filter_type\s+=\s+"WILDCARD"/);
  assert.match(lobbyBootstrapMain, /image_tag_mutability_exclusion_filter[\s\S]+filter\s+=\s+"prod"[\s\S]+filter_type\s+=\s+"WILDCARD"/);
  assert.doesNotMatch(lobbyMain, /aws_ecr_repository"\s+"lobby"/);
  assert.match(lobbyMain, /aws_ecs_cluster"\s+"lobby"/);
  assert.match(lobbyMain, /aws_ecs_task_definition"\s+"lobby"/);
  assert.match(lobbyMain, /requires_compatibilities\s+=\s+\["FARGATE"\]/);
  assert.match(lobbyMain, /network_mode\s+=\s+"awsvpc"/);
  assert.match(lobbyMain, /aws_ecs_service"\s+"lobby"/);
  assert.match(lobbyMain, /desired_count\s+=\s+1/);
  assert.match(lobbyMain, /launch_type\s+=\s+"FARGATE"/);
  assert.match(lobbyMain, /assign_public_ip\s+=\s+false/);
  assert.match(lobbyMain, /aws_lb"\s+"lobby"/);
  assert.match(lobbyMain, /aws_lb_listener"\s+"https"/);
  assert.match(lobbyMain, /protocol\s+=\s+"HTTPS"/);
});

test('lobby infrastructure uses the health endpoint and safe ECS deployment defaults', () => {
  assert.match(lobbyMain, /path\s+=\s+"\/healthz"/);
  assert.match(lobbyMain, /health_check_grace_period_seconds/);
  assert.match(lobbyMain, /deployment_circuit_breaker/);
  assert.match(lobbyMain, /rollback\s+=\s+true/);
  assert.match(lobbyMain, /deregistration_delay\s+=\s+30/);
  assert.match(lobbyMain, /aws_cloudwatch_log_group"\s+"lobby"/);
  assert.match(lobbyMain, /AmazonECSTaskExecutionRolePolicy/);
});

test('lobby ECR lifecycle keeps SHA cleanup safe for environment aliases', () => {
  assert.match(lobbyBootstrapMain, /aws_ecr_lifecycle_policy"\s+"lobby"/);
  assert.match(lobbyBootstrapMain, /description\s+=\s+"Protect environment alias images from SHA cleanup"/);
  assert.match(lobbyBootstrapMain, /tagPrefixList\s+=\s+\["dev", "prod"\]/);
  assert.match(lobbyBootstrapMain, /description\s+=\s+"Keep the most recent 20 SHA-tagged lobby images"/);
  assert.match(lobbyBootstrapMain, /tagPrefixList\s+=\s+\["sha-"\]/);
  assert.match(lobbyBootstrapMain, /countNumber\s+=\s+20/);
  assert.match(lobbyBootstrapMain, /tagStatus\s+=\s+"untagged"/);
  assert.match(lobbyBootstrapMain, /countUnit\s+=\s+"days"/);
});

test('deployment identity can manage ECR aliases and tag-mutability exclusions', () => {
  assert.match(deploymentIdentityMain, /"ecr:BatchGetImage"/);
  assert.match(deploymentIdentityMain, /"ecr:PutImage"/);
  assert.match(deploymentIdentityMain, /"ecr:PutImageTagMutability"/);
  assert.match(deploymentIdentityMain, /"ecr:PutLifecyclePolicy"/);
});

test('lobby module consumes networking outputs instead of public task networking', () => {
  assert.match(lobbyVars, /variable "vpc_id"/);
  assert.match(lobbyVars, /nullable\s+=\s+false/);
  assert.match(lobbyVars, /variable "image_tag"/);
  assert.match(lobbyVars, /nullable\s+=\s+true/);
  assert.match(lobbyVars, /default\s+=\s+null/);
  assert.match(lobbyVars, /var\.image_tag == null/);
  assert.match(lobbyVars, /\^sha-\[0-9a-f\]\{40\}\$/);
  assert.match(lobbyMain, /zero_sha_image_tag\s+=\s+"sha-0{40}"/);
  assert.match(lobbyMain, /selected_image_tag\s+=\s+coalesce\(var\.image_tag, local\.zero_sha_image_tag\)/);
  assert.match(lobbyMain, /image\s+=\s+"\$\{var\.ecr_repository_url\}:\$\{local\.selected_image_tag\}"/);
  assert.match(lobbyMain, /condition\s+=\s+can\(regex\("\^sha-\[0-9a-f\]\{40\}\$", local\.selected_image_tag\)\)/);
  assert.doesNotMatch(lobbyMain, /local\.selected_image_tag != local\.zero_sha_image_tag/);
  assert.doesNotMatch(lobbyVars, /default\s+=\s+"latest"/);
  for (const stack of [devStack, prodStack]) {
    assert.match(stack, /lobby_image_tag\s+=\s+get_env\("LOBBY_IMAGE_TAG", "sha-0{40}"\)/);
    assert.match(stack, /image_tag\s+=\s+local\.lobby_image_tag/);
  }

  assert.match(lobbyUnit, /dependency "networking"/);
  assert.match(lobbyUnit, /dependency "lobby_bootstrap"/);
  assert.match(lobbyUnit, /image_tag\s+=\s+values\.image_tag/);
  assert.match(lobbyUnit, /ecr_repository_url\s+=\s+dependency\.lobby_bootstrap\.outputs\.ecr_repository_url/);
  assert.match(lobbyUnit, /vpc_id\s+=\s+dependency\.networking\.outputs\.vpc_id/);
  assert.match(lobbyUnit, /private_subnet_ids\s+=\s+dependency\.networking\.outputs\.private_subnet_ids/);
  assert.match(lobbyUnit, /public_subnet_ids\s+=\s+dependency\.networking\.outputs\.public_subnet_ids/);
});

test('deploy workflow builds, pushes, rolls out, and checks the deployed lobby contract', () => {
  assert.match(deployWorkflow, /name: Deploy/);
  assert.match(deploymentAutomation, /lobby-bootstrap/);
  assert.doesNotMatch(deploymentAutomation, /-target=aws_ecr_repository\.lobby/);
  assert.match(deployWorkflow, /format\('sha-\{0\}', github\.sha\)/);
  assert.match(deployWorkflow, /uses: \.\/\.github\/actions\/deploy-lobby/);
  assert.match(deployLobbyAction, /if: \$\{\{ inputs\.target-environment == 'dev' \}\}[\s\S]+docker build/);
  assert.match(deployLobbyAction, /:\$\{\{ inputs\.lobby-image-tag \}\}/);
  assert.match(deployLobbyAction, /aws ecr get-login-password/);
  assert.match(deployLobbyAction, /aws ecr describe-images/);
  assert.match(deployLobbyAction, /docker push/);
  assert.match(deployLobbyAction, /aws ecr batch-get-image/);
  assert.match(deployLobbyAction, /aws ecr put-image[\s\S]+--image-tag "\$\{TARGET_ENVIRONMENT\}"/);
  assert.match(deployLobbyAction, /terragrunt stack run apply/);
  assert.doesNotMatch(deploymentAutomation, /:latest/);
  assert.doesNotMatch(deploymentAutomation, /aws ecs update-service/);
  assert.doesNotMatch(deploymentAutomation, /force-new-deployment/);
  assert.match(deployLobbyAction, /aws ecs wait services-stable/);
  assert.match(deployLobbyAction, /tests\/deployed-lobby-contract\.test\.mjs/);
});
