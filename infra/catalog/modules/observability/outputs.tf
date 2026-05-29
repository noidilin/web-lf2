output "log_group_name" {
  description = "Name of the main CloudWatch log group"
  value       = local._log_group_name
}

output "dashboard_name" {
  description = "Name of the CloudWatch dashboard"
  value       = local._dashboard_name
}

output "alarm_topic_arn" {
  description = "ARN of the SNS topic for alarm notifications"
  value       = local._alarm_topic_arn
}
