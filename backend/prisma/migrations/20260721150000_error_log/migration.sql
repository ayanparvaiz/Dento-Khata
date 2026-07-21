-- Platform-level error / failed-login log (super-admin visibility).
CREATE TABLE "ErrorLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" TEXT NOT NULL DEFAULT 'ERROR',
    "status" INTEGER,
    "method" TEXT,
    "path" TEXT,
    "message" TEXT,
    "phone" TEXT,
    "tenantId" TEXT,
    "userId" TEXT,
    "ip" TEXT,
    "ua" TEXT,
    CONSTRAINT "ErrorLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ErrorLog_createdAt_idx" ON "ErrorLog"("createdAt");
