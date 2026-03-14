-- CreateTable
CREATE TABLE "KnowledgeEntry" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "conversationDom" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorDom" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "rawMessageId" TEXT NOT NULL,
    "rawMessage" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "relatedIds" TEXT[],
    "ttlDays" INTEGER,
    "verifiedBy" JSONB NOT NULL,
    "retrievalCount" INTEGER NOT NULL DEFAULT 0,
    "lastRetrieved" TIMESTAMP(3),
    "tags" TEXT[],
    "timestamp" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "KnowledgeEntry_pkey" PRIMARY KEY ("id")
);
