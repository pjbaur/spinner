output "bucket_name" {
  description = "S3 bucket name for the website"
  value       = aws_s3_bucket.site.id
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID for the website"
  value       = aws_cloudfront_distribution.site.id
}

output "cloudfront_domain" {
  description = "CloudFront domain name for the website"
  value       = aws_cloudfront_distribution.site.domain_name
}

output "app_url" {
  description = "HTTPS URL of the application"
  value       = "https://${var.domain_name}"
}

output "gha_deploy_role_arn" {
  description = "ARN of the GitHub Actions deployment role"
  value       = aws_iam_role.gha_deploy.arn
}

output "config_api_endpoint" {
  description = "Base URL of the config write API (VITE_CONFIG_API_URL)"
  value       = aws_apigatewayv2_api.config.api_endpoint
}

output "cognito_authority" {
  description = "OIDC authority URL for the admin user pool (VITE_COGNITO_AUTHORITY)"
  value       = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.admin.id}"
}

output "cognito_client_id" {
  description = "Cognito app client id (VITE_COGNITO_CLIENT_ID)"
  value       = aws_cognito_user_pool_client.admin.id
}

output "cognito_user_pool_id" {
  description = "Cognito user pool id (for admin-create-user)"
  value       = aws_cognito_user_pool.admin.id
}
