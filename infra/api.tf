resource "aws_apigatewayv2_api" "config" {
  name          = "${var.bucket_name}-config-api"
  description   = "Write path for the wheel config JSON"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = [
      "https://${var.domain_name}",
      "http://localhost:5173",
    ]
    allow_methods = ["PUT", "OPTIONS"]
    allow_headers = ["authorization", "content-type"]
    max_age       = 3600
  }
}

# Cognito ID tokens carry aud = app client id, which is what a JWT
# authorizer validates. The admin UI must send the ID token, not the
# access token (Cognito access tokens have no aud claim).
resource "aws_apigatewayv2_authorizer" "cognito" {
  api_id           = aws_apigatewayv2_api.config.id
  name             = "cognito-jwt"
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]

  jwt_configuration {
    audience = [aws_cognito_user_pool_client.admin.id]
    issuer   = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.admin.id}"
  }
}

resource "aws_apigatewayv2_integration" "config_writer" {
  api_id                 = aws_apigatewayv2_api.config.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.config_writer.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "put_config" {
  api_id             = aws_apigatewayv2_api.config.id
  route_key          = "PUT /config"
  target             = "integrations/${aws_apigatewayv2_integration.config_writer.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.config.id
  name        = "$default"
  auto_deploy = true

  default_route_settings {
    throttling_rate_limit  = 5
    throttling_burst_limit = 10
  }
}

resource "aws_lambda_permission" "config_api" {
  statement_id  = "AllowConfigApiInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.config_writer.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.config.execution_arn}/*/*"
}
