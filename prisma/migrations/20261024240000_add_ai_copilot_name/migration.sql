ALTER TABLE "UserPreference"
  ADD COLUMN IF NOT EXISTS "aiCopilotName" TEXT NOT NULL DEFAULT 'WoPhoto Studio Copilot';
