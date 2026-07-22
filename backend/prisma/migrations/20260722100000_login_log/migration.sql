-- Login audit (platform-level) for suspicious-IP detection.
CREATE TABLE "LoginLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT,
    "userId" TEXT,
    "phone" TEXT,
    "clinicName" TEXT,
    "ip" TEXT,
    "ua" TEXT,
    CONSTRAINT "LoginLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LoginLog_createdAt_idx" ON "LoginLog"("createdAt");
CREATE INDEX "LoginLog_ip_idx" ON "LoginLog"("ip");
CREATE INDEX "LoginLog_tenantId_idx" ON "LoginLog"("tenantId");
