variable "environment" {
  description = "Environment name (dev, prod)"
  type        = string
}

variable "project" {
  description = "Project identifier"
  type        = string
}

variable "name_prefix" {
  description = "Prefix for all resource names"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "cloudfront_distribution_id" {
  description = "CloudFront distribution ID for static game delivery metrics"
  type        = string
  nullable    = false
}

variable "alb_arn_suffix" {
  description = "Application Load Balancer ARN suffix used by CloudWatch metrics"
  type        = string
  nullable    = false
}

variable "target_group_arn_suffix" {
  description = "Target group ARN suffix used by CloudWatch metrics"
  type        = string
  nullable    = false
}

variable "ecs_cluster_name" {
  description = "ECS cluster name for lobby runtime metrics"
  type        = string
  nullable    = false
}

variable "ecs_service_name" {
  description = "ECS service name for lobby runtime metrics"
  type        = string
  nullable    = false
}

variable "lobby_log_group_name" {
  description = "CloudWatch Logs group for structured F.Lobby logs"
  type        = string
  nullable    = false
}

variable "desired_lobby_task_count" {
  description = "Expected running ECS task count for the single-task F.Lobby baseline"
  type        = number
  default     = 1
}

variable "alarm_email" {
  description = "Optional email endpoint subscribed to the regional alarm SNS topic"
  type        = string
  default     = ""
}
