# Static site module — private S3 bucket + CloudFront CDN
#
# Creates:
# - S3 private bucket for static game artifacts (public access blocked)
# - CloudFront Origin Access Control for private bucket access
# - CloudFront distribution with HTTPS-only viewer policy
# - ACM certificate in us-east-1 for CloudFront TLS
# - Route 53 alias record for game domain
# - CloudFront cache policy for static assets

locals {
  name_prefix = "${var.name_prefix}-static"
}

# ─── S3 Bucket ───────────────────────────────────────────────────────────────

resource "aws_s3_bucket" "static" {
  bucket = "${local.name_prefix}-assets"

  force_destroy = var.force_destroy

  tags = {
    Project     = var.project
    Environment = var.environment
  }
}

resource "aws_s3_bucket_versioning" "static" {
  bucket = aws_s3_bucket.static.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "static" {
  bucket = aws_s3_bucket.static.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "static" {
  bucket = aws_s3_bucket.static.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Bucket policy: allow CloudFront OAC to read objects
resource "aws_s3_bucket_policy" "static" {
  bucket = aws_s3_bucket.static.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCloudFrontOACRead"
        Effect    = "Allow"
        Principal = { Service = "cloudfront.amazonaws.com" }
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.static.arn}/*"
        Condition = {
          StringEquals = {
            "aws:SourceArn" = aws_cloudfront_distribution.game.arn
          }
        }
      },
    ]
  })
}

# ─── CloudFront Origin Access Control ────────────────────────────────────────

resource "aws_cloudfront_origin_access_control" "static" {
  name                              = "${local.name_prefix}-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# ─── ACM Certificate (us-east-1) ─────────────────────────────────────────────

resource "aws_acm_certificate" "game" {
  provider          = aws.us_east_1
  domain_name       = var.game_domain
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Project     = var.project
    Environment = var.environment
  }
}

resource "aws_route53_record" "cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.game.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  zone_id = data.aws_route53_zone.game.zone_id
  name    = each.value.name
  type    = each.value.type
  records = [each.value.record]
  ttl     = 60
}

resource "aws_acm_certificate_validation" "game" {
  provider                = aws.us_east_1
  certificate_arn         = aws_acm_certificate.game.arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]
}

# ─── Route 53 ────────────────────────────────────────────────────────────────

data "aws_route53_zone" "game" {
  name         = var.hosted_zone_name
  private_zone = false
}

resource "aws_route53_record" "game" {
  zone_id = data.aws_route53_zone.game.zone_id
  name    = var.game_domain
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.game.domain_name
    zone_id                = "Z2FDTNDATAQYW2"
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "game_ipv6" {
  zone_id = data.aws_route53_zone.game.zone_id
  name    = var.game_domain
  type    = "AAAA"

  alias {
    name                   = aws_cloudfront_distribution.game.domain_name
    zone_id                = "Z2FDTNDATAQYW2"
    evaluate_target_health = false
  }
}

# ─── CloudFront Distribution ─────────────────────────────────────────────────

resource "aws_cloudfront_cache_policy" "static" {
  name        = "${local.name_prefix}-cache-policy"
  default_ttl = 86400    # 1 day
  max_ttl     = 31536000 # 1 year
  min_ttl     = 0

  parameters_in_cache_key_and_forwarded_to_origin {
    cookies_config {
      cookie_behavior = "none"
    }
    headers_config {
      header_behavior = "none"
    }
    query_strings_config {
      query_string_behavior = "none"
    }
  }
}

resource "aws_cloudfront_distribution" "game" {
  enabled             = true
  comment             = "Static game CDN for ${var.game_domain}"
  default_root_object = "game/game.html"
  price_class         = "PriceClass_200" # NA + EU + Asia

  origin {
    domain_name              = aws_s3_bucket.static.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.static.id
    origin_id                = "s3-static"
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "s3-static"
    cache_policy_id        = aws_cloudfront_cache_policy.static.id
    viewer_protocol_policy = "redirect-to-https"

    compress = true
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.game.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  aliases = [var.game_domain]

  tags = {
    Project     = var.project
    Environment = var.environment
  }
}
