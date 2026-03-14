import type { ImplicitDetectionService, ImplicitDetectionInput, ImplicitCandidate } from "../../domain/services/ImplicitDetectionService";
import type { LLMConfig } from "./LLMConfigAdapter";

/**
 * Stub implementation of ImplicitDetectionService. Returns no candidates.
 * Used when LLM is disabled or not configured. Replace with a real LLM-backed
 * adapter (e.g. OpenAIImplicitDetectionAdapter) in Phase 3.
 */
export class StubImplicitDetectionAdapter implements ImplicitDetectionService {
  constructor(private readonly _config: LLMConfig) {}

  async detect(_input: ImplicitDetectionInput): Promise<ImplicitCandidate[]> {
    if (!this._config.enabled) return [];
    return [];
  }
}
