# Deploying Spinner to AWS S3 + CloudFront (custom domain, OpenTofu)

This guide provisions production hosting for this Vite + React single-page app on
AWS using **OpenTofu** (Infrastructure as Code), fronted by **CloudFront** with a
**custom domain in Route 53** and an **ACM TLS certificate**. It then shows two
ways to ship the built files: a **manual AWS CLI** first deploy and an automated
**GitHub Actions** pipeline that runs on push to `main`.

The app is a purely static bundle — `npm run build` emits `dist/` with a single
`index.html` plus content-hashed assets under `dist/assets/`. There is no server,
no API, and no client-side router, so hosting is "upload the folder, put a CDN in
front, point DNS at it."

> **OpenTofu is a drop-in fork of Terraform.** Everything here uses the `tofu` CLI
> (install from [opentofu.org](https://opentofu.org/docs/intro/install/)). The
> config is unchanged from Terraform: OpenTofu reads the same `.tf` files —
> including the `terraform {}` settings block, which keeps that name for
> portability — and the same `.terraform.lock.hcl`, `terraform.tfvars`, and
> `terraform.tfstate` filenames. If you're migrating an existing Terraform state,
> `tofu` reads a `terraform.tfstate` as-is; the first `tofu init` reconciles the
> lock file's provider registry entries. Wherever you'd have run `terraform …`,
> run `tofu …`.

---

## Architecture

```
         (browser)
             │  HTTPS (TLS via ACM cert, us-east-1)
             ▼
      ┌──────────────┐        Origin Access Control (SigV4)
      │  CloudFront   │──────────────────────────────┐
      │ distribution  │                               ▼
      │  + custom     │                        ┌──────────────┐
      │   domain      │                        │  S3 bucket    │
      └──────┬───────┘                         │  (PRIVATE)    │
             │                                 │  dist/ files  │
   Route 53 alias A/AAAA                       └──────────────┘
   (spinner.example.com ──► CloudFront)
```

Key properties:

- The **S3 bucket is private** — no public access, no S3 "website hosting"
  endpoint. Only CloudFront can read it, enforced by an **Origin Access Control
  (OAC)** and a bucket policy scoped to your distribution's ARN.
- **HTTPS everywhere.** CloudFront terminates TLS with an ACM cert; viewers are
  redirected HTTP → HTTPS.
- **Immutable long-cache for hashed assets, no-cache for `index.html`** — so a new
  deploy is picked up immediately without serving stale HTML, while JS/CSS bundles
  cache for a year.

---

## Prerequisites

| Requirement                                         | Notes                                                                                                            |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| AWS account + admin (or scoped) credentials         | For the OpenTofu apply. Configure with `aws configure` or SSO (`aws sso login`).                                 |
| **AWS CLI v2**                                      | `aws --version` → 2.x. Used for the manual deploy.                                                               |
| **OpenTofu ≥ 1.6**                                  | `tofu version`.                                                                                                  |
| A registered domain with a **Route 53 hosted zone** | You need the hosted zone ID. This guide assumes the apex or a subdomain you control, e.g. `spinner.example.com`. |
| Node 22 + this repo                                 | `npm ci && npm run build` must succeed locally first.                                                            |
| (For CI) A GitHub repo with Actions enabled         | The pipeline uses OIDC — no long-lived AWS keys stored in GitHub.                                                |

> **Region note — read this once.** CloudFront can only use an ACM certificate
> issued in **`us-east-1`**, regardless of where your S3 bucket lives. The
> OpenTofu below uses a second, aliased AWS provider pinned to `us-east-1` purely
> for the certificate. Your bucket can be in any region (this guide defaults it to
> `us-east-1` too, for simplicity).

---

## Step 0 — Confirm the build output

From the repo root:

```bash
npm ci
npm run build
ls dist
# expected: index.html  assets/  (plus any files from public/, e.g. favicons)
```

Two app-specific things to know:

1. **Vite `base` is `/`** (the default), which is correct for serving at the root
   of a domain (`https://spinner.example.com/`). You do **not** need to change
   `vite.config.js`. If you ever host under a sub-path instead (e.g.
   `example.com/spinner/`), you would set `base: '/spinner/'` and rebuild.
2. **Runtime font dependency.** `index.html` loads Patrick Hand + Special Elite
   from `fonts.googleapis.com` / `fonts.gstatic.com`. Hosting on S3 does not change
   that — but if you add a strict Content-Security-Policy (optional, below), it
   **must allow those two hosts** or the fonts silently fall back to system fonts.

---

## Step 1 — OpenTofu project layout

Create an `infra/` directory (kept separate from app code). All files below live in
`infra/`.

```
infra/
├── providers.tf
├── variables.tf
├── s3.tf
├── acm.tf
├── cloudfront.tf
├── route53.tf
├── github_oidc.tf
├── outputs.tf
└── terraform.tfvars      # your values (gitignore this)
```

Add to the repo's `.gitignore`:

```
infra/.terraform/
infra/*.tfstate
infra/*.tfstate.*
infra/terraform.tfvars
```

> **State:** for a solo project local state is fine. For a team, move state to an
> S3 backend with DynamoDB locking (see "Remote state" at the end). Do it before
> your first real apply if more than one person will run OpenTofu.

### `providers.tf`

```hcl
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
```

### `variables.tf`

```hcl
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
```

### `terraform.tfvars` (fill in your values)

```hcl
aws_region       = "us-east-1"
domain_name      = "spinner.example.com"
hosted_zone_name = "example.com"
bucket_name      = "spinner-app-prod-1234"   # must be globally unique
github_repo      = "your-org/spinner"
github_branch    = "main"
```

---

## Step 2 — S3 bucket (private) — `s3.tf`

```hcl
resource "aws_s3_bucket" "site" {
  bucket = var.bucket_name
}

# Block every form of public access — CloudFront reaches it privately via OAC.
resource "aws_s3_bucket_public_access_block" "site" {
  bucket                  = aws_s3_bucket.site.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Optional but recommended: keep prior versions so a bad deploy is recoverable.
resource "aws_s3_bucket_versioning" "site" {
  bucket = aws_s3_bucket.site.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "site" {
  bucket = aws_s3_bucket.site.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Bucket policy: allow ONLY this CloudFront distribution to read objects.
data "aws_iam_policy_document" "site" {
  statement {
    sid     = "AllowCloudFrontServicePrincipalReadOnly"
    effect  = "Allow"
    actions = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.site.arn}/*"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.site.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "site" {
  bucket = aws_s3_bucket.site.id
  policy = data.aws_iam_policy_document.site.json
}
```

---

## Step 3 — ACM certificate (us-east-1, DNS-validated) — `acm.tf`

```hcl
data "aws_route53_zone" "primary" {
  name         = "${var.hosted_zone_name}."
  private_zone = false
}

resource "aws_acm_certificate" "site" {
  provider          = aws.us_east_1          # MUST be us-east-1 for CloudFront
  domain_name       = var.domain_name
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

# Create the DNS records ACM asks for, in Route 53.
resource "aws_route53_record" "cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.site.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  zone_id = data.aws_route53_zone.primary.zone_id
  name    = each.value.name
  type    = each.value.type
  records = [each.value.record]
  ttl     = 60
}

# Block until the cert is validated & issued.
resource "aws_acm_certificate_validation" "site" {
  provider                = aws.us_east_1
  certificate_arn         = aws_acm_certificate.site.arn
  validation_record_fqdns = [for r in aws_route53_record.cert_validation : r.fqdn]
}
```

---

## Step 4 — CloudFront distribution — `cloudfront.tf`

```hcl
# Origin Access Control — modern replacement for the legacy OAI.
resource "aws_cloudfront_origin_access_control" "site" {
  name                              = "${var.bucket_name}-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# Security response headers (HSTS, no-sniff, frame deny, referrer policy) + an
# optional CSP tuned for THIS app (Google Fonts + React inline styles + the
# data-URI grain texture). Delete the content_security_policy block if you don't
# want a CSP.
resource "aws_cloudfront_response_headers_policy" "site" {
  name = "${var.bucket_name}-security-headers"

  security_headers_config {
    strict_transport_security {
      access_control_max_age_sec = 63072000  # 2 years
      include_subdomains         = true
      preload                    = true
      override                   = true
    }
    content_type_options {
      override = true
    }
    frame_options {
      frame_option = "DENY"
      override     = true
    }
    referrer_policy {
      referrer_policy = "strict-origin-when-cross-origin"
      override        = true
    }
    content_security_policy {
      override = true
      content_security_policy = join("; ", [
        "default-src 'self'",
        "script-src 'self'",
        # React sets inline style attributes; Vite injects a small inline style.
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src https://fonts.gstatic.com",
        # The kraft-paper grain is an inline SVG data URI used as a background.
        "img-src 'self' data:",
        "connect-src 'self'",
        "base-uri 'self'",
        "form-action 'none'",
        "object-src 'none'",
      ])
    }
  }
}

resource "aws_cloudfront_distribution" "site" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "Spinner app"
  default_root_object = "index.html"
  aliases             = [var.domain_name]
  price_class         = "PriceClass_100"  # NA + EU edges; cheapest. Widen if needed.

  origin {
    domain_name              = aws_s3_bucket.site.bucket_regional_domain_name
    origin_id                = "s3-${aws_s3_bucket.site.id}"
    origin_access_control_id = aws_cloudfront_origin_access_control.site.id
  }

  default_cache_behavior {
    target_origin_id       = "s3-${aws_s3_bucket.site.id}"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    # AWS managed "CachingOptimized" policy.
    cache_policy_id            = "658327ea-f89d-4fab-a63d-7e88639e58f6"
    response_headers_policy_id = aws_cloudfront_response_headers_policy.site.id
  }

  # This app has no client-side router, so a missing key is genuinely "not found".
  # These SPA-style fallbacks are OPTIONAL — they make CloudFront serve index.html
  # (HTTP 200) for unknown paths instead of an S3 AccessDenied/NotFound. Keep them
  # if you might add routing later; delete them for strict 404 behavior.
  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }
  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.site.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }
}
```

---

## Step 5 — Route 53 alias records — `route53.tf`

```hcl
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
```

---

## Step 6 — GitHub Actions OIDC role — `github_oidc.tf`

This lets GitHub Actions assume an AWS role **without any stored secret keys** —
GitHub presents a short-lived OIDC token, AWS trusts it for your repo + branch only.

```hcl
data "aws_caller_identity" "current" {}

# One OIDC provider per account. If you already have it, import or data-source it
# instead of re-creating.
resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  # AWS validates GitHub's cert chain itself; this thumbprint is no longer
  # security-critical but the field is still required.
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

data "aws_iam_policy_document" "gha_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_repo}:ref:refs/heads/${var.github_branch}"]
    }
  }
}

resource "aws_iam_role" "gha_deploy" {
  name               = "${var.bucket_name}-gha-deploy"
  assume_role_policy = data.aws_iam_policy_document.gha_assume.json
}

data "aws_iam_policy_document" "gha_deploy" {
  statement {
    sid     = "SyncBucket"
    effect  = "Allow"
    actions = ["s3:ListBucket"]
    resources = [aws_s3_bucket.site.arn]
  }
  statement {
    sid       = "WriteObjects"
    effect    = "Allow"
    actions   = ["s3:PutObject", "s3:DeleteObject"]
    resources = ["${aws_s3_bucket.site.arn}/*"]
  }
  statement {
    sid       = "Invalidate"
    effect    = "Allow"
    actions   = ["cloudfront:CreateInvalidation"]
    resources = [aws_cloudfront_distribution.site.arn]
  }
}

resource "aws_iam_role_policy" "gha_deploy" {
  name   = "deploy"
  role   = aws_iam_role.gha_deploy.id
  policy = data.aws_iam_policy_document.gha_deploy.json
}
```

### `outputs.tf`

```hcl
output "bucket_name" {
  value = aws_s3_bucket.site.id
}

output "cloudfront_distribution_id" {
  value = aws_cloudfront_distribution.site.id
}

output "cloudfront_domain" {
  value = aws_cloudfront_distribution.site.domain_name
}

output "app_url" {
  value = "https://${var.domain_name}"
}

output "gha_deploy_role_arn" {
  value = aws_iam_role.gha_deploy.arn
}
```

---

## Step 7 — Provision the infrastructure

```bash
cd infra
tofu init
tofu plan      # review — expect ~15 resources to add
tofu apply     # type "yes"
```

The apply blocks on ACM DNS validation (usually 2–5 minutes) and the CloudFront
distribution deploying (can take 5–15 minutes the first time). When it finishes,
note the outputs:

```bash
tofu output
# app_url                    = "https://spinner.example.com"
# bucket_name                = "spinner-app-prod-1234"
# cloudfront_distribution_id = "E1XXXXXXXXXXXX"
# gha_deploy_role_arn        = "arn:aws:iam::123456789012:role/spinner-app-prod-1234-gha-deploy"
```

At this point the domain resolves and serves HTTPS, but the bucket is empty — you'll
get a 403/404 (or, with the SPA fallbacks, a blank `index.html` miss). Deploy the
files next.

---

## Step 8 — Manual first deploy (AWS CLI)

The cache strategy matters: **hashed assets are immutable and cache for a year;
`index.html` must never be cached**, so a new deploy is visible immediately. Do it
in two passes — everything except `index.html` with a long immutable cache, then
`index.html` with no-cache.

```bash
# from the repo root
npm run build

BUCKET=$(cd infra && tofu output -raw bucket_name)
DIST_ID=$(cd infra && tofu output -raw cloudfront_distribution_id)

# 1) Upload hashed assets with a 1-year immutable cache. --delete removes files
#    from the bucket that no longer exist in dist/ (old hashed bundles).
aws s3 sync dist/ "s3://$BUCKET/" \
  --delete \
  --exclude "index.html" \
  --cache-control "public, max-age=31536000, immutable"

# 2) Upload index.html last, with no-cache so viewers always get the newest HTML
#    (which references the newest hashed assets).
aws s3 cp dist/index.html "s3://$BUCKET/index.html" \
  --cache-control "no-cache, no-store, must-revalidate" \
  --content-type "text/html; charset=utf-8"

# 3) Invalidate CloudFront's cached HTML so the edge serves the new index.html now.
aws cloudfront create-invalidation \
  --distribution-id "$DIST_ID" \
  --paths "/index.html" "/"
```

> Why invalidate only `/index.html` and `/`? The asset filenames are content-hashed,
> so a new build produces new URLs that were never cached — no invalidation needed
> for them. Only `index.html` is served from a stable URL, so it's the one thing to
> invalidate. Invalidations for the first 1,000 paths/month are free.

Visit `https://spinner.example.com` — you should see the app. Hard-refresh once if
you had visited during setup.

---

## Step 9 — Automated deploys with GitHub Actions

Add `.github/workflows/deploy.yml`. It builds and deploys on every push to `main`,
assuming the OIDC role from Step 6 (no secrets to store).

```yaml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

# Required for OIDC: the job requests a token to assume the AWS role.
permissions:
  id-token: write
  contents: read

concurrency:
  group: deploy-prod
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci
      - run: npm run lint
      - run: npm run format:check
      - run: npm test
      - run: npm run build

      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ vars.AWS_DEPLOY_ROLE_ARN }}
          aws-region: us-east-1

      - name: Sync assets (immutable) and index.html (no-cache)
        run: |
          aws s3 sync dist/ "s3://${{ vars.AWS_S3_BUCKET }}/" \
            --delete --exclude "index.html" \
            --cache-control "public, max-age=31536000, immutable"
          aws s3 cp dist/index.html "s3://${{ vars.AWS_S3_BUCKET }}/index.html" \
            --cache-control "no-cache, no-store, must-revalidate" \
            --content-type "text/html; charset=utf-8"

      - name: Invalidate CloudFront
        run: |
          aws cloudfront create-invalidation \
            --distribution-id "${{ vars.AWS_CLOUDFRONT_DISTRIBUTION_ID }}" \
            --paths "/index.html" "/"
```

Then in the GitHub repo, add three **repository variables** (Settings → Secrets and
variables → Actions → _Variables_ tab — these are not secret):

| Variable                         | Value (from `tofu output`)   |
| -------------------------------- | ---------------------------- |
| `AWS_DEPLOY_ROLE_ARN`            | `gha_deploy_role_arn`        |
| `AWS_S3_BUCKET`                  | `bucket_name`                |
| `AWS_CLOUDFRONT_DISTRIBUTION_ID` | `cloudfront_distribution_id` |

This reuses the same lint/format/test gates as your existing CI, so a deploy only
happens if the suite is green. Push to `main` (or run the workflow manually via
"Run workflow") to deploy.

> **Note:** this repo's `main` currently isn't pushed to a remote. Push it first
> (`git remote add origin …` / `git push -u origin main`) before the Actions
> pipeline can run.

---

## Step 10 — Verify

```bash
# TLS + HTTP→HTTPS redirect
curl -sI http://spinner.example.com | grep -i location      # -> https://...
curl -sI https://spinner.example.com | head -n 1            # -> HTTP/2 200

# index.html is not cached; assets are immutable
curl -sI https://spinner.example.com/ | grep -i cache-control
# -> no-cache, no-store, must-revalidate
curl -s https://spinner.example.com/ | grep -o 'assets/[^"]*\.js' | head -1
curl -sI "https://spinner.example.com/$(curl -s https://spinner.example.com/ | grep -o 'assets/[^"]*\.js' | head -1)" \
  | grep -i cache-control
# -> public, max-age=31536000, immutable

# Security headers present
curl -sI https://spinner.example.com/ | grep -iE 'strict-transport|content-security|x-content-type|x-frame'
```

Then open the site in a browser and click a wheel — the spin, tick sound, and memo
should all work exactly as in local dev. (If the fonts render as plain sans-serif,
check the CSP allows `fonts.googleapis.com`/`fonts.gstatic.com`.)

---

## Cost estimate

For a low-traffic gag app this is effectively free-tier / pennies:

| Service                  | Rough cost                                                                                           |
| ------------------------ | ---------------------------------------------------------------------------------------------------- |
| S3 storage               | A few MB → ~$0.00                                                                                    |
| S3 + CloudFront requests | Free tier covers 1 TB/mo egress + 10M requests (first 12 months); after that, cents for this traffic |
| CloudFront               | PriceClass_100 (NA/EU edges) minimizes cost                                                          |
| Route 53 hosted zone     | $0.50/month per zone (you likely already pay this)                                                   |
| ACM certificate          | Free                                                                                                 |
| CloudFront invalidations | First 1,000 paths/month free                                                                         |

Expect well under **$1/month** unless the app goes viral.

---

## Teardown

```bash
# Empty the bucket first (OpenTofu won't delete a non-empty versioned bucket).
aws s3 rm "s3://$(cd infra && tofu output -raw bucket_name)/" --recursive

# If versioning left delete markers / old versions, purge them too (or set
# force_destroy = true on the bucket resource before applying, then destroy).
cd infra && tofu destroy
```

CloudFront distributions take several minutes to disable + delete during destroy —
this is normal.

---

## Troubleshooting

| Symptom                                                                       | Cause / fix                                                                                                                                                                           |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tofu apply` hangs on `aws_acm_certificate_validation`                        | The validation CNAME isn't resolving. Confirm `hosted_zone_name` is the exact zone and that Route 53 is authoritative for it (NS records at the registrar point to this zone).        |
| CloudFront returns **AccessDenied (403)** for every path                      | Bucket policy/OAC mismatch. Ensure `aws_s3_bucket_policy` references the distribution ARN and the origin uses `origin_access_control_id`. Also confirm `index.html` was uploaded.     |
| Site works but shows the **old version** after deploy                         | You didn't invalidate `/index.html`, or `index.html` was uploaded with a long cache. Re-run the invalidation and confirm its `cache-control` is `no-cache`.                           |
| **CERT_INVALID / domain mismatch** in browser                                 | The ACM cert must cover the exact hostname in `aliases`. For apex + `www`, add both to `domain_name`/`subject_alternative_names` and to `aliases`.                                    |
| Fonts fall back to system sans-serif                                          | CSP blocks Google Fonts. Ensure `style-src` includes `https://fonts.googleapis.com` and `font-src` includes `https://fonts.gstatic.com`, or drop the `content_security_policy` block. |
| GitHub Actions: **"Not authorized to perform sts:AssumeRoleWithWebIdentity"** | The `sub` condition doesn't match. It must be `repo:OWNER/REPO:ref:refs/heads/main` exactly; check `github_repo`/`github_branch` and that the push is to that branch.                 |
| `BucketAlreadyExists` on apply                                                | `bucket_name` is globally unique across all AWS accounts — pick another.                                                                                                              |

---

## Optional: remote OpenTofu state (do this before collaborating)

Local `terraform.tfstate` is fine solo. For a team, add a backend so state is shared
and locked. Create an S3 bucket + DynamoDB table once (out of band), then add to
`providers.tf`:

```hcl
terraform {
  backend "s3" {
    bucket         = "your-tf-state-bucket"
    key            = "spinner/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "your-tf-locks"
    encrypt        = true
  }
}
```

Run `tofu init -migrate-state` to move existing local state up.

> **OpenTofu ≥ 1.10** can lock state natively in the S3 backend (set
> `use_lockfile = true`), so the `dynamodb_table` line is optional on newer
> versions. It's kept above because it also works on 1.6–1.9.

---

## Summary of what you run, start to finish

```bash
# one-time infra
cd infra && tofu init && tofu apply

# first deploy (manual)
cd .. && npm run build
BUCKET=$(cd infra && tofu output -raw bucket_name)
DIST_ID=$(cd infra && tofu output -raw cloudfront_distribution_id)
aws s3 sync dist/ "s3://$BUCKET/" --delete --exclude index.html \
  --cache-control "public, max-age=31536000, immutable"
aws s3 cp dist/index.html "s3://$BUCKET/index.html" \
  --cache-control "no-cache, no-store, must-revalidate" --content-type "text/html; charset=utf-8"
aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths "/index.html" "/"

# thereafter: push to main → GitHub Actions builds, tests, deploys, invalidates
```
