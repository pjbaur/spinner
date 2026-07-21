terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.40"
    }
  }
}

# Default provider — bucket, CloudFront, Route 53 all work here.
provider "aws" {
  region = var.aws_region
}

# CloudFront REQUIRES its ACM cert in us-east-1. This aliased provider exists
# only to create that certificate.
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}
