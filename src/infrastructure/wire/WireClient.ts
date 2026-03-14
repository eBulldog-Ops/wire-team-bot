import type { WireEventsHandler } from "wire-apps-js-sdk";
import { WireAppSdk } from "wire-apps-js-sdk";
import type { Config } from "../../app/config";

/**
 * Patches the SDK's default DB path and creates the Wire SDK instance.
 * Caller (container) provides the handler and config.
 */
export async function createWireClient(
  config: Config,
  handler: WireEventsHandler,
  dbFilePath: string,
): Promise<WireAppSdk> {
  try {
    const sdkModule = await import("wire-apps-js-sdk/build/db/DatabaseService.js");
    const DatabaseService = (sdkModule as { DatabaseService?: unknown }).DatabaseService;
    if (DatabaseService && typeof DatabaseService === "function") {
      const Db = DatabaseService as unknown as { DEFAULT_DATABASE_PATH: string };
      Db.DEFAULT_DATABASE_PATH = dbFilePath;
    }
  } catch {
    // If we cannot patch, storage dir is still created by container.
  }

  return WireAppSdk.create(
    config.wire.userEmail,
    config.wire.userPassword,
    config.wire.userId,
    config.wire.userDomain,
    config.wire.apiHost,
    config.wire.cryptoPassword,
    handler,
  );
}
