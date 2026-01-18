ALTER TABLE "public"."agent_config"
ADD COLUMN IF NOT EXISTS "llm_model_id" text DEFAULT 'gpt-4o-mini',
ADD COLUMN IF NOT EXISTS "turn_timeout" numeric DEFAULT 7,
ADD COLUMN IF NOT EXISTS "initial_wait_time" numeric DEFAULT 1.1,
ADD COLUMN IF NOT EXISTS "silence_end_call_timeout" numeric DEFAULT -1,
ADD COLUMN IF NOT EXISTS "turn_eagerness" text DEFAULT 'normal',
ADD COLUMN IF NOT EXISTS "asr_quality" text DEFAULT 'high',
ADD COLUMN IF NOT EXISTS "asr_user_input_audio_format" text DEFAULT 'pcm_8000',
ADD COLUMN IF NOT EXISTS "conversation_text_only" boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS "conversation_max_duration" integer DEFAULT 600,
ADD COLUMN IF NOT EXISTS "webhook_events" text[] DEFAULT ARRAY['conversation_started','function_call','conversation_ended'],
ADD COLUMN IF NOT EXISTS "webhook_send_audio" boolean DEFAULT false;














