import type { QualifiedId } from "../../domain/ids/QualifiedId";
import type {
  WireOutboundPort,
  OutboundTextOptions,
  CompositePromptOptions,
  CompositeButton,
} from "../../application/ports/WireOutboundPort";

/**
 * Ref to the current Wire events handler. The SDK sets handler.manager after create;
 * the adapter uses this to send messages.
 */
export interface HandlerManagerRef {
  current: { manager?: { sendMessage(m: unknown): Promise<string> } } | null;
}

function sendText(
  handlerRef: HandlerManagerRef,
  conversationId: QualifiedId,
  text: string,
): Promise<void> {
  const h = handlerRef.current;
  if (!h?.manager) return Promise.resolve();
  const sdk = require("wire-apps-js-sdk") as {
    TextMessage: { create: (p: { conversationId: QualifiedId; text: string }) => unknown };
  };
  const msg = sdk.TextMessage.create({ conversationId, text });
  return h.manager.sendMessage(msg).then(() => {});
}

/**
 * Implements WireOutboundPort using wire-apps-js-sdk. Composite and reaction
 * use plain-text fallback until the SDK exposes Composite/Reaction APIs.
 */
export function createWireOutboundAdapter(handlerRef: HandlerManagerRef): WireOutboundPort {
  return {
    async sendPlainText(
      conversationId: QualifiedId,
      text: string,
      _options?: OutboundTextOptions,
    ): Promise<void> {
      await sendText(handlerRef, conversationId, text);
    },

    async sendCompositePrompt(
      conversationId: QualifiedId,
      text: string,
      buttons: CompositeButton[],
      _options?: CompositePromptOptions,
    ): Promise<void> {
      const suffix =
        buttons.length > 0 ? `\n[${buttons.map((b) => b.label).join(" | ")}]` : "";
      await sendText(handlerRef, conversationId, text + suffix);
    },

    async sendReaction(
      _conversationId: QualifiedId,
      _messageId: string,
      _emoji: string,
    ): Promise<void> {
      // SDK does not yet expose Reaction in WireMessage; no-op until supported.
    },
  };
}
