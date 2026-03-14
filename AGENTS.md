# AGENTS.md – AI agent guidance for Wire Team Bot

This file gives AI agents working on this repository a concise contract: where the plan lives, how the app is structured, and how to keep the codebase maintainable, secure, and testable. **PLAN.md** is the single source of truth for architecture, phases, and delivery state; this document summarises rules and desires for agent behaviour.

---

## 1. Authoritative plan

- **Read PLAN.md first.** It defines:
  - Hexagonal architecture and dependency rules
  - Repository layout (`src/app`, `src/domain`, `src/application`, `src/infrastructure`, `tests/`)
  - Entities, ports, use cases, and phase-by-phase delivery
  - Current delivery state (Phase 0.5–3 done, Phase 4 not started)
- Do not redefine architecture, module boundaries, or repo structure. If the plan is unclear or conflicts with a requested change, ask for PLAN.md to be updated before implementing.

---

## 2. Application architecture (desires)

- **Layers and dependencies** (from PLAN §1.1):
  - `domain`: pure business logic, entities, repository/service **interfaces** only. No SDK, DB, or framework imports.
  - `application`: use cases and orchestration; depends only on `domain` and **ports** (interfaces). No direct adapter or infra imports.
  - `infrastructure`: adapters (Wire, Postgres, LLM, scheduler, time); implement ports; depend on application/domain, not the reverse.
  - `app`: bootstrap and composition root only; wires the graph, no business logic.
- **Ports over concrete implementations:** Use cases and domain services talk to the outside world only via ports (e.g. `WireOutboundPort`, `SchedulerPort`, `TaskRepository`, `ImplicitDetectionService`). Application code must never call `wire-apps-js-sdk` or Prisma directly.
- **Where new code belongs:**
  - New entity or repository contract → `src/domain/`
  - New use case → `src/application/usecases/`
  - New application-level service → `src/application/services/`
  - New port → `src/application/ports/` or `src/domain/services/` (interface only)
  - New adapter → `src/infrastructure/` (wire, persistence, llm, scheduler, etc.)
  - Wiring → `src/app/container.ts` and `config.ts` as needed.
- **Conventions:** Follow existing patterns (e.g. Prisma repositories in `src/infrastructure/persistence/postgres/`, Vitest under `tests/`). Preserve separation of concerns; avoid cross-layer coupling or “clever” abstractions unless the plan explicitly calls for them.

---

## 3. Maintainability (desires)

- Prefer **small, reviewable changes** that are easy to test and reason about.
- **One concern per module:** Keep use cases focused; shared orchestration belongs in application services.
- **Explicit over implicit:** Prefer clear parameters and return types; avoid magic or hidden side effects.
- **Consistency:** Match existing naming, file layout, and style (TypeScript/ESLint as used in the repo).
- Do not introduce new services, components, or dependencies unless PLAN.md or the user explicitly requests them. If something is unknown, state assumptions and suggest how to verify.

---

## 4. Security (desires)

- **Secrets:** All secrets (Wire credentials, DB URL, LLM API keys) must come from **environment variables or a secure config path**, never hardcoded. Use the central `Config` in `src/app/config.ts`; keep validation explicit.
- **Audit trail:** Bot actions that create, update, or delete domain entities (and significant config/export operations) must be recorded via `AuditLogRepository` and domain events as described in PLAN §5.2. Do not bypass audit for convenience.
- **Least privilege:** When adding config or permissions, default to minimal access and explicit opt-in (e.g. per-conversation features like implicit detection).
- **Input and output:** Validate and sanitise inputs at boundaries (e.g. Wire message parsing, LLM response parsing). Treat LLM outputs as untrusted; validate structure and bounds before persistence or outbound calls.
- **Dependencies:** Prefer dependency and security updates via Renovate or equivalent; do not add dependencies without considering supply-chain and licence implications.

---

## 5. Testability (desires)

- **Unit tests (domain & application):**
  - No JS SDK, DB, or network. Use in-memory stub repositories and stub port implementations.
  - Cover parsing, permission rules, state transitions, and date/time handling. Keep tests fast and deterministic.
- **Integration tests:**
  - Repositories and adapters against real Postgres (e.g. docker-compose or testcontainers). Gate with env (e.g. `INTEGRATION_TESTS=1`) as in PLAN §6.
  - Wire adapter behaviour via a fake SDK client or test harness that simulates events.
- **Contract tests:** Verify that `WireEventRouter` maps SDK events to the correct application commands and that `WireOutboundAdapter` produces the expected SDK calls for canonical responses.
- **Test location and tooling:** Tests live under `tests/` (e.g. `tests/usecases/`). Use **Vitest** (see PLAN §8). New use cases and non-trivial domain/application logic should have corresponding tests; match existing test structure and naming.
- **Acceptance criteria:** For any planned work item, acceptance criteria should be observable and testable; prefer explicit expectations over vague “it works” checks.

---

## 6. Quick reference

| Topic            | Reference / rule |
|------------------|------------------|
| Plan & phases    | PLAN.md §7, §9   |
| Dependency rules | PLAN.md §1.1; domain → nothing, application → domain + ports, infrastructure → application/domain |
| Repo layout      | PLAN.md §2, §9 (current layout) |
| Wire integration | PLAN.md §3; application uses `WireOutboundPort` only |
| Persistence      | Prisma in `src/infrastructure/persistence/postgres/` |
| Config & secrets | `src/app/config.ts`; env-driven, no hardcoded secrets |
| Tests            | Vitest under `tests/`; unit vs integration as in PLAN §6 |

When in doubt, align with PLAN.md and the existing codebase; if a change would cross architectural boundaries or contradict the plan, flag it and ask for plan clarification before proceeding.
