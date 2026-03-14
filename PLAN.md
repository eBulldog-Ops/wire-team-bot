## Wire Team Bot – Architecture & Delivery Plan

Version: 0.2  
Date: 2026-03-14  
Scope: TypeScript/Node.js bot built on `wire-apps-js-sdk` implementing the features and phases defined in `wire-bot-requirements.md`.

---

## 0. Assumptions & Constraints

- **Runtime**: Node.js LTS (≥ 20), TypeScript.
- **Wire SDK**: `wire-apps-js-sdk` (JavaScript/TypeScript SDK) as the integration surface; the JVM-specific names in `wire-bot-requirements.md` are treated as *conceptual* and mapped to equivalent JS SDK capabilities.
- **Persistence**: PostgreSQL as primary store (full-text search via `tsvector/tsquery`), with room for `pgvector` later.
- **Process model**: Single long-running bot process per deployment, horizontally scalable (stateless except for caches that can be rebuilt from DB + Wire).
- **Infrastructure (high level)**:
  - App packaged as a Docker image and run via Docker Compose alongside a Postgres container (and, optionally, a Redis container).
  - All necessary services (bot + Postgres [+ optional Redis]) are defined in a self-contained `docker-compose.yml` in this repository.
  - Optional: Redis for rolling message buffers and background jobs (can start in-memory for early phases).
- **Non-functional**: Targets in section 10 of `wire-bot-requirements.md` apply; architecture must support:
  - < 2–5s response latency per trigger.
  - 10k msgs/day/conversation.
  - Clear audit trail of all bot actions.
- **AI / NLP**: We use AI (LLM) for natural language processing: implicit intent detection (Phase 3), optional NL parsing of command payloads and dates, and semantic search (Phase 3–4). Explicit trigger *recognition* (keywords) stays rule-based. See §5.5.

---

## 1. Architectural Style & Dependency Rules

We use a **hexagonal / ports-and-adapters** architecture:

- **Domain layer**: Pure business logic, entity models, domain services, and repository interfaces. No SDK, DB, or framework imports.
- **Application layer**: Use cases and orchestrations. Coordinates domain objects, repositories, and external services via ports. Aware of domain and ports, but not concrete adapters.
- **Interface adapters layer**:
  - **Wire adapter**: Translates Wire SDK events to application commands and maps application responses to `wire-apps-js-sdk` calls.
  - **Persistence adapters**: Implement repository interfaces using PostgreSQL.
  - **LLM/analysis adapters**: Implement ports for implicit detection, semantic ranking, etc. (Phase 3+).
- **Bootstrap / composition root**: Wires everything together and starts the Wire SDK event loop.

### 1.1 Dependency direction

- `domain` depends on **nothing** from other layers.
- `application` depends only on `domain` and **ports** (TypeScript interfaces) defined in `domain` or `application`.
- `infrastructure` (adapters) depends on `application` and `domain` but **not** vice versa.
- `entrypoint` / `app` depends on all layers to compose the graph but contains no business logic.

Enforced via:

- Directory layout (see section 2).
- Lint rule(s) (e.g. ESLint import restrictions) to prevent inverted dependencies.

---

## 2. Repository Structure

Top-level:

- `src/`
- `tests/`
- `prisma/` or `db/` (schema + migrations; exact tool decided before Phase 1 coding)
- `config/` (non-secret config templates, e.g. YAML/JSON for defaults)
- `docker/` (Dockerfiles, compose overrides if needed)

### 2.1 `src` layout

- `src/app/` – **Application bootstrap & process**
  - `main.ts` – process entrypoint, loads config, initialises logging, connects to Postgres, sets up adapters, and starts the Wire client.
  - `container.ts` – simple composition root / DI wiring.
  - `config.ts` – strongly-typed runtime configuration (env, files) with validation.
  - `logging.ts` – logging setup (e.g. pino/winston) with structured fields (conversation/user IDs, entity IDs).
  - `metrics.ts` – hooks for basic metrics (latency, counts) if/when needed.

