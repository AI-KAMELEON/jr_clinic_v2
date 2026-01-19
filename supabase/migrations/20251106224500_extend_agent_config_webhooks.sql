ALTER TABLE "public"."agent_config"
ADD COLUMN IF NOT EXISTS "webhook_url" text,
ADD COLUMN IF NOT EXISTS "webhook_secret" text,
ADD COLUMN IF NOT EXISTS "personalization_url" text,
ADD COLUMN IF NOT EXISTS "personalization_secret" text;














