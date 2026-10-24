UPDATE "UserPreference"
SET "aiModel" = 'gpt-5.1'
WHERE "aiProvider" = 'OPENAI' AND "aiModel" = 'gpt-4o-mini';

ALTER TABLE "UserPreference"
ALTER COLUMN "aiModel" SET DEFAULT 'gpt-5.1';
