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

variable "game_domain" {
  description = "Full domain for the game (e.g. dev.lf2.noidilin.dev)"
  type        = string
}

variable "force_destroy" {
  description = "Force destroy S3 bucket (only for dev/test cleanup)"
  type        = bool
  default     = false
}
