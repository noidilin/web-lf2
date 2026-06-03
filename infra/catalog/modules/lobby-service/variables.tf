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

variable "account_id" {
  description = "AWS account ID"
  type        = string
}

variable "hosted_zone_name" {
  description = "Route 53 hosted zone name"
  type        = string
}

variable "lobby_domain" {
  description = "Full domain for the lobby (e.g. dev.lf2-lobby.noidilin.dev)"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID for the lobby service"
  type        = string
  nullable    = false
}

variable "public_subnet_ids" {
  description = "Public subnet IDs for the ALB"
  type        = list(string)
  nullable    = false
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for ECS tasks"
  type        = list(string)
  nullable    = false
}

variable "alb_security_group_id" {
  description = "Security group ID for the ALB"
  type        = string
  nullable    = false
}

variable "ecs_security_group_id" {
  description = "Security group ID for ECS tasks"
  type        = string
  nullable    = false
}

variable "image_tag" {
  description = "Initial lobby image tag used by the ECS task definition"
  type        = string
  default     = "latest"
}

variable "task_cpu" {
  description = "Fargate task CPU units"
  type        = number
  default     = 256
}

variable "task_memory" {
  description = "Fargate task memory in MiB"
  type        = number
  default     = 512
}

variable "allowed_origins" {
  description = "Comma-separated list of allowed game origins"
  type        = string
  default     = ""
}

variable "login_rate_limit_max" {
  description = "Maximum login attempts per rate-limit window; 0 disables limiting"
  type        = number
  default     = 60
}

variable "login_rate_limit_window_ms" {
  description = "Login rate-limit window in milliseconds"
  type        = number
  default     = 60000
}

variable "max_ws_message_size" {
  description = "Maximum WebSocket message size in bytes; 0 disables limiting"
  type        = number
  default     = 65536
}

variable "room_ttl_ms" {
  description = "Room/user stale cleanup TTL in milliseconds; 0 disables cleanup"
  type        = number
  default     = 3600000
}

variable "log_retention_days" {
  description = "CloudWatch Logs retention period for lobby logs"
  type        = number
  default     = 14
}
