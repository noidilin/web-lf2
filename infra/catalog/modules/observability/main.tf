# Observability module — placeholder for Phase 2 slices
#
# This module will create:
# - CloudWatch log groups with retention
# - CloudWatch dashboard (CloudFront, ALB, ECS metrics)
# - CloudWatch alarms (5xx rate, unhealthy targets, ECS restarts)
# - SNS topic for alarm notifications
#
# Resources will be added in the observability implementation issue.

locals {
  _log_group_name  = ""
  _dashboard_name  = ""
  _alarm_topic_arn = ""
}
