# Denial-of-wallet guard: alerts at $5 (25% of the $20 limit) and $20 of
# actual monthly account spend. AWS has no hard spend cutoff; alerting is
# the control.
resource "aws_budgets_budget" "monthly" {
  name         = "${var.bucket_name}-monthly-cost"
  budget_type  = "COST"
  limit_amount = "20"
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  notification {
    comparison_operator        = "GREATER_THAN"
    notification_type          = "ACTUAL"
    threshold                  = 25
    threshold_type             = "PERCENTAGE"
    subscriber_email_addresses = [var.alert_email]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    notification_type          = "ACTUAL"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    subscriber_email_addresses = [var.alert_email]
  }
}