- `src/domain/` – **Pure domain model**
  - `ids/` – value objects for `QualifiedId`, conversation/user IDs, entity IDs, etc.
  - `entities/`
    - `Task.ts`
    - `Reminder.ts`
    - `Decision.ts`
    - `Action.ts`
    - `KnowledgeEntry.ts`
  - `services/`
    - `DateTimeService.ts` (ports for date parsing/timezone handling).
    - `UserResolutionService.ts` (contract for resolving users from mentions/text).
    - `ImplicitDetectionService.ts` (contract for implicit trigger detection – phase 3).
    - `SearchService.ts` (contract for unified search & ranking).
  - `repositories/` (ports only – interfaces, no implementation)
    - `TaskRepository.ts`
    - `ReminderRepository.ts`
    - `DecisionRepository.ts`
    - `ActionRepository.ts`
    - `KnowledgeRepository.ts`
    - `ConversationConfigRepository.ts`
    - `AuditLogRepository.ts`
  - `events/` – domain events (e.g. `TaskCreated`, `DecisionLogged`) for internal signalling.
  - `errors/` – domain-level error types.

- `src/application/` – **Use cases & orchestration**
  - `types/` – DTOs for requests/responses across layers (Wire-agnostic).
  - `usecases/` – one file (or cohesive group) per use case:
    - Tasks: `CreateTaskFromExplicit.ts`, `UpdateTaskStatus.ts`, `ListMyTasks.ts`, etc.
    - Reminders: `CreateReminder.ts`, `FireReminder.ts`, etc.
    - Decisions: `LogDecision.ts`, `SearchDecisions.ts`, etc.
    - Actions: `CreateAction.ts`, `UpdateActionStatus.ts`, etc.
    - Knowledge: `StoreKnowledge.ts`, `RetrieveKnowledge.ts`, etc.
    - Cross-feature: `UnifiedSearch.ts`, `UnifiedPersonalView.ts`, `ConversationSummary.ts`.
  - `services/` – application services that coordinate multiple repositories or domains (e.g. unified views, digests).
  - `ports/`
    - `ClockPort.ts` – for time (helps testing scheduling logic).
    - `WireOutboundPort.ts` – abstract operations like “sendTextReply”, “sendCompositePrompt”, “reactToMessage”, not raw SDK calls.
    - `SchedulerPort.ts` – schedule future work (reminders, digests) – can be backed by cron/queue.

- `src/infrastructure/` – **Adapters**
  - `wire/`
    - `WireClient.ts` – wrapper around `wire-apps-js-sdk` client creation and connection.
    - `WireEventRouter.ts` – maps SDK events to application-level commands.
    - `WireOutboundAdapter.ts` – implements `WireOutboundPort` using `wire-apps-js-sdk`.
    - `Mapping/` – mapping helpers between SDK DTOs and application DTOs.
  - `persistence/`
    - `postgres/`
      - `PrismaTaskRepository.ts` / `KyselyTaskRepository.ts` (once tool is chosen).
      - Other repository implementations.
      - `mappers/` – map DB rows to domain entities and back.
  - `llm/` (Phase 3+)
    - `OpenAIImplicitDetectionAdapter.ts` or equivalent – implements `ImplicitDetectionService` port.
  - `time/`
    - `SystemClockAdapter.ts` – real clock implementation of `ClockPort`.
  - `scheduler/`
    - Adapter(s) for running scheduled jobs (cron, bullmq, simple in-process scheduler).
  - `config/`
    - Adapter that loads validated config into `config.ts`.

---

## 3. Wire SDK Integration Design

### 3.1 Event flow (high level)

1. `WireClient` (infrastructure) subscribes to JS SDK events (message received, app added to conversation, button clicked, etc.).
2. `WireEventRouter` converts raw SDK events into **application commands**:
   - e.g. `TextMessageCommand`, `ButtonClickCommand`, `ConversationLifecycleCommand`.
3. A thin application-level dispatcher routes each command to the correct use case:
   - For `onTextMessageReceived`, parse explicit command keywords first (cheap, deterministic), then (Phase 3+) call `ImplicitDetectionService` for implicit candidates.
4. Use case interacts with domain entities/repositories and returns a **response model** describing:
   - Entities created/updated.
   - Outgoing messages to send (text, composite, reactions, files).
   - Audit log entries to record.
5. `WireOutboundAdapter` converts the response model to JS SDK calls.

### 3.2 Outgoing operations

Define a `WireOutboundPort` with operations such as:

- `sendPlainText(conversationId, text, options)` – optional reply-to.
- `sendCompositePrompt(conversationId, text, buttons, options)`.
- `sendReaction(conversationId, messageId, emoji)`.
- `sendFile(conversationId, fileStream, name, mimeType, retention)`.

