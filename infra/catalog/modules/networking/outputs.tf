output "vpc_id" {
  description = "ID of the VPC"
  value       = local._vpc_id
}

output "public_subnet_ids" {
  description = "IDs of the public subnets"
  value       = local._public_subnet_ids
}

output "private_subnet_ids" {
  description = "IDs of the private subnets"
  value       = local._private_subnet_ids
}

output "alb_security_group_id" {
  description = "ID of the ALB security group"
  value       = local._alb_security_group_id
}

output "ecs_security_group_id" {
  description = "ID of the ECS security group"
  value       = local._ecs_security_group_id
}
