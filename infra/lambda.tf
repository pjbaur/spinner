# Zip preserves the repo-relative layout (lambda/, shared/) so the ESM
# relative import ../shared/wheelConfig.mjs resolves inside the zip exactly
# as it does on disk. Handler is therefore "lambda/index.handler".
data "archive_file" "config_writer" {
  type        = "zip"
  output_path = "${path.module}/build/config-writer.zip"

  source {
    content  = file("${path.module}/../lambda/index.mjs")
    filename = "lambda/index.mjs"
  }
  source {
    content  = file("${path.module}/../lambda/handler.mjs")
    filename = "lambda/handler.mjs"
  }
  source {
    content  = file("${path.module}/../shared/wheelConfig.mjs")
    filename = "shared/wheelConfig.mjs"
  }
}

resource "aws_iam_role" "config_writer" {
  name = "${var.bucket_name}-config-writer"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "config_writer_logs" {
  role       = aws_iam_role.config_writer.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Exactly one object writable, exactly one distribution invalidatable.
resource "aws_iam_role_policy" "config_writer" {
  name = "${var.bucket_name}-config-writer-scope"
  role = aws_iam_role.config_writer.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "s3:PutObject"
        Resource = "${aws_s3_bucket.site.arn}/config/jerry.json"
      },
      {
        Effect   = "Allow"
        Action   = "cloudfront:CreateInvalidation"
        Resource = "arn:aws:cloudfront::${data.aws_caller_identity.current.account_id}:distribution/${aws_cloudfront_distribution.site.id}"
      },
    ]
  })
}

resource "aws_lambda_function" "config_writer" {
  function_name    = "${var.bucket_name}-config-writer"
  description      = "Validates and writes the wheel config JSON, then invalidates the CDN path"
  role             = aws_iam_role.config_writer.arn
  runtime          = "nodejs22.x"
  handler          = "lambda/index.handler"
  filename         = data.archive_file.config_writer.output_path
  source_code_hash = data.archive_file.config_writer.output_base64sha256
  timeout          = 10

  reserved_concurrent_executions = 5

  environment {
    variables = {
      CONFIG_BUCKET   = aws_s3_bucket.site.id
      DISTRIBUTION_ID = aws_cloudfront_distribution.site.id
    }
  }
}

resource "aws_cloudwatch_log_group" "config_writer" {
  name              = "/aws/lambda/${aws_lambda_function.config_writer.function_name}"
  retention_in_days = 14
}
