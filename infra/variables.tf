variable "aws_region" {
  description = "Region for the S3 bucket"
  type        = string
  default     = "us-east-1"
}

variable "domain_name" {
  description = "Public hostname to serve the app on, e.g. spinner.example.com"
  type        = string
}

variable "hosted_zone_name" {
  description = "Route 53 hosted zone the domain lives in, e.g. example.com"
  type        = string
}

variable "bucket_name" {
  description = "Globally-unique S3 bucket name for the app's files"
  type        = string
}

variable "github_repo" {
  description = "owner/repo allowed to deploy via GitHub Actions OIDC"
  type        = string
}

variable "github_branch" {
  description = "Branch allowed to deploy"
  type        = string
  default     = "main"
}