Application/use cases **never** call the JS SDK directly; they only populate response DTOs or call `WireOutboundPort`.

---

## 4. Data & Storage Architecture (TypeScript View)

We keep the conceptual models from `wire-bot-requirements.md` and express them as:

- **Domain entities** (rich models with behaviour where appropriate, not just data bags).
- **Persistence models** tailored to Postgres schema.

Key decisions:

- **ID strategy**: Global sequences with prefixes (`TASK-0001`, `DEC-0001`, …) generated via a dedicated DB sequence per entity type (or a single sequence with type prefix). Port: `IdGeneratorPort` in domain, DB-backed implementation in infrastructure.
- **Full-text search**: Encapsulate FTS operations behind `SearchService` port so that:
  - Phase 1: implement via `tsvector/tsquery`.
  - Phase 4: extend with `pgvector` without leaking infra concerns into domain/application.
- **Soft deletes & versioning**:
  - Repositories expose methods like `archive`, `getVersionHistory`, etc., but domain treats `deleted=true` and `version` as part of entity state.

Schema/migration tooling (to be finalised before coding):

- **Option A**: Prisma ORM (`schema.prisma`, generated types, migrations).
- **Option B**: Kysely + migration tool (e.g. dbmate).

Either way, database-specific code remains in `src/infrastructure/persistence/postgres`.

---

## 5. Cross-Cutting Concerns

### 5.1 Configuration

- Centralised `Config` object built in `src/app/config.ts`, sourced from:
  - Environment variables for secrets and environment-specific values.
  - Optional static YAML/JSON for defaults (mirroring section 9 config schema).
- Conversation-level configuration persisted via `ConversationConfigRepository`.

### 5.2 Logging & Audit

- Structured logging at the infrastructure/app layers, correlated by:
  - Conversation ID (QualifiedId), User ID, Entity IDs (TASK-*, DEC-*).
- Dedicated `AuditLogRepository` and domain events for:
  - Entity CRUD, configuration changes, exports, and implicit detection prompts/responses.

### 5.3 Scheduling & Background Work

- `SchedulerPort` to encapsulate:
  - Reminders firing.
  - Overdue nudges.
  - Weekly digests.
  - Knowledge staleness checks.
- Initial implementation can be an in-process scheduler (cron-like in Node).
- Design leaves room to move to an external queue/worker model if needed.

### 5.4 Message Buffers & Implicit Detection

- Rolling message buffer per conversation:
  - Exposed as a domain/application-level service (e.g. `ConversationContextService`), backed by:
    - In-memory map (Phase 1–2) with configurable size (`message_buffer_size`) and safe caps.
    - Optional Redis adapter later for multi-instance deployments.
- Implicit detection in Phase 3 via `ImplicitDetectionService` port:
  - Implementation can call an LLM, but the port contract should stay simple (input: recent messages + config; output: list of candidate actions/decisions/knowledge with confidence).

### 5.5 AI and natural language processing

We use **AI (LLM) for natural language processing** as follows; this aligns with `wire-bot-requirements.md` (§1.7, §12 open question 1, §13 Phase 3).

- **Explicit triggers (Phase 1–2):** Remain **rule-based** (keyword prefixes, regex). Fast and deterministic. No LLM required for recognising "task:", "decision:", "action:", "reminder:", etc.
- **Implicit detection (Phase 3):** **LLM-backed.** Natural language pattern matching to detect task/decision/action/knowledge intent *without* keywords. Always confirmed via composite message before storing. Implemented behind `ImplicitDetectionService` port; adapter calls chosen LLM provider (see open decision: LLM provider).
- **Natural language parsing of payloads (optional enhancement):** Requirements (§1.9, §3) expect parsing of natural language *within* commands (e.g. "task: @Emil write the threat model, high priority, due March 20"; "remind me tomorrow at 3pm to call John"). Options:
  - **Phase 1–2:** Use a **date/time NL library** (e.g. chrono-node) behind `DateTimeService` for "tomorrow", "Friday", "in 2 hours"; keep assignee/description as simple text or @mention-only.
  - **Phase 3 or later:** Optionally use **LLM** to parse rich NL payloads (assignee, description, deadline, priority) from a single sentence for both explicit and implicit flows.
