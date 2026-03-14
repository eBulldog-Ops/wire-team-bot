# Wire Team Bot - Feature Requirements Specification

Version: 0.3
Date: 2026-03-13
Status: Draft
SDK Reference: https://dev.wire.com/developer-interface/

---

## 1. System Context

### 1.1 Bot Identity and SDK

The bot is a Wire App built on the Wire JVM SDK (`wire-apps-jvm-sdk`). It runs as a persistent service that calls `startListening()` to receive events via WebSocket. All interactions with Wire are performed through `WireApplicationManager`, which provides both suspending (Kotlin coroutines) and blocking (Java) variants of each method.

The bot is added to Wire conversations as a member. It receives events for all conversations it belongs to. It can also receive 1:1 direct messages.

### 1.2 Wire Identifiers

All Wire entities use `QualifiedId` (UUID + domain string) to support federated backends. The bot MUST store and reference all user and conversation identifiers as `QualifiedId` throughout.

Key identifier types used by the bot:

| Wire Concept | Type | Source |
|---|---|---|
| Conversation ID | `QualifiedId` | From received `WireMessage.conversationId` or `getStoredConversations()` |
| User ID (sender) | `QualifiedId` | From received `WireMessage.sender` |
| Message ID | `UUID` | From received `WireMessage.id` |
| Team ID | `UUID` | From `getStoredTeams()` or `conversation.teamId` |

### 1.3 Conversation Semantics

A Wire conversation maps to a team, project, or customer engagement. The bot maintains awareness of each conversation it belongs to by calling `getStoredConversations()` on startup and tracking `onAppAddedToConversation` / `onConversationDeleted` events thereafter.

For each conversation, the bot MUST maintain a local cache of:

- Conversation `QualifiedId` and associated `teamId`
- All members and their roles, obtained via `getStoredConversationMembers(conversationId)` which returns `List<ConversationMember>` where each member has a `userId: QualifiedId` and `role: ConversationRole` (ADMIN or MEMBER)
- User display names and handles, obtained via `getUser(userId)` which returns `UserResponse` containing `name`, `handle`, `email`, `teamId`, `accentId`, and `deleted` flag

The member cache MUST be updated in real time by handling `onUserJoinedConversation` and `onUserLeftConversation` events.

### 1.4 Roles and Permissions

Wire conversations have two roles: `ConversationRole.ADMIN` and `ConversationRole.MEMBER`. The bot maps these directly:

- **ADMIN** (Wire conversation admin): Can configure bot settings for the conversation, access audit logs, export data, manage other users' entities (edit/delete), and configure implicit detection sensitivity.
- **MEMBER** (Wire conversation member): Can create entities, update/delete their own entities, update status on entities assigned to them, search and retrieve entities scoped to their conversation memberships.

There is no separate bot-level admin concept. Wire conversation admins ARE bot admins for that conversation.

### 1.5 Interaction Modes

**In-conversation:** The bot receives all messages via `onTextMessageReceived`. It responds using `WireMessage.Text.create(conversationId, text)` for confirmations. For longer outputs (search results, digests, lists), the bot uses `WireMessage.Text.createReply(conversationId, text, originalMessage)` to reply to the triggering message, keeping results contextual and reducing channel noise.

**1:1 DM:** The user messages the bot directly. The bot responds with data aggregated across all conversations the user is a member of. The bot determines the user's conversation memberships by iterating `getStoredConversations()` and checking `getStoredConversationMembers()` for each. Queries can be scoped explicitly: "my actions in #project-atlas" or left unscoped for cross-conversation results.

**Composite messages (bot-exclusive):** For confirmation prompts, the bot SHOULD use `WireMessage.Composite.create()` which combines text with interactive buttons. Only apps can send composite messages. This is the preferred mechanism for implicit detection confirmations:

```
WireMessage.Composite.create(
    conversationId = conversationId,
    text = "Shall I track that?\n> @Sarah to finalise the RFP response, due Friday",
    buttonList = listOf(
        WireMessage.Button(text = "Confirm"),
        WireMessage.Button(text = "Edit"),
        WireMessage.Button(text = "Dismiss")
    )
)
```

Button responses are received via `onButtonClicked` event.

**Mentions:** When the bot needs to notify a specific user in-conversation, it uses the `Mention` object with the user's `QualifiedId`, `offset`, and `length` in the message text. This is required for task assignments, reminders, and nudges delivered in-conversation.

**Reactions:** The bot can use `WireMessage.Reaction.create()` to acknowledge messages with emoji reactions. This is useful for lightweight confirmations (e.g. reacting with a checkmark when an explicit trigger is processed) without adding message clutter.

### 1.6 Event Handling

The bot subclasses `WireEventsHandler` and MUST implement handlers for the following events:

