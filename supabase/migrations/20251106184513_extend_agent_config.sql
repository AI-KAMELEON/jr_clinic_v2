-- Rozszerzenie tabeli agent_config o nowe pola dla pełnej konfiguracji agenta
ALTER TABLE "public"."agent_config" 
ADD COLUMN IF NOT EXISTS "agent_name" text DEFAULT 'FRONT_VISITELLA',
ADD COLUMN IF NOT EXISTS "voice_id" text,
ADD COLUMN IF NOT EXISTS "voice_name" text,
ADD COLUMN IF NOT EXISTS "model_id" text DEFAULT 'eleven_multilingual_v2',
ADD COLUMN IF NOT EXISTS "voice_stability" numeric DEFAULT 0.5,
ADD COLUMN IF NOT EXISTS "voice_similarity_boost" numeric DEFAULT 0.75,
ADD COLUMN IF NOT EXISTS "voice_style" numeric DEFAULT 0.3,
ADD COLUMN IF NOT EXISTS "use_speaker_boost" boolean DEFAULT true;

-- Aktualizuj istniejące rekordy (jeśli są)
UPDATE "public"."agent_config"
SET 
  agent_name = COALESCE(agent_name, 'FRONT_VISITELLA'),
  model_id = COALESCE(model_id, 'eleven_multilingual_v2'),
  voice_stability = COALESCE(voice_stability, 0.5),
  voice_similarity_boost = COALESCE(voice_similarity_boost, 0.75),
  voice_style = COALESCE(voice_style, 0.3),
  use_speaker_boost = COALESCE(use_speaker_boost, true)
WHERE agent_name IS NULL OR model_id IS NULL;














