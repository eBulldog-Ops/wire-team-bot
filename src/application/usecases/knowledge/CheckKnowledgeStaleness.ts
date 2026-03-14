import type { KnowledgeRepository } from "../../../domain/repositories/KnowledgeRepository";
import type { WireOutboundPort } from "../../ports/WireOutboundPort";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Finds knowledge entries past their TTL and sends one revalidation prompt per conversation.
 * Intended for scheduler (e.g. daily).
 */
export class CheckKnowledgeStaleness {
  constructor(
    private readonly knowledge: KnowledgeRepository,
    private readonly wireOutbound: WireOutboundPort,
  ) {}

  async run(): Promise<void> {
    const all = await this.knowledge.query({ limit: 500 });
    const now = Date.now();
    const stale = all.filter((e) => {
      if (e.ttlDays == null) return false;
      const expiry = e.updatedAt.getTime() + e.ttlDays * MS_PER_DAY;
      return expiry < now;
    });

    const byConv = new Map<string, typeof stale>();
    for (const e of stale) {
      const key = `${e.conversationId.id}@${e.conversationId.domain}`;
      if (!byConv.has(key)) byConv.set(key, []);
      byConv.get(key)!.push(e);
    }

    for (const [, list] of byConv) {
      const lines = list.map((e) => `• ${e.id}: ${e.summary} (${e.authorName})`);
      await this.wireOutbound.sendPlainText(
        list[0].conversationId,
        `Knowledge entries due for revalidation:\n${lines.join("\n")}\nReply with "verify KB-xxxx" or update the entry.`,
      );
    }
  }
}
