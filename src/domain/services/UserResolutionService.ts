import type { QualifiedId } from "../ids/QualifiedId";

export interface UserResolutionResult {
  userId: QualifiedId | null;
  ambiguous: boolean;
  candidates?: QualifiedId[];
  rawReference?: string;
}

/**
 * Port for resolving users from mentions or free-text references, backed
 * by the member cache and Wire SDK in infrastructure.
 */
export interface UserResolutionService {
  resolveByHandleOrName(
    reference: string,
    options: { conversationId: QualifiedId },
  ): Promise<UserResolutionResult>;
}

