import type { UserResolutionService, UserResolutionResult } from "../../domain/services/UserResolutionService";
import type { QualifiedId } from "../../domain/ids/QualifiedId";

export class TrivialUserResolutionService implements UserResolutionService {
  constructor(private readonly fallbackUserId: () => QualifiedId) {}

  async resolveByHandleOrName(_reference: string, _options: { conversationId: QualifiedId }): Promise<UserResolutionResult> {
    return {
      userId: this.fallbackUserId(),
      ambiguous: false,
    };
  }
}

