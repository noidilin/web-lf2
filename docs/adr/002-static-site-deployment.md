# ADR 002 — Static site deployment with private S3 and CloudFront

**Status:** Accepted

**Context:** Issue #12 requires the dev static game to be served through HTTPS from a CDN endpoint with the backing object storage remaining private. This is the first real infrastructure slice in the Phase 2 AWS baseline.

**Decision:**

Implement the static site module with:

| Component | Choice |
|---|---|
| Object storage | S3 bucket with public access fully blocked |
| CDN | CloudFront distribution with Origin Access Control (OAC) |
| TLS | ACM certificate in us-east-1, validated via Route 53 DNS |
| DNS | Route 53 alias A/AAAA records to CloudFront |
| Cache policy | Custom policy: 1-day default TTL, 1-year max, no query string/cookie/header forwarding |
| Viewer protocol | HTTPS-only (redirect-to-https) |
| Provider config | Default provider for ap-northeast-1 (from root.hcl), aliased us-east-1 provider for ACM |

S3 bucket policy grants `s3:GetObject` only to CloudFront via OAC, scoped to the distribution ARN. The bucket has versioning enabled, SSE-S3 encryption with bucket keys, and full public access block.

The deployment pipeline (GitHub Actions) syncs `dist/static/` to S3, then issues a CloudFront invalidation on `/*`. A deployed Playwright smoke test verifies the game loads from the CDN URL.

**Consequences:**

- Game artifacts are only accessible through CloudFront — direct S3 access is denied
- HTTPS is enforced for all viewers
- Cache invalidation is part of every deployment so releases are predictable
- The module can be reused for prod by changing the stack inputs (domain, name prefix)
- ACM certificate creation and DNS validation are managed by Terraform, not manual steps
