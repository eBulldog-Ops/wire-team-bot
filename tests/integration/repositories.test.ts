/**
 * Integration tests for repositories against Postgres.
 * Require DATABASE_URL and a running Postgres (e.g. docker-compose up -d db).
 * Skip when DATABASE_URL is not set.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaTaskRepository } from "../../src/infrastructure/persistence/postgres/PrismaTaskRepository";
import { getPrismaClient } from "../../src/infrastructure/persistence/postgres/PrismaClient";
import type { QualifiedId } from "../../src/domain/ids/QualifiedId";
import type { Task } from "../../src/domain/entities/Task";

const convId: QualifiedId = { id: "test-conv-integration", domain: "test.domain" };
const authorId: QualifiedId = { id: "test-author-integration", domain: "test.domain" };

describe.skipIf(process.env.INTEGRATION_TESTS !== "1")("TaskRepository integration", () => {
  const repo = new PrismaTaskRepository();
  let createdId: string;

  afterAll(async () => {
    const prisma = getPrismaClient();
    if (createdId) {
      await prisma.task.deleteMany({ where: { id: createdId } });
    }
    await prisma.$disconnect();
  });

  it("create and findById", async () => {
    const id = await repo.nextId();
    const task: Task = {
      id,
      conversationId: convId,
      authorId,
      authorName: "Integration Test",
      rawMessageId: "msg-1",
      rawMessage: "task: integration test",
      timestamp: new Date(),
      updatedAt: new Date(),
      tags: [],
      status: "open",
      deleted: false,
      version: 1,
      description: "Integration test task",
      assigneeId: authorId,
      assigneeName: "Integration Test",
      creatorId: authorId,
      deadline: null,
      priority: "normal",
      recurrence: null,
      linkedIds: [],
      completionNote: null,
    };

    await repo.create(task);
    createdId = id;

    const found = await repo.findById(id);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(id);
    expect(found!.description).toBe("Integration test task");
  });
});
