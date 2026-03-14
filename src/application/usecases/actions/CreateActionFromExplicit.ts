import type { QualifiedId } from "../../../domain/ids/QualifiedId";
import type { Action } from "../../../domain/entities/Action";
import type { ActionRepository } from "../../../domain/repositories/ActionRepository";
import type { DateTimeService } from "../../../domain/services/DateTimeService";
import type { UserResolutionService } from "../../../domain/services/UserResolutionService";
import type { WireOutboundPort } from "../../ports/WireOutboundPort";

export interface CreateActionFromExplicitInput {
  conversationId: QualifiedId;
  creatorId: QualifiedId;
  authorName: string;
  rawMessageId: string;
  rawMessage: string;
  description: string;
  assigneeReference?: string;
  deadlineText?: string;
  linkedDecisionId?: string;
}

export class CreateActionFromExplicit {
  constructor(
    private readonly actions: ActionRepository,
    private readonly dateTimeService: DateTimeService,
    private readonly userResolutionService: UserResolutionService,
    private readonly wireOutbound: WireOutboundPort,
  ) {}

  async execute(input: CreateActionFromExplicitInput): Promise<Action> {
    const now = new Date();
    const id = await this.actions.nextId();

    const assigneeResult = await this.resolveAssignee(input);
    const assigneeId = assigneeResult.userId ?? input.creatorId;
    const assigneeName = input.assigneeReference ?? input.authorName;

    const deadline = this.parseDeadline(input.deadlineText);
    const linkedIds = input.linkedDecisionId ? [input.linkedDecisionId] : [];

    const action: Action = {
      id,
      description: input.description,
      rawMessage: input.rawMessage,
      rawMessageId: input.rawMessageId,
      assigneeId,
      assigneeName,
      creatorId: input.creatorId,
      authorName: input.authorName,
      conversationId: input.conversationId,
      deadline,
      status: "open",
      linkedIds,
      reminderAt: [],
      completionNote: null,
      tags: [],
      timestamp: now,
      updatedAt: now,
      deleted: false,
      version: 1,
    };

    const saved = await this.actions.create(action);

    await this.wireOutbound.sendPlainText(
      input.conversationId,
      `Created ${saved.id} for ${assigneeName}: ${saved.description}`,
      { replyToMessageId: input.rawMessageId },
    );

    return saved;
  }

  private async resolveAssignee(input: CreateActionFromExplicitInput) {
    if (!input.assigneeReference) {
      return { userId: input.creatorId, ambiguous: false };
    }
    return this.userResolutionService.resolveByHandleOrName(input.assigneeReference, {
      conversationId: input.conversationId,
    });
  }

  private parseDeadline(deadlineText: string | undefined): Date | null {
    if (!deadlineText) return null;
    const parsed = this.dateTimeService.parse(deadlineText, { timezone: "Europe/Berlin" });
    return parsed?.value ?? null;
  }
}
