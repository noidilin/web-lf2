output "ecr_repository_name" {
  description = "Name of the lobby ECR repository"
  value       = aws_ecr_repository.lobby.name
}

output "ecr_repository_url" {
  description = "URL of the lobby ECR repository"
  value       = aws_ecr_repository.lobby.repository_url
}
