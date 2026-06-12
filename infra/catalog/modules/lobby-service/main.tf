locals {
  name_prefix                  = "${var.name_prefix}-lobby"
  container_name               = "lobby"
  container_port               = 8001
  runtime_permissions_boundary = "arn:aws:iam::${var.account_id}:policy/lab-devops-permissions-boundary"
  zero_sha_image_tag           = "sha-0000000000000000000000000000000000000000"
  selected_image_tag           = coalesce(var.image_tag, local.zero_sha_image_tag)

  common_tags = {
    Project     = var.project
    Environment = var.environment
  }

  fargate_cpu_memory = {
    "256"   = [512, 1024, 2048]
    "512"   = [1024, 2048, 3072, 4096]
    "1024"  = [2048, 3072, 4096, 5120, 6144, 7168, 8192]
    "2048"  = [for memory in range(4096, 16385, 1024) : memory]
    "4096"  = [for memory in range(8192, 30721, 1024) : memory]
    "8192"  = [for memory in range(16384, 61441, 4096) : memory]
    "16384" = [for memory in range(32768, 122881, 8192) : memory]
  }
}

data "aws_route53_zone" "selected" {
  name         = var.hosted_zone_name
  private_zone = false
}

# ─── Logs ───────────────────────────────────────────────────────────────────

resource "aws_cloudwatch_log_group" "lobby" {
  name              = "/ecs/${local.name_prefix}"
  retention_in_days = var.log_retention_days

  tags = local.common_tags
}

# ─── IAM Roles ──────────────────────────────────────────────────────────────

resource "aws_iam_role" "execution" {
  name                 = "${local.name_prefix}-ecs-task-execution-role"
  permissions_boundary = local.runtime_permissions_boundary
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "execution" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role" "task" {
  name                 = "${local.name_prefix}-ecs-task-role"
  permissions_boundary = local.runtime_permissions_boundary
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = local.common_tags
}

# ─── Load Balancer + TLS ────────────────────────────────────────────────────

resource "aws_acm_certificate" "lobby" {
  domain_name       = var.lobby_domain
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = local.common_tags
}

resource "aws_route53_record" "lobby_certificate_validation" {
  for_each = {
    for dvo in aws_acm_certificate.lobby.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = data.aws_route53_zone.selected.zone_id
}

resource "aws_acm_certificate_validation" "lobby" {
  certificate_arn         = aws_acm_certificate.lobby.arn
  validation_record_fqdns = [for record in aws_route53_record.lobby_certificate_validation : record.fqdn]
}

resource "aws_lb" "lobby" {
  name                       = local.name_prefix
  load_balancer_type         = "application"
  internal                   = false
  drop_invalid_header_fields = true
  security_groups            = [var.alb_security_group_id]
  subnets                    = var.public_subnet_ids

  tags = local.common_tags
}

resource "aws_lb_target_group" "lobby" {
  name                 = local.name_prefix
  port                 = local.container_port
  protocol             = "HTTP"
  target_type          = "ip"
  vpc_id               = var.vpc_id
  deregistration_delay = 30

  health_check {
    enabled             = true
    path                = "/healthz"
    healthy_threshold   = 2
    unhealthy_threshold = 2
    interval            = 30
    timeout             = 5
    matcher             = "200"
  }

  tags = local.common_tags
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.lobby.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate_validation.lobby.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.lobby.arn
  }
}

resource "aws_lb_listener" "http_redirect" {
  load_balancer_arn = aws_lb.lobby.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

resource "aws_route53_record" "lobby" {
  zone_id = data.aws_route53_zone.selected.zone_id
  name    = var.lobby_domain
  type    = "A"

  alias {
    name                   = aws_lb.lobby.dns_name
    zone_id                = aws_lb.lobby.zone_id
    evaluate_target_health = true
  }
}

# ─── ECS Fargate Service ────────────────────────────────────────────────────

resource "aws_ecs_cluster" "lobby" {
  name = local.name_prefix

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = local.common_tags
}

resource "aws_ecs_task_definition" "lobby" {
  family                   = local.name_prefix
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.task_cpu
  memory                   = var.task_memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([
    {
      name      = local.container_name
      image     = "${var.ecr_repository_url}:${local.selected_image_tag}"
      essential = true
      portMappings = [
        {
          containerPort = local.container_port
          hostPort      = local.container_port
          protocol      = "tcp"
        }
      ]
      environment = [
        { name = "PORT", value = tostring(local.container_port) },
        { name = "NODE_ENV", value = "production" },
        { name = "PUBLIC_LOBBY", value = "false" },
        { name = "TRUST_PROXY", value = "true" },
        { name = "TRUST_PROXY_HOPS", value = "1" },
        { name = "ALLOWED_ORIGINS", value = var.allowed_origins },
        { name = "LOGIN_RATE_LIMIT_MAX", value = tostring(var.login_rate_limit_max) },
        { name = "LOGIN_RATE_LIMIT_WINDOW_MS", value = tostring(var.login_rate_limit_window_ms) },
        { name = "MAX_WS_MESSAGE_SIZE", value = tostring(var.max_ws_message_size) },
        { name = "ROOM_TTL_MS", value = tostring(var.room_ttl_ms) },
        { name = "SHUTDOWN_TIMEOUT_MS", value = "10000" }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.lobby.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = local.container_name
          "mode"                  = "blocking"
        }
      }
    }
  ])

  tags = local.common_tags

  lifecycle {
    precondition {
      condition     = can(regex("^sha-[0-9a-f]{40}$", local.selected_image_tag))
      error_message = "image_tag must be null or a canonical sha-<40 character lowercase git SHA> tag."
    }

    precondition {
      condition     = contains(local.fargate_cpu_memory[tostring(var.task_cpu)], var.task_memory)
      error_message = "task_memory must be a valid AWS Fargate memory value for task_cpu."
    }
  }
}

resource "aws_ecs_service" "lobby" {
  name                               = local.name_prefix
  cluster                            = aws_ecs_cluster.lobby.id
  task_definition                    = aws_ecs_task_definition.lobby.arn
  desired_count                      = 1
  launch_type                        = "FARGATE"
  platform_version                   = "LATEST"
  health_check_grace_period_seconds  = 60
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.ecs_security_group_id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.lobby.arn
    container_name   = local.container_name
    container_port   = local.container_port
  }

  depends_on = [aws_lb_listener.https]

  tags = local.common_tags
}
