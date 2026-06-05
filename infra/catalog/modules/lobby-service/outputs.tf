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

output "alb_arn_suffix" {
  description = "CloudWatch metric dimension suffix for the ALB"
  value       = aws_lb.lobby.arn_suffix
}

output "target_group_arn_suffix" {
  description = "CloudWatch metric dimension suffix for the lobby target group"
  value       = aws_lb_target_group.lobby.arn_suffix
}

output "log_group_name" {
  description = "Name of the lobby CloudWatch Logs log group"
  value       = aws_cloudwatch_log_group.lobby.name
}

output "lobby_url" {
  description = "Full lobby URL"
  value       = "https://${var.lobby_domain}"
}