- **Search and knowledge (Phase 3–4):** Free-form retrieval and semantic search benefit from an LLM and/or embeddings (`pgvector`). Keyword search (`tsvector`) remains the baseline; graceful degradation when LLM unavailable (requirements §10).

**Summary:** AI/NLP is explicitly in scope. LLM is used for implicit detection and can be used for NL parsing and semantic search; explicit trigger *recognition* stays rule-based.

---

## 6. Testing Strategy

- **Unit tests** (domain & application):
  - No JS SDK, DB, or network.
  - Use in-memory stub repositories and ports.
  - Focus on parsing, permission rules, state transitions, and date/time handling.
- **Integration tests**:
  - Repositories against Postgres (via docker-compose or testcontainers).
  - Wire adapter tests using a fake JS SDK client or test harness that simulates events.
- **Contract tests**:
  - Verify `WireEventRouter` correctly maps events from `wire-apps-js-sdk` to application commands and expected responses.
  - Verify `WireOutboundAdapter` produces correct SDK calls for a set of canonical use case responses.
- **End-to-end smoke tests**:
  - Minimal: start the bot against a test Wire workspace and drive a handful of flows (task creation, decision logging, etc.) with scripted messages.

Preferred test tooling (to be confirmed):

- Vitest or Jest for unit/integration tests.
- Supertest or similar only if we expose HTTP endpoints later (not required initially).

---

## 7. Phase-by-Phase Implementation Plan (Architecture View)

This section maps the requirements’ phases (section 13) to concrete work in the proposed architecture.

### Phase 0.5 – Wire SDK Connectivity & Logging

- Minimal skeleton to validate connectivity and event flow before any persistence/domain work:
  - Implement `src/app/main.ts` to:
    - Load minimal config (Wire app credentials, log level) from environment.
    - Initialise logging and the `WireClient` wrapper.
    - Connect to Wire and start listening for events.
  - Implement `src/infrastructure/wire/WireClient.ts` as a thin wrapper over `wire-apps-js-sdk` with:
    - Login/authentication.
    - Subscription to basic events (`onTextMessageReceived`, `onAppAddedToConversation`, `onButtonClicked`).
  - Implement a temporary `WireEventLogger` that:
    - Logs every received event (type, conversation ID, sender, short text) to the console/structured logger.
    - Does **not** perform any business logic or DB writes.
- Provide a basic `docker-compose.yml` with:
  - A single `bot` service (no Postgres yet) that can be started and viewed via logs.
- Success criteria:
  - Bot logs successful startup and authentication.
  - Incoming messages to the app in Wire appear in the container logs with sufficient detail to debug parsing later.

### Phase 1 – Foundation + Tasks/Reminders

- Stand up core skeleton:
  - `src/app/main.ts`, `container.ts`, `config.ts`, logging, graceful shutdown.
  - `src/infrastructure/wire/WireClient.ts` + `WireEventRouter.ts` with only explicit triggers.
  - Domain entities and repositories for **shared fields**, `Task`, `Reminder`, **ConversationConfig**, and **AuditLog**.
  - Persistence adapter for Postgres and migrations for the above.
  - Rolling message buffer service (in-memory implementation).
- Implement use cases:
  - Explicit **Tasks** and **Reminders** flows as per section 3.
  - Member cache initialisation and update (using Wire JS SDK equivalents).
  - Date/time parsing service and configuration handling (timezone).
- Testing:
  - Unit tests for task/reminder creation, updates, permissions.
  - Integration tests for repositories and basic Wire event handling.

### Phase 2 – Decision Logging + Action Tracking

- Domain:
  - Entities: `Decision`, `Action`.
  - Repositories: `DecisionRepository`, `ActionRepository`.
  - Shared linking model via `linked_ids`.
- Application:
  - Use cases for decision logging, context capture, action capture, status updates, reassignment, etc.
  - Entity linking and cross-entity views where needed.
- Infrastructure:
  - Extend Postgres schema and repositories.
  - Extend `WireEventRouter` to route new explicit commands.
  - Implement composite messages via `WireOutboundPort` + adapter.
- Scheduling:
  - Implement `SchedulerPort` (even if only with in-process cron) for reminders, nudges, and weekly digests.

### Phase 3 – Implicit Detection + Knowledge Capture

- Domain/application:
  - Entity: `KnowledgeEntry`.
  - Use cases for explicit/implicit knowledge capture, retrieval, staleness/contradiction detection.
  - `ImplicitDetectionService` and `SearchService` ports with conservative, testable contracts.
