resource "aws_route53_record" "a" {
  zone_id = data.aws_route53_zone.primary.zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.site.domain_name
    zone_id                = aws_cloudfront_distribution.site.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "aaaa" {
  zone_id = data.aws_route53_zone.primary.zone_id
  name    = var.domain_name
  type    = "AAAA"

  alias {
    name                   = aws_cloudfront_distribution.site.domain_name
    zone_id                = aws_cloudfront_distribution.site.hosted_zone_id
    evaluate_target_health = false
  }
}

# Alias records for the optional alternate domain. Kept as separate
# resources (rather than converting the two above to for_each) so the
# primary domain's existing records keep their resource address and are
# never destroyed/recreated when the alternate domain is added or removed.
resource "aws_route53_record" "a_alternate" {
  count   = length(local.alternate_domain_names)
  zone_id = data.aws_route53_zone.primary.zone_id
  name    = local.alternate_domain_names[count.index]
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.site.domain_name
    zone_id                = aws_cloudfront_distribution.site.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "aaaa_alternate" {
  count   = length(local.alternate_domain_names)
  zone_id = data.aws_route53_zone.primary.zone_id
  name    = local.alternate_domain_names[count.index]
  type    = "AAAA"

  alias {
    name                   = aws_cloudfront_distribution.site.domain_name
    zone_id                = aws_cloudfront_distribution.site.hosted_zone_id
    evaluate_target_health = false
  }
}
