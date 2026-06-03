output "ecr_repository_name" {
  description = "Name of the ECR repository"
  value       = aws_ecr_repository.lobby.name
}

output "ecr_repository_url" {
  description = "URL of the ECR repository"
  value       = aws_ecr_repository.lobby.repository_url
}

output "ecs_cluster_name" {
  description = "Name of the ECS cluster"
  value       = aws_ecs_cluster.lobby.name
}

output "ecs_service_name" {
  description = "Name of the ECS service"
  value       = aws_ecs_service.lobby.name
}

output "alb_dns_name" {
  description = "DNS name of the ALB"
  value       = aws_lb.lobby.dns_name
}

output "lobby_url" {
  description = "Full lobby URL"
  value       = "https://${var.lobby_domain}"
}
