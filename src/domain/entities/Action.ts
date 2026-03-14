import type { QualifiedId } from "../ids/QualifiedId";

export type ActionStatus = "open" | "in_progress" | "done" | "cancelled" | "overdue";

export interface Action {
  id: string;
  description: string;
  rawMessage: string;
  rawMessageId: string;
  assigneeId: QualifiedId;
  assigneeName: string;
  creatorId: QualifiedId;
  authorName: string;
  conversationId: QualifiedId;
  deadline: Date | null;
  status: ActionStatus;
  linkedIds: string[];
  reminderAt: Date[]; // scheduled reminder timestamps
  completionNote: string | null;
  timestamp: Date;
  updatedAt: Date;
  tags: string[];
  deleted: boolean;
  version: number;
}