- Infrastructure:
  - LLM-backed `ImplicitDetectionService` implementation (provider/model TBD).
  - Extension of search adapter to support richer ranking logic.
- Behaviour:
  - Integrate implicit detection into `WireEventRouter` flows, respecting per-conversation config and rate limits.

### Phase 4 – Intelligence & Polish

- Cross-entity search and unified views implemented as application-level orchestrations on top of existing repositories and `SearchService`.
- Conversation summaries and automated digests using `SchedulerPort`.
- Semantic search using `pgvector` behind `SearchService` port.
- Duplicate detection (actions vs tasks) and sensitivity tuning based on historical dismissals.
- User departure handling and reassignment flows building on existing domain events and repositories.

---

## 8. Architectural Decisions (resolved and open)

**Resolved:**

1. **DB access tool**: **Prisma** (schema in `prisma/schema.prisma`, migrations, generated client). All repository implementations live in `src/infrastructure/persistence/postgres/`.
2. **Test runner**: **Vitest** for unit and integration tests. Tests live under `tests/`; config in `vitest.config.ts`.
3. **Scheduler implementation**: **In-process** (`InProcessScheduler` implementing `SchedulerPort`) for Phase 1–2. Wired in composition root; can be replaced by a queue/worker later.

**Open:**

4. **Cache backing**: In-memory for message buffer and caches in early phases. Redis optional for multi-instance later.
5. **LLM provider**: Configurable via env: `LLM_PROVIDER`, `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`, `LLM_ENABLED`. Stub adapter in place; replace with real implementation in Phase 3.

---

## 9. Delivery State (for agents coding against this plan)

*Updated: 2026-03-14. Use this section to know what is implemented and what to do next.*

### Phase 0.5 – Done

- `main.ts` loads config (via `config.ts`), initialises logging, creates Wire client, starts listening. Graceful shutdown on SIGINT/SIGTERM.
- `WireClient.ts`: login, subscribe to events (`onTextMessageReceived`, `onAppAddedToConversation`, lifecycle). Event routing delegated to `WireEventRouter`.
- `WireEventRouter.ts`: maps SDK events to use-case invocations; maintains message buffer; explicit triggers only.
- `WireOutboundAdapter.ts`: implements `WireOutboundPort` (sendPlainText); used by use cases.
- `docker-compose.yml`: bot + Postgres.

### Phase 1 – Done

- **Done:** `config.ts`, `logging.ts`, `container.ts` (composition root), graceful shutdown. Domain: Task, Reminder, ConversationConfig, AuditLog (ports). Prisma: Task, Reminder, ConversationConfig, AuditLog tables and repository implementations. Use cases: `CreateTaskFromExplicit`, `UpdateTaskStatus`, `ListMyTasks`, `CreateReminder`, `FireReminder`. Rolling message buffer (`ConversationMessageBuffer`). Date/time: `DateTimeService` port + `SystemDateTimeService`; timezone from `ConversationConfigRepository` when parsing deadlines (tasks and reminders). Scheduler: `SchedulerPort` + `InProcessScheduler` wired; reminder jobs scheduled on create and fired via `FireReminder`. Member cache: `ConversationMemberCache` port + `InMemoryMemberCache`; updated from Wire lifecycle events (`onAppAddedToConversation`, `onUserJoinedConversation`, `onUserLeftConversation`, `onConversationDeleted`). Unit tests: `CreateTaskFromExplicit`, `LogDecision`, `CreateReminder`, `UpdateTaskStatus` under `tests/usecases/`. Integration test scaffold under `tests/integration/` (runs when `INTEGRATION_TESTS=1`).

### Phase 2 – Done