| Event | Bot behaviour |
|---|---|
| `onTextMessageReceived` | Primary input. Parse for explicit triggers, run implicit detection, process queries. |
| `onAppAddedToConversation` | Initialise conversation: cache members, send welcome/help message. |
| `onConversationDeleted` | Clean up: archive all entities for this conversation, remove from local cache. |
| `onAssetMessageReceived` | Store asset references when capturing decision context or knowledge entries that include files. |
| `onButtonClicked` | Handle confirm/edit/dismiss responses from composite messages (implicit detection prompts). |
| `onTextMessageEdited` | If an edited message was the source of a captured entity, flag the entity for review. |
| `onMessageDeleted` | If a deleted message was the source of a captured entity, flag the entity (do not auto-delete). |
| `onUserJoinedConversation` | Update member cache. |
| `onUserLeftConversation` | Update member cache. Reassign or flag any open entities assigned to the departing user. |

Events the bot does NOT need to handle: `onPingReceived`, `onLocationMessageReceived`, `onMessageDelivered`, `onMessageReactionReceived`, `onInCallReactionReceived`, `onInCallHandRaiseReceived`.

### 1.7 Trigger Model

Every feature supports two trigger types:

**Explicit:** A keyword prefix or direct bot mention with a command. Processed immediately. No confirmation required unless the input is ambiguous (e.g. unresolvable user reference, ambiguous date).

**Implicit:** Natural language pattern matching detects intent without a keyword. The bot ALWAYS confirms via composite message (text + buttons) before storing or acting. Implicit detection is conservative by default. Configurable sensitivity per conversation: `strict` (explicit only), `normal` (high-confidence implicit patterns), `aggressive` (broader pattern matching).

### 1.8 User Resolution

When a message references a user, the bot resolves it as follows:

1. **@mention in message:** The Wire SDK provides `Mention` objects with `userId: QualifiedId` embedded in the `WireMessage.Text`. This is the most reliable resolution path and requires no fuzzy matching.
2. **Display name or handle in text:** Match against the local member cache (populated from `getUser()` calls). If ambiguous (multiple matches), ask for clarification using a composite message listing the candidates.
3. **Pronouns / implicit references:** ("I'll do it", "leave it with me") resolve to `message.sender`.
4. **Unresolvable:** Store the raw text reference with a flag for manual resolution.

### 1.9 Date and Time Parsing

All features that accept dates/times MUST handle:

- Absolute dates: "March 20", "2026-03-20", "20/03/2026"
- Relative dates: "tomorrow", "Friday", "next week", "in 3 days", "end of week", "end of month"
- Relative times: "in 2 hours", "this afternoon"
- Named periods: "end of sprint" (requires sprint configuration), "end of quarter"

Interpretation rules:
- "Friday" = the next upcoming Friday. If today is Friday, it means today.
- "End of week" = Friday 18:00 in the conversation's configured timezone.
- "Next week" = Monday of the following week.
- "Tomorrow" = the next calendar day.
- If ambiguous, ask for clarification via composite message with options.
- All dates stored as UTC. Conversation timezone is configurable (default: Europe/Berlin).

---

## 2. Data Architecture

### 2.1 Shared Fields

Every stored entity includes:

```
id                  string        Auto-generated, prefixed by type (TASK-0001, DEC-0001, ACT-0001, KB-0001, REM-0001)
conversation_id     QualifiedId   Wire conversation QualifiedId where the entity was created
author_id           QualifiedId   Wire user QualifiedId of the person who triggered creation
author_name         string        Display name at time of creation (denormalised for search/display)
raw_message_id      UUID          Wire message UUID that triggered creation
raw_message         string        Original message text verbatim
timestamp           datetime      UTC timestamp of creation
updated_at          datetime      UTC timestamp of last modification
tags                string[]      Auto-extracted and user-added tags
status              enum          Type-specific status values
deleted             boolean       Soft delete flag (default false)
version             integer       Incremented on each edit, previous versions retained
```

### 2.2 Entity Types

| Type | Prefix | Feature |
|------|--------|---------|
| Task | TASK | Tasks and Reminders |
| Reminder | REM | Tasks and Reminders |
| Decision | DEC | Decision Logging |
| Action | ACT | Action Tracking |
| Knowledge | KB | Knowledge Capture |

### 2.3 Storage Requirements

- PostgreSQL with `tsvector`/`ts_query` for full-text search across all text fields.
- Optional: `pgvector` for semantic search on knowledge entries (can be deferred to Phase 4).
- All `QualifiedId` fields stored as composite (uuid + domain string) or serialised JSON.
- Soft delete by default. Hard delete available to conversation admins via configuration.
- Edit history: each update creates a new version row. Current version is the default query target; previous versions accessible by explicit version lookup.

### 2.4 Permissions Model

