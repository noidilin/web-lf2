import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const observabilityMain = await readFile(new URL('../infra/catalog/modules/observability/main.tf', import.meta.url), 'utf8');
const observabilityVars = await readFile(new URL('../infra/catalog/modules/observability/variables.tf', import.meta.url), 'utf8');
const observabilityOutputs = await readFile(new URL('../infra/catalog/modules/observability/outputs.tf', import.meta.url), 'utf8');
const observabilityUnit = await readFile(new URL('../infra/catalog/units/observability/terragrunt.hcl', import.meta.url), 'utf8');
const lobbyMain = await readFile(new URL('../infra/catalog/modules/lobby-service/main.tf', import.meta.url), 'utf8');
const lobbyOutputs = await readFile(new URL('../infra/catalog/modules/lobby-service/outputs.tf', import.meta.url), 'utf8');
const lobbyIndex = await readFile(new URL('../apps/lobby/index.js', import.meta.url), 'utf8');
const lobbyApp = await readFile(new URL('../apps/lobby/lobby.js', import.meta.url), 'utf8');
const docs = await readFile(new URL('../docs/phase/phase-2-aws-baseline.md', import.meta.url), 'utf8');

test('F.Lobby emits structured JSON logs with searchable event fields', () => {
  assert.match(lobbyIndex, /createLogger/);
  assert.match(lobbyIndex, /logger\.info\('lobby_started'/);
  assert.match(lobbyIndex, /logger\.info\('transport_selected'/);
  assert.doesNotMatch(lobbyIndex, /console\.log\('Lobby started at port/);
  assert.match(lobbyApp, /config\.logger/);
  assert.match(lobbyApp, /logger\.info\('room_created'/);
  assert.match(lobbyApp, /logger\.warn\('login_rate_limited'/);
  assert.match(lobbyApp, /logger\.error\('chat_message_error'/);
});

test('lobby log group retention is explicit and exported for observability', () => {
  assert.match(lobbyMain, /resource "aws_cloudwatch_log_group" "lobby"/);
  assert.match(lobbyMain, /retention_in_days\s+=\s+var\.log_retention_days/);
  assert.match(lobbyOutputs, /output "log_group_name"/);
  assert.match(lobbyOutputs, /aws_cloudwatch_log_group\.lobby\.name/);
});

test('observability module defines dashboard widgets and baseline alarms', () => {
  assert.match(observabilityMain, /aws_cloudwatch_dashboard"\s+"baseline"/);
  assert.match(observabilityMain, /CloudFront/);
  assert.match(observabilityMain, /ApplicationELB/);
  assert.match(observabilityMain, /AWS\/ECS/);
  assert.match(observabilityMain, /aws_cloudwatch_metric_alarm"\s+"cloudfront_5xx_rate"/);
  assert.match(observabilityMain, /aws_cloudwatch_metric_alarm"\s+"alb_5xx_count"/);
  assert.match(observabilityMain, /aws_cloudwatch_metric_alarm"\s+"alb_unhealthy_targets"/);
  assert.match(observabilityMain, /aws_cloudwatch_metric_alarm"\s+"ecs_running_task_count"/);
  assert.match(observabilityMain, /aws_cloudwatch_metric_alarm"\s+"lobby_availability"/);
  assert.match(observabilityMain, /treat_missing_data\s+=\s+"breaching"/);
});

test('observability unit consumes static and lobby deployment outputs', () => {
  assert.match(observabilityVars, /variable "cloudfront_distribution_id"/);
  assert.match(observabilityVars, /variable "alb_arn_suffix"/);
  assert.match(observabilityVars, /variable "target_group_arn_suffix"/);
  assert.match(observabilityVars, /variable "ecs_cluster_name"/);
  assert.match(observabilityUnit, /dependency "static_site"/);
  assert.match(observabilityUnit, /dependency "lobby_service"/);
  assert.match(observabilityUnit, /mock_outputs_merge_strategy_with_state\s+=\s+"shallow"/);
  assert.match(observabilityUnit, /cloudfront_distribution_id\s+=\s+dependency\.static_site\.outputs\.cloudfront_distribution_id/);
  assert.match(observabilityUnit, /alb_arn_suffix\s+=\s+dependency\.lobby_service\.outputs\.alb_arn_suffix/);
});

test('documentation explains dashboard sections and alarm meaning', () => {
  assert.match(docs, /## Observability v1/);
  assert.match(docs, /CloudFront delivery/);
  assert.match(docs, /Lobby load balancer/);
  assert.match(docs, /ECS runtime/);
  assert.match(docs, /Lobby availability/);
  assert.match(docs, /cloudfront_5xx_rate/);
  assert.match(docs, /alb_unhealthy_targets/);
  assert.match(docs, /ecs_running_task_count/);
});
