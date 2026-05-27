# Plan Phase 5 — Kubernetes/EKS capstone

## Goal

Migrate the already-stable lobby backend from ECS Fargate to Kubernetes on Amazon EKS as an advanced DevOps capstone.

This phase is optional. It should demonstrate Kubernetes operations, not compensate for missing application maturity.

## When to start

Start this phase only after:

- ECS Fargate lobby is stable
- CI/CD is mature
- Redis-backed shared state works
- multiple ECS tasks work correctly
- observability and alarms exist
- health checks and graceful shutdown are reliable

## Target architecture

```txt
CloudFront static frontend
  |
  | HTTPS / WSS to lobby domain
  v
Route 53: lobby.example.com
  |
  v
AWS Load Balancer Controller / ALB Ingress
  |
  v
EKS cluster
  |
  v
Kubernetes Deployment: lobby
  |
  v
Redis / ElastiCache
```

## Local-first path

Start with local Kubernetes before AWS:

```txt
kind or minikube
  -> lobby Deployment
  -> Service
  -> Ingress
  -> Redis test instance
```

Then move to EKS after local manifests are stable.

## Tasks

### 1. Kubernetes manifests or Helm chart

Recommended structure:

```txt
infra/k8s/
  chart/
    Chart.yaml
    values.yaml
    templates/
      deployment.yaml
      service.yaml
      ingress.yaml
      configmap.yaml
      secret.yaml
      hpa.yaml
      pdb.yaml
      serviceaccount.yaml
```

Or use plain manifests first:

```txt
infra/k8s/base/
infra/k8s/overlays/dev/
infra/k8s/overlays/prod/
```

### 2. Core Kubernetes resources

Add:

- Deployment
- Service
- Ingress
- ConfigMap
- Secret references
- ServiceAccount
- readiness probe
- liveness probe
- PodDisruptionBudget
- HorizontalPodAutoscaler

### 3. AWS EKS infrastructure

Provision:

- EKS cluster
- managed node groups or Fargate profiles
- IAM roles for service accounts where needed
- AWS Load Balancer Controller
- ECR image access
- CloudWatch Container Insights, optional

### 4. Ingress and TLS

Use one of these patterns:

```txt
Option A: AWS Load Balancer Controller + ACM certificate
Option B: NGINX Ingress + cert-manager
```

For AWS portfolio alignment, prefer:

```txt
AWS Load Balancer Controller + ACM
```

Optional additions:

- ExternalDNS for Route 53 records
- cert-manager if not using ACM directly

### 5. CI/CD deployment

Add Kubernetes deployment workflow:

```txt
checkout
  -> run tests
  -> build Docker image
  -> push to ECR
  -> helm lint/template
  -> deploy to EKS
  -> wait for rollout
  -> run smoke/integration tests
```

### 6. Observability

Add:

- pod logs
- Kubernetes events
- pod restart alerts
- HPA metrics
- ingress 4xx/5xx alerts
- custom lobby metrics from Phase 4

## Acceptance criteria

- lobby runs locally on kind/minikube
- lobby runs on EKS
- WSS works through Kubernetes ingress
- Redis-backed state works with multiple pods
- rollout and rollback are documented
- HPA and PDB are configured
- production smoke tests pass
- ECS deployment remains available as fallback or migration reference

## Portfolio value

This phase demonstrates:

- Kubernetes workload design
- Helm or Kustomize
- EKS operations
- ingress and TLS management
- HPA and disruption handling
- cloud-native deployment maturity

## Do not do too early

Avoid starting this phase before Redis-backed multi-replica ECS works.

Kubernetes will not fix in-memory state, weak tests, missing observability, or unclear deployment procedures. It should be the final capstone, not the foundation.
