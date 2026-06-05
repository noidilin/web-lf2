output "log_group_name" {
  description = "Name of the F.Lobby CloudWatch Logs log group shown by observability"
  value       = var.lobby_log_group_name
}

output "dashboard_name" {
  description = "Name of the CloudWatch dashboard"
  value       = aws_cloudwatch_dashboard.baseline.dashboard_name
}

output "alarm_topic_arn" {
  description = "ARN of the regional SNS topic for alarm notifications"
  value       = aws_sns_topic.regional_alarms.arn
}

output "cloudfront_alarm_topic_arn" {
  description = "ARN of the us-east-1 SNS topic for CloudFront alarm notifications"
  value       = aws_sns_topic.global_alarms.arn
}

output "alarm_names" {
  description = "Names of baseline CloudWatch alarms"
  value = {
    cloudfront_5xx_rate    = aws_cloudwatch_metric_alarm.cloudfront_5xx_rate.alarm_name
    alb_5xx_count          = aws_cloudwatch_metric_alarm.alb_5xx_count.alarm_name
    alb_unhealthy_targets  = aws_cloudwatch_metric_alarm.alb_unhealthy_targets.alarm_name
    ecs_running_task_count = aws_cloudwatch_metric_alarm.ecs_running_task_count.alarm_name
    lobby_availability     = aws_cloudwatch_metric_alarm.lobby_availability.alarm_name
  }
}
