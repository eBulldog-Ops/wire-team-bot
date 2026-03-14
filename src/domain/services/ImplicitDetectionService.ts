import type { QualifiedId } from "../ids/QualifiedId";

/**
 * Input for implicit intent detection (Phase 3). Recent messages and conversation context.
 */
export interface ImplicitDetectionInput {
  conversationId: QualifiedId;
  recentMessages: { senderId: QualifiedId; text: string; messageId: string }[];
  /** Per-conversation sensitivity: strict | normal | aggressive */
  sensitivity: "strict" | "normal" | "aggressive";
}

/**
 * A candidate action/decision/knowledge item detected from natural language (no explicit keyword).
 */
export interface ImplicitCandidate {
  type: "task" | "decision" | "action" | "knowledge";
  confidence: number;
  summary: string;
  /** Extracted payload for the type, e.g. description, assignee reference, deadline text */
  payload: Record<string, unknown>;
}

/**
 * Port for implicit intent detection (Phase 3). Implementation typically calls an LLM.
 * Contract: input recent messages + config → list of candidates with confidence.
 */
export interface ImplicitDetectionService {
  detect(input: ImplicitDetectionInput): Promise<ImplicitCandidate[]>;
}
