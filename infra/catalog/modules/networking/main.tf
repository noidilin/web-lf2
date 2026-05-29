# Networking module — placeholder for Phase 2 slices
#
# This module will create:
# - VPC with public and private subnets across multiple AZs
# - Internet Gateway
# - NAT Gateways (or VPC endpoints for private-only)
# - Route tables
# - Security groups for ALB and ECS
#
# Resources will be added in the networking implementation issue.

locals {
  # Placeholder values — will be replaced by actual resource outputs
  _vpc_id                = ""
  _public_subnet_ids     = []
  _private_subnet_ids    = []
  _alb_security_group_id = ""
  _ecs_security_group_id = ""
}
