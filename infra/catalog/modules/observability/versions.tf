terraform {
  required_version = ">= 1.15"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

# CloudFront publishes CloudWatch metrics in us-east-1 with Region=Global.
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}
