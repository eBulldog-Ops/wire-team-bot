import type { Config } from "../../app/config";

/**
 * Exposes LLM configuration for adapters. Allows wiring API endpoints and keys
 * without the domain depending on Config.
 */
export interface LLMConfig {
  provider: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  enabled: boolean;
}

export function getLLMConfig(config: Config): LLMConfig {
  return { ...config.llm };
}