- **Done:** Decision and Action entities and Prisma repos; `LogDecision`, `CreateActionFromExplicit`, `UpdateActionStatus`; routing in `WireEventRouter`; `WireOutboundPort` (sendPlainText, sendCompositePrompt, sendReaction). `WireOutboundAdapter` implements composite as plain text + button labels (SDK TS has no Composite yet); sendReaction no-op until SDK supports it.
- **Done:** Decision use cases: `SearchDecisions`, `ListDecisions`, `SupersedeDecision`, `RevokeDecision`. Action use cases: `ListMyActions`, `ListTeamActions`, `ReassignAction`. All wired in `WireEventRouter` (e.g. "decisions about X", "list decisions", "decision: … supersedes DEC-0042", "revoke DEC-0042"; "my actions", "team actions", "ACT-001 reassign to @User").
- **Done:** Post-decision "Any actions from this?" via `sendCompositePrompt` after `LogDecision` (Yes/No buttons; button handling pending SDK support).
- **Done:** Overdue nudges: `ActionQuery.deadlineBefore`; `OverdueNudgeService` (query overdue actions, one message per conversation); scheduled daily via `SchedulerPort` (reschedule after each run).
- **Done:** Weekly digest: `WeeklyDigestService` (distinct conversations from tasks/actions/decisions, summary per conversation); scheduled weekly via `SchedulerPort` (reschedule after each run).
- **Done:** Unit tests for `SearchDecisions`, `ListDecisions`, `SupersedeDecision`, `RevokeDecision`, `ListMyActions`, `ListTeamActions`, `ReassignAction`; `LogDecision` test updated for sendCompositePrompt. Existing use case tests updated with full `WireOutboundPort` stub.

### Phase 3 – Done

- **Done:** Domain: `KnowledgeEntry` entity, `KnowledgeRepository` port, `SearchService` port (`searchKnowledge`). Conversation config extended with `implicitDetectionEnabled` and `sensitivity` (from `raw` in DB).
- **Done:** Prisma schema and migration for `KnowledgeEntry`; `PrismaKnowledgeRepository`; `PrismaSearchAdapter` (keyword search over knowledge with simple ranking).
- **Done:** Use cases: `StoreKnowledge` (explicit), `RetrieveKnowledge` (search + increment retrieval count), `CheckKnowledgeStaleness` (scheduled, one message per conversation for entries past TTL).
- **Done:** `OpenAIImplicitDetectionAdapter`: OpenAI-compatible chat API, prompt returns JSON candidates (task/decision/action/knowledge); used when `LLM_ENABLED`/apiKey set; otherwise `StubImplicitDetectionAdapter`.
- **Done:** `WireEventRouter`: explicit knowledge triggers ("knowledge: …", "remember that …", "note: …" → StoreKnowledge; "what's …", "how do we …" etc. → RetrieveKnowledge). When no explicit match: per-conversation implicit detection (if enabled), rate limit 60s per conv; on knowledge candidate (confidence ≥ 0.7) sends composite "Shall I remember that?" [Confirm] [Dismiss] (button handling pending SDK).
- **Done:** Knowledge staleness job scheduled daily; container wires knowledge repo, search service, store/retrieve/check use cases, and implicit detection (real or stub).
- **Done:** Unit tests for `StoreKnowledge`, `RetrieveKnowledge`.

### Phase 4 – Not started

- Cross-entity search, pgvector, digests, duplicate detection, user-departure handling.

### Repository layout (current)

- `src/app/`: `main.ts`, `config.ts`, `logging.ts`, `container.ts`. No `metrics.ts` yet.
- `src/domain/`: ids, entities (Task, Reminder, Decision, Action, KnowledgeEntry), services (DateTime, UserResolution, ConversationMemberCache, ImplicitDetectionService, SearchService), repositories (ports). No `events/`, `errors/` yet.
- `src/application/`: usecases (tasks, reminders, decisions, actions, knowledge), services (ConversationMessageBuffer), ports (WireOutbound, Scheduler, Clock optional).
- `src/infrastructure/wire/`: `WireClient.ts`, `WireEventRouter.ts`, `WireOutboundAdapter.ts`. No `Mapping/` yet.
- `src/infrastructure/persistence/postgres/`: Prisma client + Prisma*Repository for Task, Reminder, Decision, Action, KnowledgeEntry, ConversationConfig, AuditLog.
- `src/infrastructure/search/`: `PrismaSearchAdapter.ts` (implements SearchService).
- `src/infrastructure/scheduler/`: `InProcessScheduler.ts`.
- `src/infrastructure/services/`: `SystemDateTimeService`, `TrivialUserResolutionService`, `InMemoryMemberCache`.
- `src/infrastructure/llm/`: `LLMConfigAdapter.ts`, `StubImplicitDetectionAdapter.ts`, `OpenAIImplicitDetectionAdapter.ts`.
- `tests/`: Vitest; unit tests under `tests/usecases/`; integration scaffold under `tests/integration/` (run with `INTEGRATION_TESTS=1`).

