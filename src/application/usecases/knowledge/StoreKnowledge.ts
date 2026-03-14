import type { QualifiedId } from "../../../domain/ids/QualifiedId";
import type { KnowledgeEntry, KnowledgeCategory, KnowledgeConfidence } from "../../../domain/entities/KnowledgeEntry";
import type { KnowledgeRepository } from "../../../domain/repositories/KnowledgeRepository";
import type { WireOutboundPort } from "../../ports/WireOutboundPort";

export interface StoreKnowledgeInput {
  conversationId: QualifiedId;
  authorId: QualifiedId;
  authorName: string;
  rawMessageId: string;
  rawMessage: string;
  summary: string;
  detail: string;
  category?: KnowledgeCategory;
  confidence?: KnowledgeConfidence;
  tags?: string[];
  ttlDays?: number | null;
}

export class StoreKnowledge {
  constructor(
    private readonly knowledge: KnowledgeRepository,
    private readonly wireOutbound: WireOutboundPort,
  ) {}

  async execute(input: StoreKnowledgeInput): Promise<KnowledgeEntry> {
    const now = new Date();
    const id = await this.knowledge.nextId();
    const category = input.category ?? "factual";
    const confidence = input.confidence ?? "high";
    const tags = input.tags ?? [];

    const entry: KnowledgeEntry = {
      id,
      summary: input.summary,
      detail: input.detail,
      rawMessage: input.rawMessage,
      rawMessageId: input.rawMessageId,
      authorId: input.authorId,
      authorName: input.authorName,
      conversationId: input.conversationId,
      category,
      confidence,
      relatedIds: [],
      ttlDays: input.ttlDays ?? 90,
      verifiedBy: [],
      retrievalCount: 0,
      lastRetrieved: null,
      tags,
      timestamp: now,
      updatedAt: now,
      deleted: false,
      version: 1,
    };

    const saved = await this.knowledge.create(entry);

    const tagPart = saved.tags.length > 0 ? `. Tagged: ${saved.tags.join(", ")}` : "";
    await this.wireOutbound.sendPlainText(
      input.conversationId,
      `Stored as ${saved.id}: ${saved.summary}${tagPart}`,
      { replyToMessageId: input.rawMessageId },
    );
    await this.wireOutbound.sendReaction(input.conversationId, input.rawMessageId, "✓");

    return saved;
  }
}
