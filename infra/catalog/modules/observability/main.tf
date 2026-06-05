locals {
  dashboard_name = "${var.name_prefix}-baseline"

  common_tags = {
    Project     = var.project
    Environment = var.environment
  }

  regional_alarm_actions = [aws_sns_topic.regional_alarms.arn]
  global_alarm_actions   = [aws_sns_topic.global_alarms.arn]
}

# ─── Alarm Notifications ───────────────────────────────────────────────────

data "aws_caller_identity" "current" {}

resource "aws_sns_topic" "regional_alarms" {
  name              = "${var.name_prefix}-alarm-notifications"
  kms_master_key_id = "alias/aws/sns"

  tags = local.common_tags
}

resource "aws_sns_topic_policy" "regional_alarms" {
  arn = aws_sns_topic.regional_alarms.arn

  policy = data.aws_iam_policy_document.regional_alarms.json
}

data "aws_iam_policy_document" "regional_alarms" {
  statement {
    sid     = "AllowCloudWatchPublish"
    effect  = "Allow"
    actions = ["sns:Publish"]

    principals {
      type        = "Service"
      identifiers = ["cloudwatch.amazonaws.com"]
    }

    resources = [aws_sns_topic.regional_alarms.arn]

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }
}

resource "aws_sns_topic_subscription" "regional_email" {
  count     = trimspace(var.alarm_email) == "" ? 0 : 1
  topic_arn = aws_sns_topic.regional_alarms.arn
  protocol  = "email"
  endpoint  = var.alarm_email
}

resource "aws_sns_topic" "global_alarms" {
  provider          = aws.us_east_1
  name              = "${var.name_prefix}-cloudfront-alarm-notifications"
  kms_master_key_id = "alias/aws/sns"

  tags = local.common_tags
}

resource "aws_sns_topic_policy" "global_alarms" {
  provider = aws.us_east_1
  arn      = aws_sns_topic.global_alarms.arn

  policy = data.aws_iam_policy_document.global_alarms.json
}

data "aws_iam_policy_document" "global_alarms" {
  provider = aws.us_east_1

  statement {
    sid     = "AllowCloudWatchPublish"
    effect  = "Allow"
    actions = ["sns:Publish"]

    principals {
      type        = "Service"
      identifiers = ["cloudwatch.amazonaws.com"]
    }

    resources = [aws_sns_topic.global_alarms.arn]

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }
}

resource "aws_sns_topic_subscription" "global_email" {
  provider  = aws.us_east_1
  count     = trimspace(var.alarm_email) == "" ? 0 : 1
  topic_arn = aws_sns_topic.global_alarms.arn
  protocol  = "email"
  endpoint  = var.alarm_email
}

# ─── Dashboard ──────────────────────────────────────────────────────────────

