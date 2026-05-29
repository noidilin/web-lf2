# Lobby service module — placeholder for Phase 2 slices
#
# This module will create:
# - ECR repository for lobby container images
# - ECS cluster
# - ECS task definition (Fargate, awsvpc network mode)
# - ECS service with desired_count = 1
# - Application Load Balancer with HTTPS/WSS listener
# - Target group with health check
# - IAM roles (execution + task) with permissions boundary
# - CloudWatch log group
# - ACM certificate in ap-northeast-1 for ALB
# - Route 53 record for lobby domain
#
# Resources will be added in the lobby service implementation issue.

locals {
  _ecr_repository_url = ""
  _ecs_cluster_name   = ""
  _alb_dns_name       = ""
  _lobby_url          = ""
}
