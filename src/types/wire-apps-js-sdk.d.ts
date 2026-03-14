declare module "wire-apps-js-sdk" {
  // Minimal surfaces needed for Phase 0.5. We intentionally keep these
  // very loose to avoid pulling the SDK's TypeScript sources into our build.

  export type TextMessage = any;
  export type AssetMessage = any;
  export type Conversation = any;
  export type ConversationMember = any;
  export type QualifiedId = any;

  export abstract class WireEventsHandler {
    // Event methods exist; we do not need strict typing here.
  }

  export class WireAppSdk {
    static create(...args: any[]): Promise<WireAppSdk>;
    startListening(): Promise<void>;
  }
}

