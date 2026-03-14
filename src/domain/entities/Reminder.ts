import type { QualifiedId } from "../ids/QualifiedId";
import type { SharedEntityFields } from "./SharedEntityFields";

export type ReminderStatus = "pending" | "fired" | "cancelled";

export interface ReminderSpecificFields {
  description: string;
  targetId: QualifiedId;
  conversationId?: QualifiedId | null;
  triggerAt: Date;
  recurrence?: string | null;
  status: ReminderStatus;
  linkedIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export type Reminder = SharedEntityFields & ReminderSpecificFields;