resource "aws_cloudwatch_dashboard" "baseline" {
  dashboard_name = local.dashboard_name

  dashboard_body = jsonencode({
    start          = "-PT8H"
    periodOverride = "inherit"
    widgets = [
      {
        type   = "alarm"
        x      = 0
        y      = 0
        width  = 24
        height = 3
        properties = {
          title = "Baseline alarm status"
          alarms = [
            aws_cloudwatch_metric_alarm.cloudfront_5xx_rate.arn,
            aws_cloudwatch_metric_alarm.alb_5xx_count.arn,
            aws_cloudwatch_metric_alarm.alb_unhealthy_targets.arn,
            aws_cloudwatch_metric_alarm.ecs_running_task_count.arn,
            aws_cloudwatch_metric_alarm.lobby_availability.arn,
          ]
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 3
        width  = 12
        height = 6
        properties = {
          title   = "CloudFront delivery"
          region  = "us-east-1"
          view    = "timeSeries"
          stacked = false
          metrics = [
            ["AWS/CloudFront", "Requests", "DistributionId", var.cloudfront_distribution_id, "Region", "Global", { stat = "Sum", label = "Requests" }],
            [".", "4xxErrorRate", ".", ".", ".", ".", { stat = "Average", yAxis = "right", label = "4xx %" }],
            [".", "5xxErrorRate", ".", ".", ".", ".", { stat = "Average", yAxis = "right", label = "5xx %" }],
            [".", "CacheHitRate", ".", ".", ".", ".", { stat = "Average", yAxis = "right", label = "Cache hit %" }]
          ]
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 3
        width  = 12
        height = 6
        properties = {
          title   = "Lobby load balancer"
          region  = var.aws_region
          view    = "timeSeries"
          stacked = false
          metrics = [
            ["AWS/ApplicationELB", "RequestCount", "LoadBalancer", var.alb_arn_suffix, { stat = "Sum", label = "Requests" }],
            [".", "HTTPCode_ELB_4XX_Count", ".", ".", { stat = "Sum", label = "ALB 4xx" }],
            [".", "HTTPCode_ELB_5XX_Count", ".", ".", { stat = "Sum", label = "ALB 5xx" }],
            [".", "TargetResponseTime", ".", ".", { stat = "p95", yAxis = "right", label = "p95 latency" }]
          ]
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 9
        width  = 12
        height = 6
        properties = {
          title  = "ECS runtime"
          region = var.aws_region
          view   = "timeSeries"
          metrics = [
            ["AWS/ECS", "CPUUtilization", "ClusterName", var.ecs_cluster_name, "ServiceName", var.ecs_service_name, { stat = "Average", label = "CPU %" }],
            [".", "MemoryUtilization", ".", ".", ".", ".", { stat = "Average", label = "Memory %" }],
            ["ECS/ContainerInsights", "RunningTaskCount", "ClusterName", var.ecs_cluster_name, "ServiceName", var.ecs_service_name, { stat = "Average", yAxis = "right", label = "Running tasks" }]
          ]
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 9
        width  = 12
        height = 6
        properties = {
          title  = "Lobby availability"
          region = var.aws_region
          view   = "timeSeries"
          metrics = [
            ["AWS/ApplicationELB", "HealthyHostCount", "TargetGroup", var.target_group_arn_suffix, "LoadBalancer", var.alb_arn_suffix, { stat = "Maximum", label = "Healthy targets" }],
            [".", "UnHealthyHostCount", ".", ".", ".", ".", { stat = "Maximum", label = "Unhealthy targets" }]
          ]
        }
      },
      {
        type   = "log"
        x      = 0
        y      = 15
        width  = 24
        height = 6
        properties = {
          title  = "Recent structured lobby errors"
          region = var.aws_region
          query  = "SOURCE '${var.lobby_log_group_name}' | fields @timestamp, level, event, room, player, message | filter level in ['warn','error'] | sort @timestamp desc | limit 50"
        }
      }
    ]
  })
}

# ─── Alarms ─────────────────────────────────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "cloudfront_5xx_rate" {
  provider            = aws.us_east_1
  alarm_name          = "${var.name_prefix}-cloudfront-5xx-rate"
  alarm_description   = "CloudFront is returning a sustained 5xx error rate for static game delivery."
  namespace           = "AWS/CloudFront"
  metric_name         = "5xxErrorRate"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 2
  datapoints_to_alarm = 2
  threshold           = 5
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = local.global_alarm_actions
  ok_actions          = local.global_alarm_actions

  dimensions = {
    DistributionId = var.cloudfront_distribution_id
    Region         = "Global"
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "alb_5xx_count" {
  alarm_name          = "${var.name_prefix}-alb-5xx-count"
  alarm_description   = "The lobby Application Load Balancer is returning server errors."
  namespace           = "AWS/ApplicationELB"
  metric_name         = "HTTPCode_ELB_5XX_Count"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  datapoints_to_alarm = 1
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = local.regional_alarm_actions
  ok_actions          = local.regional_alarm_actions

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "alb_unhealthy_targets" {
  alarm_name          = "${var.name_prefix}-alb-unhealthy-targets"
  alarm_description   = "At least one lobby target is unhealthy behind the ALB."
  namespace           = "AWS/ApplicationELB"
  metric_name         = "UnHealthyHostCount"
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 2
  datapoints_to_alarm = 2
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = local.regional_alarm_actions
  ok_actions          = local.regional_alarm_actions

  dimensions = {
    TargetGroup  = var.target_group_arn_suffix
    LoadBalancer = var.alb_arn_suffix
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "ecs_running_task_count" {
  alarm_name          = "${var.name_prefix}-ecs-running-task-count"
  alarm_description   = "The ECS service has fewer running tasks than the single-task baseline requires."
  namespace           = "ECS/ContainerInsights"
  metric_name         = "RunningTaskCount"
  statistic           = "Average"
  period              = 60
  evaluation_periods  = 2
  datapoints_to_alarm = 2
  threshold           = var.desired_lobby_task_count
  comparison_operator = "LessThanThreshold"
  treat_missing_data  = "breaching"
  alarm_actions       = local.regional_alarm_actions
  ok_actions          = local.regional_alarm_actions

  dimensions = {
    ClusterName = var.ecs_cluster_name
    ServiceName = var.ecs_service_name
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "lobby_availability" {
  alarm_name          = "${var.name_prefix}-lobby-availability"
  alarm_description   = "No healthy lobby target is available for HTTPS/WSS traffic."
  namespace           = "AWS/ApplicationELB"
  metric_name         = "HealthyHostCount"
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 2
  datapoints_to_alarm = 2
  threshold           = 1
  comparison_operator = "LessThanThreshold"
  treat_missing_data  = "breaching"
  alarm_actions       = local.regional_alarm_actions
  ok_actions          = local.regional_alarm_actions

  dimensions = {
    TargetGroup  = var.target_group_arn_suffix
    LoadBalancer = var.alb_arn_suffix
  }

  tags = local.common_tags
}
