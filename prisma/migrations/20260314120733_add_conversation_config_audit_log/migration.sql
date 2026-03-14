-- CreateTable
CREATE TABLE "Decision" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "conversationDom" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorDom" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "rawMessageId" TEXT NOT NULL,
    "rawMessage" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "context" JSONB NOT NULL,
    "participants" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "supersededBy" TEXT,
    "supersedes" TEXT,
    "linkedIds" TEXT[],
    "attachments" JSONB NOT NULL,
    "tags" TEXT[],
    "timestamp" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Decision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Action" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "conversationDom" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "creatorDom" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "assigneeId" TEXT NOT NULL,
    "assigneeDom" TEXT NOT NULL,
    "assigneeName" TEXT NOT NULL,
    "rawMessageId" TEXT NOT NULL,
    "rawMessage" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "deadline" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "linkedIds" TEXT[],
    "reminderAt" JSONB NOT NULL,
    "completionNote" TEXT,
    "tags" TEXT[],
    "timestamp" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Action_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationConfig" (
    "conversationId" TEXT NOT NULL,
    "conversationDom" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "locale" TEXT NOT NULL DEFAULT 'en',
    "raw" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationConfig_pkey" PRIMARY KEY ("conversationId","conversationDom")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorDom" TEXT NOT NULL,
    "conversationId" TEXT,
    "conversationDom" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "details" JSONB,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);
