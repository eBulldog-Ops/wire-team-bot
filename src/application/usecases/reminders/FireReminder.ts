import type { WireOutboundPort } from "../../ports/WireOutboundPort";
import type { ReminderRepository } from "../../../domain/repositories/ReminderRepository";

export interface FireReminderInput {
  reminderId: string;
}

/**
 * Invoked by the scheduler when a reminder's trigger time is reached.
 * Marks the reminder as fired and sends a message to its conversation.
 */
export class FireReminder {
  constructor(
    private readonly reminders: ReminderRepository,
    private readonly wireOutbound: WireOutboundPort,
  ) {}

  async execute(input: FireReminderInput): Promise<void> {
    const reminder = await this.reminders.findById(input.reminderId);
    if (!reminder || reminder.status !== "pending") return;

    const updated = { ...reminder, status: "fired" as const, updatedAt: new Date() };
    await this.reminders.update(updated);

    const convId = reminder.conversationId;
    const text = `Reminder: ${reminder.description}`;
    await this.wireOutbound.sendPlainText(convId, text);
  }
}
