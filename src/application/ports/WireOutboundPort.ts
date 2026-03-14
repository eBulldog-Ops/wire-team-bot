import type { QualifiedId } from "../../domain/ids/QualifiedId";

export interface OutboundTextOptions {
  replyToMessageId?: string;
}

export interface CompositeButton {
  id: string;
  label: string;
}

export interface CompositePromptOptions {
  replyToMessageId?: string;
}

export interface WireOutboundPort {
  sendPlainText(
    conversationId: QualifiedId,
    text: string,
    options?: OutboundTextOptions,
  ): Promise<void>;

  sendCompositePrompt(
    conversationId: QualifiedId,
    text: string,
    buttons: CompositeButton[],
    options?: CompositePromptOptions,
  ): Promise<void>;

  sendReaction(
    conversationId: QualifiedId,
    messageId: string,
    emoji: string,
  ): Promise<void>;
}

