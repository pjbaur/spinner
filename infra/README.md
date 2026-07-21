# infra/ — OpenTofu for Spinner hosting (S3 + CloudFront + Route 53)

Provisions the AWS hosting for this app. Full walkthrough:
[`../docs/deployment/aws-s3-cloudfront.md`](../docs/deployment/aws-s3-cloudfront.md).

Uses [OpenTofu](https://opentofu.org/) (`tofu`) — a drop-in fork of Terraform. The
`.tf` files (including the `terraform {}` settings block), `.terraform.lock.hcl`,
`terraform.tfvars`, and `terraform.tfstate` filenames are unchanged; only the CLI
binary differs. `tofu init` reconciles the lock file's provider registry entries.

## Quick start

```bash
cp terraform.tfvars.example terraform.tfvars   # then edit values
tofu init
tofu plan
tofu apply
tofu output           # bucket_name, cloudfront_distribution_id, gha_deploy_role_arn, ...
```

Then deploy the built app (from the repo root) per the deployment guide's Step 8,
or push to `main` to trigger `.github/workflows/deploy.yml`.

## Files

| File             | Purpose                                                                               |
| ---------------- | ------------------------------------------------------------------------------------- |
| `providers.tf`   | AWS providers — default region + an aliased `us-east-1` for the ACM cert              |
| `variables.tf`   | Input variables                                                                       |
| `s3.tf`          | Private bucket, public-access block, versioning, encryption, CloudFront-scoped policy |
| `acm.tf`         | DNS-validated TLS certificate (in us-east-1) via Route 53                             |
| `cloudfront.tf`  | OAC, security-headers/CSP policy, distribution                                        |
| `route53.tf`     | Alias A/AAAA records → CloudFront                                                     |
| `github_oidc.tf` | GitHub OIDC provider + deploy role (no stored keys)                                   |
| `outputs.tf`     | Values consumed by the deploy step / CI                                               |

## Notes

- The ACM certificate **must** be in `us-east-1` for CloudFront — that's what the
  aliased provider in `providers.tf` is for. The bucket can be elsewhere.
- State is local by default. Before collaborating, switch to a remote S3 backend
  (see the deployment guide's "Remote state" section).
- `terraform.tfvars` and `*.tfstate*` are gitignored — never commit them.
