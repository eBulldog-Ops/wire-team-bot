import type { ActionRepository } from "../../domain/repositories/ActionRepository";
import type { WireOutboundPort } from "../ports/WireOutboundPort";
import type { QualifiedId } from "../../domain/ids/QualifiedId";

/**
 * Finds overdue actions and sends one nudge message per conversation.
 * Intended to be run by the scheduler (e.g. daily).
 */
export class OverdueNudgeService {
  constructor(
    private readonly actions: ActionRepository,
    private readonly wireOutbound: WireOutboundPort,
  ) {}

  async run(): Promise<void> {
    const now = new Date();
    const overdue = await this.actions.query({
      statusIn: ["open", "in_progress", "overdue"],
      deadlineBefore: now,
      limit: 500,
    });

    const byConv = new Map<string, { convId: QualifiedId; actions: typeof overdue }>();
    for (const a of overdue) {
      const key = `${a.conversationId.id}@${a.conversationId.domain}`;
      if (!byConv.has(key)) byConv.set(key, { convId: a.conversationId, actions: [] });
      byConv.get(key)!.actions.push(a);
    }

    for (const { convId, actions: list } of byConv.values()) {
      const lines = list.map(
        (a) =>
          `• ${a.id} (${a.assigneeName}): ${a.description} — due ${a.deadline!.toISOString().slice(0, 10)}`,
      );
      await this.wireOutbound.sendPlainText(
        convId,
        `Overdue actions:\n${lines.join("\n")}`,
      );
    }
  }
}
