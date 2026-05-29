output "oidc_provider_arn" {
  description = "ARN of the shared GitHub OIDC provider"
  value       = data.aws_iam_openid_connect_provider.github.arn
}

output "plan_role_arn" {
  description = "ARN of the GitHub Actions plan role"
  value       = aws_iam_role.github_plan.arn
}

output "apply_role_arn" {
  description = "ARN of the GitHub Actions apply role"
  value       = aws_iam_role.github_apply.arn
}
