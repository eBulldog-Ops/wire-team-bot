import type { QualifiedId } from "../ids/QualifiedId";
import type { SharedEntityFields } from "./SharedEntityFields";

export type TaskStatus = "open" | "in_progress" | "done" | "cancelled";
export type TaskPriority = "low" | "normal" | "high" | "urgent";

export interface TaskSpecificFields {
  description: string;
  assigneeId: QualifiedId;
  assigneeName: string;
  creatorId: QualifiedId;
  deadline?: Date | null;
  status: TaskStatus;
  priority: TaskPriority;
  recurrence?: string | null;
  linkedIds: string[];
  completionNote?: string | null;
}

export type Task = SharedEntityFields & TaskSpecificFields;

