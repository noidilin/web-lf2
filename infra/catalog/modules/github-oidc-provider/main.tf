# Account-level GitHub Actions OIDC provider.
# IAM OIDC providers are global within an AWS account and must be created once per provider URL.

resource "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"

  client_id_list = [
    "sts.amazonaws.com",
  ]

  # GitHub's certificate chain is trusted by AWS root CAs; AWS falls back to thumbprints only when needed.
  thumbprint_list = []

  tags = {
    Project = var.project
    Scope   = "account"
  }
}
