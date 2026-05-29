# Plan Phase 4 — Backend scalability and F.Lobby modernization

## Goal

Prepare the multiplayer lobby backend for multiple replicas by replacing in-memory room/session state with shared infrastructure.

This phase makes horizontal scaling safe before introducing Kubernetes or advanced orchestration.

## When to start

Start this phase only after:

- ECS Fargate deployment is stable
- ALB HTTPS/WSS works reliably
- CI/CD deploys the lobby service
- structured logs and basic alarms exist
- F.Lobby behavior is covered by integration tests

## Scope

From the original modernization plan, this phase covers:

- Stage 11 — Observability v2 and custom metrics
- Stage 12 — F.Lobby v2 compatibility replacement
- Stage 13 — Redis-backed scaling

## Target architecture

```txt
ALB
  |
  v
ECS Fargate service
  - lobby task 1
  - lobby task 2
  - lobby task N
  |
  v
Redis / ElastiCache
  - room metadata
  - peer/session state
  - pub/sub for chat/signaling coordination
```

## Key rule

Preserve the existing browser contract:

```txt
GET  /protocol
GET  /lobby
POST /login
WS   /chat
WS   /peer
```

Do not require the game client to understand a new multiplayer protocol.

## Tasks

### 1. Document current F.Lobby behavior

Before rewriting or scaling, document:

- login request/response shape
- room creation behavior
- room join behavior
- active/passive role assignment
- `id1` and `id2` peer identifiers
- iframe handshake
- `event: start` message shape
- chat message behavior
- peer signaling behavior
- disconnect behavior

### 2. Add compatibility tests

Add tests that lock down the current protocol.

Coverage:

- `GET /protocol`
- `GET /lobby`
- `POST /login`
- WebSocket `/chat`
- WebSocket `/peer`
- two-player room flow
- disconnect cleanup
- invalid room/name behavior

### 3. Introduce Redis/ElastiCache

Use Redis for shared state:

```txt
rooms
users
connections
peer mappings
room TTLs
```

Use Redis pub/sub where needed for cross-instance coordination:

```txt
chat messages
peer signaling
room events
```

### 4. Scale ECS service beyond one task

Only after Redis-backed state is working:

```txt
desiredCount = 2+
```

Validate:

- players can join the same room across different tasks
- WebSocket connections remain stable
- task replacement does not corrupt room state
- ALB health checks and graceful shutdown work

### 5. Add autoscaling

Add ECS autoscaling based on:

- CPU
- memory
- custom connection count metric, optional

Be conservative. Multiplayer state is more sensitive than stateless HTTP.

### 6. Observability v2

Add custom CloudWatch metrics:

```txt
LobbyActiveConnections
LobbyRooms
LobbyMessages
LobbyErrors
LobbyLoginFailures
```

Add useful structured log events:

- room created
- room joined
- room expired
- player connected
- player disconnected
- peer signal sent
- login rejected
- rate limit triggered

## Acceptance criteria

- Redis-backed room/session state works locally
- Redis-backed state works in AWS
- ECS service can run at least two tasks safely
- two players can join and play through different backend tasks
- custom metrics appear in CloudWatch
- dashboard includes app-level lobby metrics
- alarms cover backend health and lobby errors
- F.Lobby browser contract remains unchanged

## Portfolio value

This phase demonstrates:

- stateful WebSocket scaling
- Redis-backed distributed coordination
- compatibility-preserving backend modernization
- custom metrics
- production scaling strategy

## Do not do yet

Avoid in this phase:

- EKS migration before multi-replica ECS works
- changing the game client protocol
- introducing Kubernetes to solve app-state problems
- adding autoscaling before correctness is proven
