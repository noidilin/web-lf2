import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const lobbyMain = await readFile(new URL('../infra/catalog/modules/lobby-service/main.tf', import.meta.url), 'utf8');
const lobbyVars = await readFile(new URL('../infra/catalog/modules/lobby-service/variables.tf', import.meta.url), 'utf8');
const lobbyUnit = await readFile(new URL('../infra/catalog/units/lobby-service/terragrunt.hcl', import.meta.url), 'utf8');
const deployWorkflow = await readFile(new URL('../.github/workflows/deploy-lobby.yml', import.meta.url), 'utf8');

test('lobby infrastructure exposes F.Lobby through ECS Fargate behind HTTPS ALB', () => {
  assert.match(lobbyMain, /aws_ecr_repository"\s+"lobby"/);
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

test('lobby module consumes networking outputs instead of public task networking', () => {
  assert.match(lobbyVars, /variable "vpc_id"/);
  assert.match(lobbyVars, /nullable\s+=\s+false/);
  assert.match(lobbyUnit, /dependency "networking"/);
  assert.match(lobbyUnit, /vpc_id\s+=\s+dependency\.networking\.outputs\.vpc_id/);
  assert.match(lobbyUnit, /private_subnet_ids\s+=\s+dependency\.networking\.outputs\.private_subnet_ids/);
  assert.match(lobbyUnit, /public_subnet_ids\s+=\s+dependency\.networking\.outputs\.public_subnet_ids/);
});

test('deploy lobby workflow builds, pushes, rolls out, and checks the deployed contract', () => {
  assert.match(deployWorkflow, /name: Deploy Lobby/);
  assert.match(deployWorkflow, /docker build/);
  assert.match(deployWorkflow, /aws ecr get-login-password/);
  assert.match(deployWorkflow, /docker push/);
  assert.match(deployWorkflow, /terragrunt stack run apply/);
  assert.match(deployWorkflow, /aws ecs update-service/);
  assert.match(deployWorkflow, /aws ecs wait services-stable/);
  assert.match(deployWorkflow, /tests\/deployed-lobby-contract\.test\.mjs/);
});
