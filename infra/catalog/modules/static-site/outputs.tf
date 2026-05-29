output "bucket_name" {
  description = "Name of the S3 bucket for static assets"
  value       = aws_s3_bucket.static.bucket
}

output "bucket_arn" {
  description = "ARN of the S3 bucket"
  value       = aws_s3_bucket.static.arn
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = aws_cloudfront_distribution.game.id
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name"
  value       = aws_cloudfront_distribution.game.domain_name
}

output "game_url" {
  description = "Full game URL"
  value       = "https://${var.game_domain}"
}
