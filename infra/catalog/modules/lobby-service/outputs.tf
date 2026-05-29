output "ecr_repository_url" {
  description = "URL of the ECR repository"
  value       = local._ecr_repository_url
}

output "ecs_cluster_name" {
  description = "Name of the ECS cluster"
  value       = local._ecs_cluster_name
}

output "alb_dns_name" {
  description = "DNS name of the ALB"
  value       = local._alb_dns_name
}

output "lobby_url" {
  description = "Full lobby URL"
  value       = local._lobby_url
}
