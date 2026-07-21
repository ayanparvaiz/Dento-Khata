-- Landing-page visit analytics (platform-level, not tenant-scoped).
CREATE TABLE "VisitSession" (
    "id" TEXT NOT NULL,
    "sid" TEXT NOT NULL,
    "path" TEXT NOT NULL DEFAULT '/',
    "referrer" TEXT,
    "utmSource" TEXT,
    "utmCampaign" TEXT,
    "ip" TEXT,
    "ua" TEXT,
    "device" TEXT,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "maxScroll" INTEGER NOT NULL DEFAULT 0,
    "signedUp" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VisitSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VisitSession_sid_key" ON "VisitSession"("sid");
CREATE INDEX "VisitSession_createdAt_idx" ON "VisitSession"("createdAt");
