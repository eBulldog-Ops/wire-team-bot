import type { QualifiedId } from "../ids/QualifiedId";

export type ConversationRole = "admin" | "member";

export interface CachedMember {
  userId: QualifiedId;
  role: ConversationRole;
}

/**
 * Port for the in-app conversation member cache. Updated from Wire lifecycle events
 * (onAppAddedToConversation, onUserJoinedConversation, onUserLeftConversation).
 * Used for user resolution and permission checks.
 */
export interface ConversationMemberCache {
  setMembers(conversationId: QualifiedId, members: CachedMember[]): void;
  getMembers(conversationId: QualifiedId): CachedMember[];
  removeMembers(conversationId: QualifiedId, userIds: QualifiedId[]): void;
  clearConversation(conversationId: QualifiedId): void;
}
