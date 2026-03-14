import type { TaskRepository } from "../../domain/repositories/TaskRepository";
import type { ActionRepository } from "../../domain/repositories/ActionRepository";
import type { DecisionRepository } from "../../domain/repositories/DecisionRepository";
import type { WireOutboundPort } from "../ports/WireOutboundPort";
import type { QualifiedId } from "../../domain/ids/QualifiedId";

/**
 * Builds a weekly summary per conversation and sends it.
 * Intended to be run by the scheduler (e.g. weekly).
 */
export class WeeklyDigestService {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly actions: ActionRepository,
    private readonly decisions: DecisionRepository,
    private readonly wireOutbound: WireOutboundPort,
  ) {}

  async run(): Promise<void> {
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const convIds = await this.getConversationIds(since);
    for (const convId of convIds) {
      await this.sendDigestForConversation(convId, since);
    }
  }

  private async getConversationIds(since: Date): Promise<QualifiedId[]> {
    const [tasks, actions, decisions] = await Promise.all([
      this.tasks.query({ limit: 1000 }),
      this.actions.query({ limit: 1000 }),
      this.decisions.query({ limit: 1000 }),
    ]);

    const keys = new Set<string>();
    for (const t of tasks) {
      if (t.timestamp >= since) keys.add(`${t.conversationId.id}@${t.conversationId.domain}`);
    }
    for (const a of actions) {
      if (a.timestamp >= since) keys.add(`${a.conversationId.id}@${a.conversationId.domain}`);
    }
    for (const d of decisions) {
      if (d.timestamp >= since) keys.add(`${d.conversationId.id}@${d.conversationId.domain}`);
    }

    return [...keys].map((k) => {
      const [id, domain] = k.split("@");
      return { id, domain };
    });
  }

  private async sendDigestForConversation(convId: QualifiedId, since: Date): Promise<void> {
    const [tasks, actions, decisions] = await Promise.all([
      this.tasks.query({ conversationId: convId, statusIn: ["open", "in_progress"], limit: 50 }),
      this.actions.query({
        conversationId: convId,
        statusIn: ["open", "in_progress", "overdue"],
        limit: 50,
      }),
      this.decisions.query({
        conversationId: convId,
        statusIn: ["active"],
        limit: 20,
      }),
    ]);

    const recentTasks = tasks.filter((t) => t.timestamp >= since);
    const recentActions = actions.filter((a) => a.timestamp >= since);
    const recentDecisions = decisions.filter((d) => d.timestamp >= since);

    if (recentTasks.length === 0 && recentActions.length === 0 && recentDecisions.length === 0) {
      return;
    }

    const lines: string[] = ["Weekly digest (last 7 days):"];
    if (recentDecisions.length > 0) {
      lines.push("Decisions:");
      for (const d of recentDecisions.slice(0, 5)) {
        lines.push(`  • ${d.id}: ${d.summary}`);
      }
    }
    if (recentTasks.length > 0) {
      lines.push("Tasks:");
      for (const t of recentTasks.slice(0, 5)) {
        lines.push(`  • ${t.id}: ${t.description} [${t.status}]`);
      }
    }
    if (recentActions.length > 0) {
      lines.push("Actions:");
      for (const a of recentActions.slice(0, 5)) {
        lines.push(`  • ${a.id}: ${a.description} — ${a.assigneeName} [${a.status}]`);
      }
    }
    lines.push(`Open: ${tasks.length} tasks, ${actions.length} actions.`);

    await this.wireOutbound.sendPlainText(convId, lines.join("\n"));
  }
}
