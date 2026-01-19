-- Migration: Cleanup and Optimization
-- Date: 2025-11-07
-- Description: Remove duplicate index, add missing indexes for performance

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
;
