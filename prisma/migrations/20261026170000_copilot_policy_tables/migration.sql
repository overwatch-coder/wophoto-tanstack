-- Create the legacy Copilot tables before the studio access migration adds
-- their studioId scope and foreign keys.
CREATE TABLE "CopilotStudioPolicy" (
  "managerId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "workersEnabled" BOOLEAN NOT NULL DEFAULT true,
  "clientsEnabled" BOOLEAN NOT NULL DEFAULT false,
  "provider" TEXT NOT NULL DEFAULT 'OPENAI',
  "model" TEXT NOT NULL DEFAULT 'gpt-6.1-sol',
  "apiKeyEncrypted" TEXT,
  "customEndpoint" TEXT,
  "dailyRequestLimit" INTEGER NOT NULL DEFAULT 100,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CopilotStudioPolicy_pkey" PRIMARY KEY ("managerId")
);

CREATE TABLE "CopilotAccessOverride" (
  "managerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL,
  CONSTRAINT "CopilotAccessOverride_pkey" PRIMARY KEY ("managerId", "userId")
);

CREATE TABLE "CopilotUsageEvent" (
  "id" TEXT NOT NULL,
  "managerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "UserRole" NOT NULL,
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CopilotUsageEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CopilotAccessOverride_userId_idx" ON "CopilotAccessOverride"("userId");
CREATE INDEX "CopilotUsageEvent_managerId_createdAt_idx" ON "CopilotUsageEvent"("managerId", "createdAt");
CREATE INDEX "CopilotUsageEvent_managerId_userId_createdAt_idx" ON "CopilotUsageEvent"("managerId", "userId", "createdAt");

ALTER TABLE "CopilotStudioPolicy"
  ADD CONSTRAINT "CopilotStudioPolicy_managerId_fkey"
  FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CopilotAccessOverride"
  ADD CONSTRAINT "CopilotAccessOverride_managerId_fkey"
  FOREIGN KEY ("managerId") REFERENCES "CopilotStudioPolicy"("managerId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CopilotAccessOverride"
  ADD CONSTRAINT "CopilotAccessOverride_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CopilotUsageEvent"
  ADD CONSTRAINT "CopilotUsageEvent_managerId_fkey"
  FOREIGN KEY ("managerId") REFERENCES "CopilotStudioPolicy"("managerId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CopilotUsageEvent"
  ADD CONSTRAINT "CopilotUsageEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
