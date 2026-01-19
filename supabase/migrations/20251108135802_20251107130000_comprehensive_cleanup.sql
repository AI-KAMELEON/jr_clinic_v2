-- Migration: Comprehensive Cleanup and Optimization
-- Date: 2025-11-07

-- PART 1: Index Optimization

-- 1. Remove duplicate index on agent_config.id
DROP INDEX IF EXISTS idx_agent_config_unique;

-- 2. Add missing index on wizyty.pacjent_id
CREATE INDEX IF NOT EXISTS idx_wizyty_pacjent_id 
  ON wizyty(pacjent_id)
  WHERE pacjent_id IS NOT NULL;

-- 3. Add missing index on pacjenci.telefon
CREATE INDEX IF NOT EXISTS idx_pacjenci_telefon 
  ON pacjenci(telefon)
  WHERE telefon IS NOT NULL;

-- 4. Add composite index on wizyty(data, status) for available slots queries
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

-- PART 2: Documentation Comments

-- Add comments to agent_config table documenting deprecated columns
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
;
