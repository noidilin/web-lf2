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
  default     = ""
}

variable "public_subnet_ids" {
  description = "Public subnet IDs for the ALB"
  type        = list(string)
  default     = []
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for ECS tasks"
  type        = list(string)
  default     = []
}

variable "alb_security_group_id" {
  description = "Security group ID for the ALB"
  type        = string
  default     = ""
}

variable "ecs_security_group_id" {
  description = "Security group ID for ECS tasks"
  type        = string
  default     = ""
}
