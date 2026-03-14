import type { Action } from "../../../domain/entities/Action";
import type { ActionRepository } from "../../../domain/repositories/ActionRepository";
import type { WireOutboundPort } from "../../ports/WireOutboundPort";
import type { QualifiedId } from "../../../domain/ids/QualifiedId";

export interface ListTeamActionsInput {
  conversationId: QualifiedId;
  limit?: number;
  replyToMessageId?: string;
}

export class ListTeamActions {
  constructor(
    private readonly actions: ActionRepository,
    private readonly wireOutbound: WireOutboundPort,
  ) {}

  async execute(input: ListTeamActionsInput): Promise<Action[]> {
    const list = await this.actions.query({
      conversationId: input.conversationId,
      statusIn: ["open", "in_progress", "overdue"],
      limit: input.limit ?? 30,
    });

    const byAssignee = new Map<string, Action[]>();
    for (const a of list) {
      const key = `${a.assigneeId.id}@${a.assigneeId.domain}`;
      if (!byAssignee.has(key)) byAssignee.set(key, []);
      byAssignee.get(key)!.push(a);
    }

    const lines: string[] = [];
    if (list.length === 0) {
      lines.push("No open actions in this conversation.");
    } else {
      for (const [, actions] of byAssignee) {
        const name = actions[0].assigneeName || actions[0].assigneeId.id;
        lines.push(`${name}:`);
        for (const a of actions) {
          lines.push(
            `  • ${a.id} [${a.status}]: ${a.description}${a.deadline ? ` (due ${a.deadline.toISOString().slice(0, 10)})` : ""}`,
          );
        }
      }
    }

    await this.wireOutbound.sendPlainText(input.conversationId, lines.join("\n"), {
      replyToMessageId: input.replyToMessageId,
    });

    return list;
  }
}
