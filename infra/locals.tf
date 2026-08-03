# Derived domain lists shared across acm.tf, cloudfront.tf, route53.tf,
# cognito.tf, and api.tf so the alternate domain is wired through a single
# variable instead of being repeated per file.
locals {
  alternate_domain_names = var.alternate_domain_name != null && var.alternate_domain_name != "" ? [var.alternate_domain_name] : []
  all_domain_names       = concat([var.domain_name], local.alternate_domain_names)
}
