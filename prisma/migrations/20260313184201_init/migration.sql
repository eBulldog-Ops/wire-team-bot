-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "conversationDom" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorDom" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "rawMessageId" TEXT NOT NULL,
    "rawMessage" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tags" TEXT[],
    "status" TEXT NOT NULL,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT NOT NULL,
    "assigneeId" TEXT NOT NULL,
    "assigneeDom" TEXT NOT NULL,
    "assigneeName" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "creatorDom" TEXT NOT NULL,
    "deadline" TIMESTAMP(3),
    "priority" TEXT NOT NULL,
    "recurrence" TEXT,
    "linkedIds" TEXT[],
    "completionNote" TEXT,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT,
    "conversationDom" TEXT,
    "authorId" TEXT NOT NULL,
    "authorDom" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "rawMessageId" TEXT NOT NULL,
    "rawMessage" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tags" TEXT[],
    "status" TEXT NOT NULL,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetDom" TEXT NOT NULL,
    "triggerAt" TIMESTAMP(3) NOT NULL,
    "recurrence" TEXT,
    "linkedIds" TEXT[],

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);
