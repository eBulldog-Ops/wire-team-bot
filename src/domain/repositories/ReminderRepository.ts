import type { Reminder, ReminderStatus } from "../entities/Reminder";
import type { QualifiedId } from "../ids/QualifiedId";

export interface ReminderQuery {
  targetId?: QualifiedId;
  conversationId?: QualifiedId | null;
  statusIn?: ReminderStatus[];
  dueBefore?: Date;
  dueAfter?: Date;
}

export interface ReminderRepository {
  create(reminder: Reminder): Promise<Reminder>;
  update(reminder: Reminder): Promise<Reminder>;
  findById(id: string): Promise<Reminder | null>;
  query(criteria: ReminderQuery): Promise<Reminder[]>;
  nextId(): Promise<string>; // e.g. REM-0001
}

