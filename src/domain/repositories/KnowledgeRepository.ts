import type { KnowledgeEntry } from "../entities/KnowledgeEntry";
import type { QualifiedId } from "../ids/QualifiedId";

export interface KnowledgeQuery {
  conversationId?: QualifiedId;
  authorId?: QualifiedId;
  searchText?: string;
  tagsAll?: string[];
  tagsAny?: string[];
  limit?: number;
}

export interface KnowledgeRepository {
  create(entry: KnowledgeEntry): Promise<KnowledgeEntry>;
  update(entry: KnowledgeEntry): Promise<KnowledgeEntry>;
  findById(id: string): Promise<KnowledgeEntry | null>;
  query(criteria: KnowledgeQuery): Promise<KnowledgeEntry[]>;
  nextId(): Promise<string>;
}
