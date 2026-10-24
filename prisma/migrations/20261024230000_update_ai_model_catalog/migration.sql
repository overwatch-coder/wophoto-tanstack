-- Move previously available built-in models to the currently selected defaults.
-- Keep custom endpoint model IDs and any unrecognized IDs untouched.
UPDATE "UserPreference"
SET "aiModel" = CASE "aiProvider"
  WHEN 'OPENAI' THEN 'gpt-6.1-sol'
  WHEN 'ANTHROPIC' THEN 'claude-sonnet-5-5'
  WHEN 'GEMINI' THEN 'gemini-4-argon'
  WHEN 'GROK' THEN 'grok-4.20'
  WHEN 'GROQ' THEN 'openai/gpt-oss-120b'
END
WHERE ("aiProvider" = 'OPENAI' AND "aiModel" IN (
    'gpt-5.1', 'gpt-5-mini', 'gpt-5-nano'
  ))
   OR ("aiProvider" = 'ANTHROPIC' AND "aiModel" IN (
    'claude-sonnet-5', 'claude-opus-5', 'claude-haiku-4-5-20251001'
  ))
   OR ("aiProvider" = 'GEMINI' AND "aiModel" IN (
    'gemini-3.7-flash'
  ))
   OR ("aiProvider" = 'GROK' AND "aiModel" IN (
    'grok-2-latest', 'grok-3', 'grok-4.6', 'grok-4.5'
  ))
   OR ("aiProvider" = 'GROQ' AND "aiModel" IN (
    'meta-llama/llama-4-scout-17b-16e-instruct', 'llama-4-scout-17b-16e-instruct'
  ));

ALTER TABLE "UserPreference"
  ALTER COLUMN "aiModel" SET DEFAULT 'gpt-6.1-sol';
