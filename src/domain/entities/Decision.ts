import type { QualifiedId } from "../ids/QualifiedId";

export type DecisionStatus = "active" | "superseded" | "revoked";

export interface DecisionContextItem {
  userId: QualifiedId;
  userName: string;
  messageText: string;
  messageId: string;
  timestamp: Date;
}

export interface DecisionAttachment {
  assetId: string;
  filename: string;
  mimeType: string;
}

export interface Decision {
  id: string;
  summary: string;
  rawMessage: string;
  rawMessageId: string;
  context: DecisionContextItem[];
  authorId: QualifiedId;
  authorName: string;
  participants: QualifiedId[];
  conversationId: QualifiedId;
  status: DecisionStatus;
  supersededBy?: string | null;
  supersedes?: string | null;
  linkedIds: string[];
  attachments: DecisionAttachment[];
  tags: string[];
  timestamp: Date;
  updatedAt: Date;
  deleted: boolean;
  version: number;
}