- A user can read/search entities from any conversation they are a member of (verified against the bot's member cache).
- A user can edit or delete entities they created (`entity.author_id == user QualifiedId`).
- A user who is the assignee of a task/action can update its status.
- Conversation admins (`ConversationRole.ADMIN`) can edit/delete any entity in that conversation, access audit logs, configure bot settings, and export data for that conversation.
- 1:1 DM queries return entities aggregated across the user's conversation memberships.

---

## 3. Feature: Tasks and Reminders

### 3.1 Purpose

Explicit task assignment and time-based reminders. This is the bot's existing core capability, documented here for completeness and to define the integration surface with the new features.

### 3.2 Task Data Model

```
id                  string        TASK-prefixed unique ID
description         string        Plain-language task description
assignee_id         QualifiedId   Wire user responsible
assignee_name       string        Display name at time of assignment (denormalised)
creator_id          QualifiedId   Wire user who created the task
conversation_id     QualifiedId   Originating conversation
deadline            datetime?     Optional deadline (UTC)
status              enum          open | in_progress | done | cancelled
priority            enum          low | normal | high | urgent
recurrence          string?       Optional recurrence rule (daily, weekly, monthly, custom cron)
linked_ids          string[]      References to related entities (DEC-*, ACT-*, KB-*)
completion_note     string?       Optional note added on completion
created_at          datetime      UTC
updated_at          datetime      UTC
```

### 3.3 Trigger Patterns

**Explicit:**
- "@bot task @Sarah review the API docs by Friday" -> assignee resolved from @mention QualifiedId, deadline=Friday
- "@bot task: update the staging config" -> assignee=message.sender (self-assigned), no deadline
- "task: @Emil write the threat model intro, high priority, due March 20" -> parsed with priority and deadline

**Implicit:**
- "@Sarah can you review the API docs by Friday?" -> composite prompt: "Shall I create a task for @Sarah to review the API docs, due Friday?" [Confirm] [Edit] [Dismiss]
- "Someone needs to update the staging config" -> composite prompt: "Shall I create a task? Who should I assign it to?" with buttons listing conversation members
- "I'll handle the docs update" -> composite prompt: "Shall I track that as a task for you?" [Confirm] [Dismiss]

### 3.4 Functional Requirements

| Requirement | Description | Details |
|---|---|---|
| Create | Create a task from explicit or confirmed implicit trigger | Parse assignee (@mention -> QualifiedId), description, deadline, priority from natural language |
| Assign | Assign to any member of the conversation | Resolved from @mention (preferred) or name match against member cache |
| Reassign | "@bot reassign TASK-0012 to @name" | Sends mention notification to both original and new assignee |
| Status update | Assignee or creator can update status | "TASK-0012 done", "done with the API review" (fuzzy match to user's open tasks) |
| Priority | Set or change priority | "high priority", "urgent", "bump TASK-0012 to high" |
| Deadline | Set, change, or remove deadline | "@bot push TASK-0012 to next Monday", "@bot remove deadline from TASK-0012" |
| Recurrence | Create recurring tasks | "@bot task: weekly standup notes, every Monday". Bot generates new TASK instance on schedule. |
| My tasks | User's open tasks | 1:1 DM: across all conversations. In-conversation: scoped. Sorted by deadline (overdue first), then priority. |
| Channel tasks | All open tasks in the conversation | Grouped by assignee, sorted by deadline. Delivered as reply to triggering message. |
| Link | Link a task to a decision, action, or knowledge entry | "TASK-0012 ref DEC-0005" or auto-link when created from a decision prompt |

### 3.5 Reminder Data Model

```
id                  string        REM-prefixed unique ID
description         string        Reminder text
target_id           QualifiedId   Wire user to be reminded
conversation_id     QualifiedId?  Originating conversation (null if created in 1:1)
trigger_at          datetime      When to fire (UTC)
recurrence          string?       Optional recurrence rule
status              enum          pending | fired | cancelled
linked_ids          string[]      Optional references to related entities
created_at          datetime      UTC
```

### 3.6 Reminder Trigger Patterns

**Explicit:**
- "@bot remind me to check the build at 3pm"
- "@bot remind @Sarah about the client call tomorrow at 9am"
- "@bot remind me every Monday at 9am to review the backlog"

**System-generated (from other features):**
- Task deadline approaching -> reminder to assignee
- Action overdue -> nudge to assignee
- Knowledge staleness threshold reached -> revalidation prompt to author

### 3.7 Reminder Delivery

- If the reminder has a `conversation_id`, deliver in-conversation using a text message with @mention of the target user.
- If created in 1:1 or flagged as private, deliver via 1:1 DM to the target user.
- If the target user's `UserResponse.deleted` flag is true, log the failure and notify the creator (if different from target).

---

## 4. Feature: Decision Logging

### 4.1 Purpose

Capture decisions made in conversation with enough context to be useful later. Prevent repeated discussions about things already agreed.

### 4.2 Data Model

```
id                  string        DEC-prefixed unique ID
summary             string        Clean decision statement
raw_message         string        Original message verbatim
raw_message_id      UUID          Wire message UUID
context             object[]      Array of {user_id: QualifiedId, user_name: string, message_text: string, message_id: UUID, timestamp: datetime}
author_id           QualifiedId   Decision maker
participants        QualifiedId[] Users active in the conversation at the time (from member cache)
conversation_id     QualifiedId   Originating conversation
status              enum          active | superseded | revoked
superseded_by       string?       ID of the newer decision
supersedes          string?       ID of the older decision
linked_ids          string[]      References to related entities
attachments         object[]      Array of {asset_id: string, filename: string, mime_type: string} from onAssetMessageReceived in context window
created_at          datetime      UTC
updated_at          datetime      UTC
```

### 4.3 Trigger Patterns

**Explicit:**
- "decision: we're going with LiveKit for the SFU evaluation"
- "decided: API versioning will use URL path, not headers"
- "@bot log decision: all PRs require two reviewers from now on"

Bot responds with text message: "Logged DEC-0042: We're going with LiveKit for the SFU evaluation." and reacts to the original message with a checkmark emoji via `WireMessage.Reaction.create()`.

**Implicit (patterns to detect):**
- "let's go with X"
- "we've agreed to X"
- "final call is X"
- "the plan is X"
- "so we're doing X then"
- "OK, confirmed: X"

On implicit detection, bot sends composite message:
```
Text: "That sounds like a decision. Shall I log it?\n> [extracted decision summary]"
Buttons: [Confirm] [Edit] [Dismiss]
```

User response received via `onButtonClicked`. On "Edit", bot prompts for corrected text.

### 4.4 Context Capture

When a decision is logged, the bot stores the preceding N messages from the conversation as context. The bot maintains a rolling message buffer per conversation (populated from `onTextMessageReceived` events). Default N=10, configurable per conversation by admins.

Asset messages received via `onAssetMessageReceived` within the context window are stored as attachment references (not the asset data itself).

### 4.5 Functional Requirements

| Requirement | Description | Details |
|---|---|---|
| Capture | Store decision on explicit trigger, confirm with ID and summary | React to source message with checkmark |
| Implicit detection | Detect decision patterns, prompt via composite message | Sensitivity configurable per conversation by admins |
| Context capture | Store preceding N messages from rolling buffer | Configurable window, default 10 |
| Search | Full-text search across summaries, context, tags | "bot, decisions about SFU", "bot, decisions last week" |
| List | List recent decisions, filterable by conversation, author, date, tag | Reply to triggering message with paginated results |
| Supersede | New decision explicitly supersedes an older one | "decision: switching to Pion, supersedes DEC-0042" |
| Revoke | Mark a decision as revoked without replacement | "bot, revoke DEC-0042" with optional reason |
| Auto-tag | Extract project names, component names, entities from text | Present auto-tags via composite message for confirmation |
| Digest | Periodic summary of decisions | Delivered in-conversation or via 1:1 DM, configurable by admins |
| Prompt for actions | After logging, send composite: "Any actions from this?" [Yes] [No] | If yes, enter action creation flow linked to the decision |
| Export | JSON, CSV, or Markdown scoped by conversation/date/tag | Admin only |

---

## 5. Feature: Action Tracking

### 5.1 Purpose

Capture commitments made in conversation and follow up on them. Actions originate from conversational commitments rather than explicit assignment, but share follow-up and accountability mechanics with tasks.

### 5.2 Data Model

```
id                  string        ACT-prefixed unique ID
description         string        Plain-language action description
raw_message         string        Original message verbatim
raw_message_id      UUID          Wire message UUID
assignee_id         QualifiedId   Person responsible
assignee_name       string        Display name at assignment time
creator_id          QualifiedId   Person who triggered creation
conversation_id     QualifiedId   Originating conversation
deadline            datetime?     Parsed deadline, nullable
status              enum          open | in_progress | done | cancelled | overdue
linked_ids          string[]      References to related entities
reminders           datetime[]    Scheduled reminder timestamps (auto-generated from deadline)
completion_note     string?       Optional note on completion
created_at          datetime      UTC
updated_at          datetime      UTC
```

### 5.3 Trigger Patterns

**Explicit:**
- "action: @Sarah finalise the RFP response by Friday"
- "@bot action: investigate LiveKit pricing, ref DEC-0042"

**Implicit (patterns to detect):**
- First-person: "I'll sort that out", "I'm going to handle the migration" -> assignee = message.sender
- Second-person: "@Sarah can you review this?" -> assignee resolved from @mention QualifiedId
- Volunteering: "I can take that", "leave it with me" -> assignee = message.sender
- Unassigned: "we need to do X" -> composite message asking who should own it, with conversation member buttons

On implicit detection, bot sends composite message:
```
Text: "Shall I track that?\n> @Sarah to finalise the RFP response, due Friday"
Buttons: [Confirm] [Edit] [Dismiss]
```

### 5.4 Functional Requirements

| Requirement | Description | Details |
|---|---|---|
| Capture | Store on explicit or confirmed implicit trigger | Parse assignee, description, deadline |
| Deadline parsing | Extract deadlines from natural language | See Section 1.9 for rules |
| Status update | Assignee or creator can update via natural language | "ACT-0012 done", "done with the RFP review" |
| Reminders | Auto-generate reminders before deadline | Default: 24h before, at deadline. Delivered as 1:1 DM with @mention. |
| Overdue nudges | Escalating nudge sequence if deadline passes | At deadline, +1 day, +3 days, then weekly. Via 1:1 DM. |
| My actions | User's open actions | 1:1: cross-conversation. In-conversation: scoped. Sorted by deadline, overdue first. |
| Team actions | All open actions in the conversation | Grouped by assignee. Reply to triggering message. |
| Reassign | Reassign to another conversation member | Both parties notified via @mention |
| Link to decision | Explicit or auto-link | "ref DEC-0042" or auto-linked from decision prompt flow |
| Promote to task | Convert action to formal task | "bot, promote ACT-0012 to task" creates TASK with linked_id back to the action |
| Duplicate detection | Check for similar open tasks before creating | If match found, composite: "This looks similar to TASK-0045. Same thing or new?" [Same] [New action] |
| Weekly digest | Open, completed, overdue per conversation | Configurable day/time, default Monday 09:00 conversation timezone |
| No-deadline prompt | Periodically prompt assignee if no deadline set | After configurable days (default 7). Via 1:1 DM. |
| User departure | Handle `onUserLeftConversation` for assigned actions | Flag open actions, notify conversation admins, prompt for reassignment |
| Export | JSON, CSV scoped by conversation, user, date, status | Admin only |

### 5.5 Action vs Task

Actions and tasks are closely related. The differences:

- **Origin:** Tasks are explicitly created. Actions are detected from conversational commitments.
- **Formality:** Tasks have priority and recurrence. Actions are lighter-weight.
- **Promotion:** An action can be promoted to a task for more structure.
- **Unified view:** "bot, everything assigned to me" returns both tasks and actions, sorted by deadline.

---

## 6. Feature: Knowledge Capture

### 6.1 Purpose

Build a searchable knowledge base from conversation. Capture tribal knowledge as it surfaces naturally in chat rather than requiring deliberate wiki updates.

### 6.2 Data Model

```
id                  string        KB-prefixed unique ID
summary             string        Concise, searchable summary
detail              string        Full text, may include code blocks or structured data
raw_message         string        Original message verbatim
raw_message_id      UUID          Wire message UUID
author_id           QualifiedId   Contributor
author_name         string        Display name at creation time
conversation_id     QualifiedId   Originating conversation
category            enum          factual | procedural | contact | configuration | reference
confidence          enum          high (explicit) | medium (confirmed implicit) | low (unconfirmed)
related_ids         string[]      Related KB entry IDs
ttl_days            integer?      Days until staleness check (default 90, nullable for permanent)
verified_by         object[]      Array of {user_id: QualifiedId, timestamp: datetime}
retrieval_count     integer       Times retrieved (for ranking)
last_retrieved      datetime?     Timestamp of last retrieval
created_at          datetime      UTC
updated_at          datetime      UTC
```

### 6.3 Trigger Patterns

**Explicit storage:**
- "bot, remember that the Schwarz API rate limit is 500/min"
- "note: staging deploys require VPN"
- "@bot knowledge: the Pexip integration uses endpoint X for auth"

Bot responds: "Got it. Stored as KB-0034: Schwarz API rate limit is 500 requests/min. Tagged: schwarz, api, rate-limit." and reacts with checkmark.

**Explicit retrieval:**
- "bot, what's the Schwarz API rate limit?"
- "bot, how do we deploy to staging?"

Bot replies to the triggering message with matching entries.

**Implicit capture:**
- User A: "what's the rate limit for the Schwarz API?"
- User B: "500 requests per minute"
- Bot sends composite:
```
Text: "Shall I remember that?\n> Schwarz API rate limit: 500 requests/min"
Buttons: [Confirm] [Edit] [Dismiss]
```

Implicit capture ONLY triggers when:
1. A question was asked in the preceding messages (detected from rolling buffer).
2. The answer appears factual or procedural (not opinion, not conversational).
3. The answer is from a different user than the questioner.

### 6.4 Functional Requirements

| Requirement | Description | Details |
|---|---|---|
| Store | Capture from explicit trigger, confirm with summary and tags | React to source message with checkmark |
| Retrieve | Natural language search | Reply to triggering message with top results |
| Implicit capture | Detect Q&A patterns, offer to store via composite message | Conservative: only factual/procedural answers |
| Update | Update existing entry | "bot, update KB-0012: rate limit is now 1000/min". Old value versioned. |
| Categorise | Auto-categorise | User can override via composite buttons |
| Related entries | Show related entries alongside results | Tag overlap and text similarity |
| Staleness check | Prompt revalidation after ttl_days | Composite to author: "Still accurate?" [Yes] [Update] [Archive] |
| Contradiction detection | Flag conflicting entries | Composite: "This contradicts KB-0008. Which is correct?" [Keep new] [Keep old] [Keep both] |
| Browse by tag | "bot, knowledge tagged 'schwarz'" | AND/OR for multiple tags |
| Retrieval ranking | Rank by relevance, recency, confidence, frequency | Weights configurable by admins |
| Export | JSON, CSV, Markdown | Admin only. Markdown export useful for wiki seeding. |
| Bulk import | Import from JSON/CSV | For bootstrapping |
| Completion-to-knowledge | When task/action completed with detailed note, offer to capture | Composite: "Store as knowledge?" [Confirm] [Dismiss] |

### 6.5 Search and Retrieval

When a user asks a question:

1. Search knowledge base for matching entries (scoped to user's conversation memberships).
2. If matches found: reply to triggering message with top result(s) including summary, detail, author name, last updated, confidence, originating conversation.
3. If no matches: "I don't have anything on that. If someone answers, I can capture it." (Bot then watches for a response to auto-trigger implicit capture.)
4. Increment `retrieval_count` and update `last_retrieved` on returned entries.

Ranking inputs: text relevance score, recency (`updated_at`), confidence level, retrieval frequency. Default weights: relevance 0.4, recency 0.3, confidence 0.2, frequency 0.1. Configurable by conversation admins.

---

## 7. Cross-Feature Interactions

### 7.1 Entity Linking

Any entity can link to any other entity via `linked_ids`. Links are bidirectional (stored on both entities). Links are created:

- **Explicitly:** "ref DEC-0042" in a creation trigger
- **Prompted:** composite message after decision logging: "Any actions from this?"
- **Automatic:** action created from decision prompt, task created from action promotion

### 7.2 Unified Search

"Bot, what do we know about LiveKit?" searches across ALL entity types and replies with results grouped by type:

```
Decisions:
  DEC-0042: Going with LiveKit for SFU evaluation (2026-02-15, active)

Actions:
  ACT-0018: Investigate LiveKit pricing (@Sarah, done 2026-03-01)

Tasks:
  TASK-0089: Set up LiveKit dev environment (@Emil, open, due 2026-03-20)

Knowledge:
  KB-0034: LiveKit Cloud pricing: $X/participant-minute (high confidence, updated 2026-03-02)
```

### 7.3 Unified Personal View (1:1 DM)

"bot, my stuff" or "bot, my open items" returns a combined view across all the user's conversations:

- Open tasks assigned to the user
- Open actions assigned to the user
- Pending reminders
- Knowledge entries pending their revalidation

Sorted by urgency: overdue first, then nearest deadline, then most recent.

### 7.4 Conversation Summary

In-conversation, "bot, summary" returns:

- Recent decisions (last 7 days)
- Open tasks and actions (grouped by assignee)
- Upcoming deadlines (next 7 days)
- Recently added knowledge entries

Configurable as an automated periodic post (e.g. Monday morning digest). Admins configure day/time.

---

## 8. Bot Commands Reference

All commands can be triggered by @mention or by keyword prefix. The bot also accepts natural language variants. In all cases, the triggering message's `conversationId` and `sender` are used to scope and attribute the operation.

### 8.1 Tasks

```
@bot task @user [description] [by deadline] [priority]
@bot my tasks
@bot channel tasks / @bot team tasks
@bot [TASK-ID] done [optional note]
@bot [TASK-ID] status [new status]
@bot reassign [TASK-ID] to @user
@bot [TASK-ID] priority [level]
@bot [TASK-ID] deadline [new deadline]
@bot [TASK-ID] remove deadline
```

### 8.2 Reminders

```
@bot remind me [description] at [time]
@bot remind @user [description] at [time]
@bot remind me every [recurrence] to [description]
@bot my reminders
@bot cancel [REM-ID]
```

### 8.3 Decisions

```
decision: [statement]
decided: [statement]
@bot log decision: [statement]
@bot decisions [search query]
@bot decisions last [period]
@bot decisions by @user
@bot decisions tagged [tag]
@bot revoke [DEC-ID] [optional reason]
@bot [DEC-ID] superseded by [new statement]
```

### 8.4 Actions

```
action: @user [description] [by deadline]
@bot my actions
@bot team actions
@bot [ACT-ID] done [optional note]
@bot [ACT-ID] in progress
@bot reassign [ACT-ID] to @user
@bot promote [ACT-ID] to task
```

### 8.5 Knowledge

```
@bot remember [statement]
@bot note: [statement]
@bot knowledge: [statement]
@bot what is/are [query]?
@bot how do we [query]?
@bot [any natural language question]
@bot update [KB-ID]: [new value]
@bot knowledge tagged [tag]
@bot verify [KB-ID]
```

### 8.6 Global

```
@bot search [query]                   # cross-entity search
@bot my stuff                         # unified personal view (1:1 DM only)
@bot summary                          # conversation overview
@bot help                             # command reference
@bot settings                         # show conversation config (admin only)
```

---

## 9. Configuration Schema

All configuration is per-conversation unless noted. Configurable by conversation admins (`ConversationRole.ADMIN`) only. Defaults are sensible for a team of 5-15 people.

```yaml
conversation:
  timezone: "Europe/Berlin"
  locale: "en"
  purpose: ""                           # free text: team name, project, customer
  message_buffer_size: 50               # rolling buffer of recent messages for context capture

implicit_detection:
  enabled: true
  sensitivity: "normal"                 # strict | normal | aggressive
  cooldown_minutes: 20                  # min gap between implicit prompts in same conversation
  max_implicit_per_hour: 3              # rate limit per conversation

tasks:
  default_priority: "normal"
  reminder_before_deadline_hours: 24
  overdue_nudge_schedule: [0, 24, 72, 168]  # hours after deadline
  weekly_digest: true
  digest_day: "monday"
  digest_time: "09:00"

decisions:
  context_window: 10                    # preceding messages to capture
  auto_tag: true
  auto_tag_confirm: true                # require confirmation of auto-tags
  digest: "weekly"                      # off | daily | weekly
  digest_day: "friday"
  digest_time: "16:00"

actions:
  reminder_before_deadline_hours: 24
  overdue_nudge_schedule: [0, 24, 72, 168]
  no_deadline_prompt_days: 7
  weekly_digest: true
  digest_day: "monday"
  digest_time: "09:00"
  duplicate_detection: true

knowledge:
  default_ttl_days: 90
  staleness_check: true
  contradiction_detection: true
  implicit_capture: true
  retrieval_ranking_weights:
    relevance: 0.4
    recency: 0.3
    confidence: 0.2
    frequency: 0.1

notifications:
  delivery: "dm"                        # dm | in_conversation | both
  quiet_hours_start: "22:00"
  quiet_hours_end: "07:00"

admin:
  hard_delete_enabled: false
  export_enabled: true
  data_retention_days: null             # null = indefinite
```

---

## 10. Non-Functional Requirements

| Requirement | Target | Notes |
|---|---|---|
| Response latency (explicit) | < 2 seconds | From `onTextMessageReceived` to confirmation sent |
| Response latency (implicit) | < 5 seconds | Pattern analysis + composite message construction |
| Availability | Match Wire service SLA | Queue events if backend temporarily unavailable |
| Conversation scale | Up to 500 members | Member cache must handle this |
| Message throughput | 10,000 messages/day/conversation | Rolling buffer and implicit detection must remain performant |
| Data at rest | Encrypted | Follow Wire's existing standards |
| Audit log | All bot actions logged | Entity CRUD, queries, config changes, with actor QualifiedId and timestamp |
| Search latency | < 1s keyword, < 3s semantic | Keyword must never degrade below 1s at scale |
| Graceful degradation | If LLM unavailable, fall back to keyword matching | Implicit detection disabled; explicit triggers and keyword search still work |
| Message editing | Handle `onTextMessageEdited` | If source message of an entity is edited, flag entity for review |
| Message deletion | Handle `onMessageDeleted` | If source message of an entity is deleted, flag entity (do not auto-delete) |
| User departure | Handle `onUserLeftConversation` | Flag open entities, prompt admins for reassignment |

---

## 11. Wire SDK Capability Mapping

Reference mapping of bot features to Wire JVM SDK methods. Full documentation: https://dev.wire.com/developer-interface/

| Bot requirement | SDK method / event | Notes |
|---|---|---|
| Receive messages | `WireEventsHandler.onTextMessageReceived` | Primary input event |
| Send confirmation | `WireApplicationManager.sendMessage(WireMessage.Text)` | Plain text responses |
| Send confirmation with buttons | `WireApplicationManager.sendMessage(WireMessage.Composite)` | Bot-exclusive. For implicit detection prompts. |
| Receive button clicks | `WireEventsHandler.onButtonClicked` | Response to composite messages |
| Reply to message | `WireMessage.Text.createReply(conversationId, text, originalMessage)` | For search results, digests, lists |
| Mention user | `WireMessage.Mention(userId, offset, length)` in `WireMessage.Text` | For notifications and assignments |
| React to message | `WireMessage.Reaction.create(conversationId, messageId, emojiSet)` | Lightweight acknowledgement |
| Edit bot's own message | `WireMessage.TextEdited.create(replacingMessageId, conversationId, text)` | Update previous bot responses. Note: message ID changes on edit. |
| Delete bot's own message | `WireMessage.Deleted.create(conversationId, messageId)` | Clean up expired prompts |
| List conversations | `WireApplicationManager.getStoredConversations()` | Returns conversation IDs and team IDs |
| List conversation members | `WireApplicationManager.getStoredConversationMembers(conversationId)` | Returns `List<ConversationMember>` with userId and role (ADMIN/MEMBER) |
| Get user info | `WireApplicationManager.getUser(userId)` / `getUserSuspending(userId)` | Returns name, handle, email, teamId, deleted flag |
| Track member changes | `onUserJoinedConversation`, `onUserLeftConversation` | Keep member cache current |
| Track conversation lifecycle | `onAppAddedToConversation`, `onConversationDeleted` | Initialise and archive |
| Track message edits | `onTextMessageEdited` | Flag affected entities |
| Track message deletions | `onMessageDeleted` | Flag affected entities |
| Receive files | `onAssetMessageReceived` | Store references in decision context |
| Send files (export) | `WireApplicationManager.sendAsset(conversationId, asset, name, mimeType, retention)` | For CSV/JSON/Markdown exports. Use `AssetRetention.ETERNAL`. |
| Ephemeral messages | `WireMessage.Text.create(..., expiresAfterMillis)` | Optional: use for time-limited prompts |

---

## 12. Open Questions

1. **LLM provider and model.** Implicit detection and natural language search benefit from an LLM. Which provider/model? Latency and cost constraints? Recommendation: explicit triggers are always rule-based (fast, deterministic). LLM for implicit detection and free-form retrieval, with keyword fallback.

2. **Semantic search scope.** Is `pgvector` for knowledge retrieval in scope for v1 or deferred? Keyword search (`tsvector`) is the baseline.

3. **Context window privacy.** Surrounding messages captured for decision context include messages from users who did not explicitly opt in. Recommendation: capture automatically, notify the conversation when context is stored, allow users to request removal of their messages from context.

4. **Existing task/reminder integration.** The bot already has task and reminder capability. Is the existing implementation refactored to this spec, or does new development wrap/extend it?

5. **ID generation.** Per-conversation sequence, global sequence, or UUID with prefix? Recommendation: global sequence with type prefix for human readability.

6. **Rolling message buffer.** The bot needs to buffer recent messages per conversation for context capture and implicit detection. Sizing and persistence strategy needed (in-memory vs Redis vs database).

7. **Federated backends.** `QualifiedId` supports federation. Confirm whether cross-domain conversations are in scope and what implications this has for member resolution and data scoping.

8. **Rate limiting feedback loop.** If users frequently dismiss implicit prompts (tracked via `onButtonClicked` dismiss count), should the bot auto-reduce sensitivity for that conversation?

---

## 13. Implementation Priorities

Each phase is independently deployable and useful.

**Phase 1: Foundation + Tasks/Reminders alignment**
- Shared data model and storage (PostgreSQL)
- Conversation member cache (from `getStoredConversationMembers`, updated via join/leave events)
- User resolution (from @mentions via `WireMessage.Mention`, name matching via `getUser()`)
- Date/time parsing
- Tasks and reminders (align existing implementation to this spec)
- Explicit triggers only (rule-based)
- Basic keyword search (`tsvector`)
- Rolling message buffer per conversation (from `onTextMessageReceived`)

**Phase 2: Decision Logging + Action Tracking**
- Decision capture (explicit triggers)
- Action capture (explicit triggers)
- Context capture for decisions (from rolling buffer, including `onAssetMessageReceived` references)
- Composite messages for confirmations (`WireMessage.Composite` + `onButtonClicked`)
- Entity linking
- Status updates, reassignment (with @mention notifications)
- Auto-generated reminders and overdue nudges (via 1:1 DM)

**Phase 3: Implicit Detection + Knowledge Capture**
- LLM integration for implicit pattern detection
- Implicit triggers for decisions and actions (composite prompts)
- Knowledge capture (explicit and implicit)
- Staleness and contradiction detection
- Retrieval ranking

**Phase 4: Intelligence and Polish**
- Unified cross-entity search
- Conversation summaries and automated digests
- Semantic/vector search for knowledge (`pgvector`)
- Duplicate detection (actions vs tasks)
- Export via `sendAsset` and bulk import
- Feedback-driven sensitivity tuning
- User departure handling (reassignment flows via `onUserLeftConversation`)
