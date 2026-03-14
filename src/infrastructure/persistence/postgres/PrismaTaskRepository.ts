import type { Task } from "../../../domain/entities/Task";
import type { TaskRepository, TaskQuery } from "../../../domain/repositories/TaskRepository";
import type { QualifiedId } from "../../../domain/ids/QualifiedId";
import { getPrismaClient } from "./PrismaClient";

export class PrismaTaskRepository implements TaskRepository {
  private prisma = getPrismaClient();

  async nextId(): Promise<string> {
    const count = await this.prisma.task.count();
    const next = count + 1;
    return `TASK-${next.toString().padStart(4, "0")}`;
  }

  async create(task: Task): Promise<Task> {
    await this.prisma.task.create({
      data: this.toRow(task),
    });
    return task;
  }

  async update(task: Task): Promise<Task> {
    await this.prisma.task.update({
      where: { id: task.id },
      data: this.toRow(task),
    });
    return task;
  }

  async findById(id: string): Promise<Task | null> {
    const row = await this.prisma.task.findUnique({ where: { id } });
    if (!row) return null;
    return this.fromRow(row);
  }

  async query(criteria: TaskQuery): Promise<Task[]> {
    const where: any = {};
    if (criteria.conversationId) {
      where.conversationId = criteria.conversationId.id;
      where.conversationDom = criteria.conversationId.domain;
    }
    if (criteria.assigneeId) {
      where.assigneeId = criteria.assigneeId.id;
      where.assigneeDom = criteria.assigneeId.domain;
    }
    if (criteria.creatorId) {
      where.creatorId = criteria.creatorId.id;
      where.creatorDom = criteria.creatorId.domain;
    }
    if (criteria.statusIn && criteria.statusIn.length > 0) {
      where.status = { in: criteria.statusIn };
    }
    if (criteria.searchText) {
      where.description = { contains: criteria.searchText, mode: "insensitive" };
    }
    const take = criteria.limit ?? 100;
    const rows = await this.prisma.task.findMany({ where, take });
    return rows.map((r) => this.fromRow(r));
  }

  private toRow(task: Task) {
    return {
      id: task.id,
      conversationId: task.conversationId.id,
      conversationDom: task.conversationId.domain,
      authorId: task.authorId.id,
      authorDom: task.authorId.domain,
      authorName: task.authorName,
      rawMessageId: task.rawMessageId,
      rawMessage: task.rawMessage,
      timestamp: task.timestamp,
      updatedAt: task.updatedAt,
      tags: task.tags,
      status: task.status,
      deleted: task.deleted,
      version: task.version,
      description: task.description,
      assigneeId: task.assigneeId.id,
      assigneeDom: task.assigneeId.domain,
      assigneeName: task.assigneeName,
      creatorId: task.creatorId.id,
      creatorDom: task.creatorId.domain,
      deadline: task.deadline ?? null,
      priority: task.priority,
      recurrence: task.recurrence ?? null,
      linkedIds: task.linkedIds,
      completionNote: task.completionNote ?? null,
    };
  }

  private fromRow(row: any): Task {
    const toQualifiedId = (id: string, domain: string): QualifiedId => ({ id, domain });

    return {
      id: row.id,
      conversationId: toQualifiedId(row.conversationId, row.conversationDom),
      authorId: toQualifiedId(row.authorId, row.authorDom),
      authorName: row.authorName,
      rawMessageId: row.rawMessageId,
      rawMessage: row.rawMessage,
      timestamp: row.timestamp,
      updatedAt: row.updatedAt,
      tags: row.tags,
      status: row.status,
      deleted: row.deleted,
      version: row.version,
      description: row.description,
      assigneeId: toQualifiedId(row.assigneeId, row.assigneeDom),
      assigneeName: row.assigneeName,
      creatorId: toQualifiedId(row.creatorId, row.creatorDom),
      deadline: row.deadline,
      priority: row.priority,
      recurrence: row.recurrence,
      linkedIds: row.linkedIds,
      completionNote: row.completionNote,
    };
  }
}

