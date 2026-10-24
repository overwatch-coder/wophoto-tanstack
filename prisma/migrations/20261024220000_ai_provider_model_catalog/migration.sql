UPDATE "UserPreference"
SET "aiModel" = CASE "aiProvider"
  WHEN 'OPENAI' THEN 'gpt-5.1'
  WHEN 'ANTHROPIC' THEN 'claude-sonnet-5'
  WHEN 'GEMINI' THEN 'gemini-3.8-flash'
  WHEN 'GROK' THEN 'grok-4.7'
  WHEN 'GROQ' THEN 'openai/gpt-oss-120b'
END
WHERE ("aiProvider" = 'OPENAI' AND "aiModel" = 'gpt-4o-mini')
   OR ("aiProvider" = 'ANTHROPIC' AND "aiModel" = 'claude-sonnet-4-6')
   OR ("aiProvider" = 'GEMINI' AND "aiModel" = 'gemini-2.5-flash')
   OR ("aiProvider" = 'GROK' AND "aiModel" IN ('grok-2-latest', 'grok-3'))
   OR ("aiProvider" = 'GROQ' AND "aiModel" = 'llama-3.3-70b-versatile');
