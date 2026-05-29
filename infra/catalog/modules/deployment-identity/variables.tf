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

variable "github_repo" {
  description = "GitHub repository in org/repo format"
  type        = string
}
