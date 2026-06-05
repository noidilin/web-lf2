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

variable "ecr_repository_url" {
  description = "URL of the pre-created lobby ECR repository"
  type        = string
  nullable    = false
}

variable "image_tag" {
  description = "Immutable lobby image tag selected by the deployment workflow (sha-<git sha>)"
  type        = string
  nullable    = false

  validation {
    condition = (
      can(regex("^sha-[0-9a-f]{40}$", var.image_tag))
      && var.image_tag != "sha-0000000000000000000000000000000000000000"
    )
    error_message = "image_tag must use a real canonical sha-<40 character lowercase git SHA> tag, not the zero-SHA sentinel."
  }
}

variable "task_cpu" {
  description = "Fargate task CPU units"
  type        = number
  default     = 256

  validation {
    condition     = contains([256, 512, 1024, 2048, 4096, 8192, 16384], var.task_cpu)
    error_message = "task_cpu must be one of the AWS Fargate CPU values: 256, 512, 1024, 2048, 4096, 8192, or 16384."
  }
}

variable "task_memory" {
  description = "Fargate task memory in MiB"
  type        = number
  default     = 512

  validation {
    condition = contains(concat(
      [512, 1024, 2048, 3072],
      [for memory in range(4096, 30721, 1024) : memory],
      [for memory in range(32768, 122881, 4096) : memory]
    ), var.task_memory)
    error_message = "task_memory must be a valid AWS Fargate memory value in MiB."
  }
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

  validation {
    condition     = contains([0, 1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1096, 1827, 2192, 2557, 2922, 3288, 3653], var.log_retention_days)
    error_message = "log_retention_days must be 0 or a CloudWatch Logs supported retention value."
  }
}
