# Single-admin user pool for the /admin config editor. Users are created by
# an administrator only; there is no self-signup surface.
resource "aws_cognito_user_pool" "admin" {
  name = "${var.bucket_name}-admin"

  # MFA off initially; pool supports enabling OPTIONAL later without recreation.
  mfa_configuration = "OFF"

  admin_create_user_config {
    allow_admin_create_user_only = true
  }

  password_policy {
    minimum_length    = 12
    require_lowercase = true
    require_numbers   = true
    require_symbols   = false
    require_uppercase = true
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "admin_only"
      priority = 1
    }
  }
}

resource "aws_cognito_user_pool_client" "admin" {
  name         = "${var.bucket_name}-admin-web"
  user_pool_id = aws_cognito_user_pool.admin.id

  # Public SPA client: authorization code + PKCE, no secret.
  generate_secret                      = false
  prevent_user_existence_errors        = "ENABLED"
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["openid", "email"]
  supported_identity_providers         = ["COGNITO"]

  callback_urls = concat(
    ["https://${var.domain_name}/admin"],
    [for d in local.alternate_domain_names : "https://${d}/admin"],
    ["http://localhost:5173/admin"],
  )
  logout_urls = concat(
    ["https://${var.domain_name}/admin"],
    [for d in local.alternate_domain_names : "https://${d}/admin"],
    ["http://localhost:5173/admin"],
  )
}

resource "aws_cognito_user_pool_domain" "admin" {
  domain       = var.cognito_domain_prefix
  user_pool_id = aws_cognito_user_pool.admin.id
}
