import type { QualifiedId } from "../ids/QualifiedId";

export type KnowledgeCategory =
  | "factual"
  | "procedural"
  | "contact"
  | "configuration"
  | "reference";

export type KnowledgeConfidence = "high" | "medium" | "low";

export interface KnowledgeVerifiedBy {
  userId: QualifiedId;
  timestamp: Date;
}

export interface KnowledgeEntry {
  id: string;
  summary: string;
  detail: string;
  rawMessage: string;
  rawMessageId: string;
  authorId: QualifiedId;
  authorName: string;
  conversationId: QualifiedId;
  category: KnowledgeCategory;
  confidence: KnowledgeConfidence;
  relatedIds: string[];
  ttlDays: number | null;
  verifiedBy: KnowledgeVerifiedBy[];
  retrievalCount: number;
  lastRetrieved: Date | null;
  tags: string[];
  timestamp: Date;
  updatedAt: Date;
  deleted: boolean;
  version: number;
}
