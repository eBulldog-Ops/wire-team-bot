import type { QualifiedId } from "../ids/QualifiedId";

/**
 * Result item from knowledge search. May be extended for cross-entity search (Phase 4).
 */
export interface KnowledgeSearchHit {
  id: string;
  summary: string;
  detail: string;
  authorName: string;
  conversationId: QualifiedId;
  confidence: string;
  updatedAt: Date;
  retrievalCount: number;
  score: number;
}

export interface KnowledgeSearchInput {
  query: string;
  conversationIds?: QualifiedId[];
  limit?: number;
}

/**
 * Port for search and ranking. Phase 3: keyword search over knowledge.
 * Phase 4: cross-entity and optional semantic (pgvector).
 */
export interface SearchService {
  searchKnowledge(input: KnowledgeSearchInput): Promise<KnowledgeSearchHit[]>;
}
