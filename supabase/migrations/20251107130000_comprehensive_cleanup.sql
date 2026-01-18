-- Migration: Comprehensive Cleanup and Optimization
-- Date: 2025-11-07
-- Description: 
--   1. Remove duplicate index
--   2. Add missing indexes for performance
--   3. Clean up unused backup table (optional - commented out)
--   4. Add comments documenting deprecated columns in agent_config

-- ============================================================================
-- PART 1: Index Optimization
-- ============================================================================

-- 1. Remove duplicate index on agent_config.id
-- PRIMARY KEY already ensures uniqueness, idx_agent_config_unique is redundant
DROP INDEX IF EXISTS idx_agent_config_unique;

-- 2. Add missing index on wizyty.pacjent_id
-- Frequently used in queries (get_patient_appointments, etc.)
CREATE INDEX IF NOT EXISTS idx_wizyty_pacjent_id 
  ON wizyty(pacjent_id)
  WHERE pacjent_id IS NOT NULL;

-- 3. Add missing index on pacjenci.telefon
-- Critical for verify_patient function performance
CREATE INDEX IF NOT EXISTS idx_pacjenci_telefon 
  ON pacjenci(telefon)
  WHERE telefon IS NOT NULL;

-- 4. Add composite index on wizyty(data, status) for available slots queries
-- Optimizes get_available_slots function
CREATE INDEX IF NOT EXISTS idx_wizyty_data_status 
  ON wizyty(data, status)
  WHERE status = 'zaplanowana' AND pacjent_id IS NULL;

-- 5. Add index on sms_logs.data_wizyty for date-based queries
CREATE INDEX IF NOT EXISTS idx_sms_logs_data_wizyty 
  ON sms_logs(data_wizyty DESC);

-- 6. Add index on phone_conversations for agent_id lookups
CREATE INDEX IF NOT EXISTS idx_phone_conversations_agent_id 
  ON phone_conversations(agent_id);

-- 7. Add index on phone_conversations for status filtering
CREATE INDEX IF NOT EXISTS idx_phone_conversations_status 
  ON phone_conversations(status);

-- ============================================================================
-- PART 2: Table Cleanup (OPTIONAL - Uncomment if backup is not needed)
-- ============================================================================

-- Remove backup table if not needed
-- WARNING: This will permanently delete backup data!
-- Uncomment only if you're sure the backup is not needed:
-- DROP TABLE IF EXISTS wizyty_backup;

-- ============================================================================
-- PART 3: Documentation Comments
-- ============================================================================

-- Add comments to agent_config table documenting deprecated columns
-- These columns are kept for backward compatibility but are not used by the UI

COMMENT ON COLUMN agent_config.voice_id IS 'DEPRECATED: Not used by UI. Configure directly in ElevenLabs dashboard.';
COMMENT ON COLUMN agent_config.voice_name IS 'DEPRECATED: Not used by UI. Configure directly in ElevenLabs dashboard.';
COMMENT ON COLUMN agent_config.model_id IS 'DEPRECATED: Not used by UI. Configure directly in ElevenLabs dashboard.';
COMMENT ON COLUMN agent_config.voice_stability IS 'DEPRECATED: Not used by UI. Configure directly in ElevenLabs dashboard.';
COMMENT ON COLUMN agent_config.voice_similarity_boost IS 'DEPRECATED: Not used by UI. Configure directly in ElevenLabs dashboard.';
COMMENT ON COLUMN agent_config.voice_style IS 'DEPRECATED: Not used by UI. Configure directly in ElevenLabs dashboard.';
COMMENT ON COLUMN agent_config.use_speaker_boost IS 'DEPRECATED: Not used by UI. Configure directly in ElevenLabs dashboard.';
COMMENT ON COLUMN agent_config.llm_model_id IS 'DEPRECATED: Not used by UI. Configure directly in ElevenLabs dashboard.';
COMMENT ON COLUMN agent_config.turn_timeout IS 'DEPRECATED: Not used by UI. Configure directly in ElevenLabs dashboard.';
COMMENT ON COLUMN agent_config.initial_wait_time IS 'DEPRECATED: Not used by UI. Configure directly in ElevenLabs dashboard.';
COMMENT ON COLUMN agent_config.silence_end_call_timeout IS 'DEPRECATED: Not used by UI. Configure directly in ElevenLabs dashboard.';
COMMENT ON COLUMN agent_config.turn_eagerness IS 'DEPRECATED: Not used by UI. Configure directly in ElevenLabs dashboard.';
COMMENT ON COLUMN agent_config.asr_quality IS 'DEPRECATED: Not used by UI. Configure directly in ElevenLabs dashboard.';
COMMENT ON COLUMN agent_config.asr_user_input_audio_format IS 'DEPRECATED: Not used by UI. Configure directly in ElevenLabs dashboard.';
COMMENT ON COLUMN agent_config.conversation_text_only IS 'DEPRECATED: Not used by UI. Configure directly in ElevenLabs dashboard.';
COMMENT ON COLUMN agent_config.conversation_max_duration IS 'DEPRECATED: Not used by UI. Configure directly in ElevenLabs dashboard.';
COMMENT ON COLUMN agent_config.webhook_events IS 'DEPRECATED: Not used by UI. Configure directly in ElevenLabs dashboard.';
COMMENT ON COLUMN agent_config.webhook_send_audio IS 'DEPRECATED: Not used by UI. Configure directly in ElevenLabs dashboard.';
COMMENT ON COLUMN agent_config.personalization_url IS 'DEPRECATED: Not used by UI. Personalization webhook removed.';
COMMENT ON COLUMN agent_config.personalization_secret IS 'DEPRECATED: Not used by UI. Personalization webhook removed.';

-- Document actively used columns
COMMENT ON COLUMN agent_config.elevenlabs_agent_id IS 'ACTIVE: ElevenLabs Agent ID - required for webhook verification';
COMMENT ON COLUMN agent_config.twilio_phone_number IS 'ACTIVE: Twilio phone number assigned to the agent';
COMMENT ON COLUMN agent_config.agent_name IS 'ACTIVE: Display name of the agent';
COMMENT ON COLUMN agent_config.agent_greeting IS 'ACTIVE: First message spoken by the agent';
COMMENT ON COLUMN agent_config.webhook_url IS 'ACTIVE: Webhook URL for ElevenLabs events';
COMMENT ON COLUMN agent_config.webhook_secret IS 'ACTIVE: Secret for webhook verification';

-- ============================================================================
-- PART 4: Edge Functions Cleanup Notes
-- ============================================================================

-- The following Edge Functions have been removed locally and should be deleted
-- from Supabase Dashboard or via Management API:
--   1. create-elevenlabs-agent (not used in UI)
--   2. assign-twilio-phone (not used, empty directory)
--   3. get-elevenlabs-voices (not used in UI)
--   4. elevenlabs-personalization (optional, removed per user request)
--
-- To delete via Supabase Dashboard:
--   - Go to: Project → Edge Functions
--   - Delete each function manually
--
-- To delete via Supabase CLI (if linked):
--   supabase functions delete create-elevenlabs-agent
--   supabase functions delete assign-twilio-phone
--   supabase functions delete get-elevenlabs-voices
--   supabase functions delete elevenlabs-personalization











