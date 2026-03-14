/**
 * Strongly-typed runtime configuration. Built from environment variables
 * and optional config files. Validated at startup.
 */
export interface Config {
  wire: {
    userEmail: string;
    userPassword: string;
    userId: string;
    userDomain: string;
    apiHost: string;
    cryptoPassword: string;
  };
  database: {
    url: string;
  };
  app: {
    logLevel: string;
    messageBufferSize: number;
    storageDir: string;
  };
  /** AI/LLM adapter endpoints and keys. Used by Phase 3 implicit detection; plumbing in place for configuration. */
  llm: {
    provider: string;
    baseUrl: string;
    apiKey: string;
    model: string;
    enabled: boolean;
  };
}

const REQUIRED_WIRE = [
  "WIRE_SDK_USER_EMAIL",
  "WIRE_SDK_USER_PASSWORD",
  "WIRE_SDK_USER_ID",
  "WIRE_SDK_USER_DOMAIN",
  "WIRE_SDK_API_HOST",
  "WIRE_SDK_CRYPTO_PASSWORD",
] as const;

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be set`);
  return value;
}

export function loadConfig(): Config {
  const wire = {
    userEmail: getEnv(REQUIRED_WIRE[0]),
    userPassword: getEnv(REQUIRED_WIRE[1]),
    userId: getEnv(REQUIRED_WIRE[2]),
    userDomain: getEnv(REQUIRED_WIRE[3]),
    apiHost: getEnv(REQUIRED_WIRE[4]),
    cryptoPassword: getEnv(REQUIRED_WIRE[5]),
  };

  const database = {
    url: process.env.DATABASE_URL ?? "postgres://wirebot:wirebot@localhost:5432/wire_team_bot",
  };

  const logLevel = process.env.LOG_LEVEL ?? "info";
  const messageBufferSize = Math.min(
    Math.max(1, parseInt(process.env.MESSAGE_BUFFER_SIZE ?? "50", 10)),
    500,
  );
  const storageDir = process.env.STORAGE_DIR ?? "storage";

  const llm = {
    provider: process.env.LLM_PROVIDER ?? "openai",
    baseUrl: process.env.LLM_BASE_URL ?? "https://api.openai.com/v1",
    apiKey: process.env.LLM_API_KEY ?? "",
    model: process.env.LLM_MODEL ?? "gpt-4o-mini",
    enabled: process.env.LLM_ENABLED !== "false" && (process.env.LLM_API_KEY?.length ?? 0) > 0,
  };

  return {
    wire,
    database,
    app: { logLevel, messageBufferSize, storageDir },
    llm,
  };
}
