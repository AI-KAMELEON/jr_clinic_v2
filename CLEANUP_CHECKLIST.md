# Cleanup Checklist

## Completed Cleanup

- ✅ Removed `personalization_url` and `personalization_secret` from UI (`AgentConfigPanel.tsx`)
- ✅ Removed `personalization_url` and `personalization_secret` from `agent-config` function
- ✅ Simplified `AgentConfigPanel` to only essential fields
- ✅ Created privacy utilities and audit logging
- ✅ Added rate limiting to `elevenlabs-webhook`

## Completed Cleanup (2025-11-07)

### Edge Functions Removed Locally ✅

1. **`create-elevenlabs-agent`** ✅
   - **Status:** Removed locally
   - **Action Required:** Delete from Supabase Dashboard or CLI: `supabase functions delete create-elevenlabs-agent`
   - **Reason:** Not used in UI, agent creation done manually in ElevenLabs

2. **`assign-twilio-phone`** ✅
   - **Status:** Removed locally
   - **Action Required:** Delete from Supabase Dashboard or CLI: `supabase functions delete assign-twilio-phone`
   - **Reason:** Not used, empty directory

3. **`get-elevenlabs-voices`** ✅
   - **Status:** Removed locally
   - **Action Required:** Delete from Supabase Dashboard or CLI: `supabase functions delete get-elevenlabs-voices`
   - **Reason:** Not used in UI, voice selection done in ElevenLabs dashboard

4. **`elevenlabs-personalization`** ✅
   - **Status:** Removed locally
   - **Action Required:** Delete from Supabase Dashboard or CLI: `supabase functions delete elevenlabs-personalization`
   - **Reason:** Optional webhook removed, using static prompt from ElevenLabs

## Pending Cleanup (High Priority)

### Edge Functions to Remove from Supabase

**Note:** Local files have been removed. Functions still exist in Supabase and need to be deleted via Dashboard or CLI.

### Test Function

1. **`cron-test`** (`supabase/functions/cron-test/`)
   - **Status:** ACTIVE v5, test function
   - **Action:** Consider removing or moving to dev environment
   - **Reason:** Test function shouldn't be in production

### Database Cleanup ✅

1. **Duplicate Index:**
   - `idx_agent_config_unique` - duplicates PRIMARY KEY
   - **Status:** ✅ Removed via migration `20251107130000_comprehensive_cleanup.sql`

2. **Missing Indexes:**
   - `wizyty.pacjent_id` - frequently queried
   - `pacjenci.telefon` - critical for verify_patient
   - `wizyty(data, status)` - for available slots queries
   - `sms_logs.data_wizyty` - for date-based queries
   - `phone_conversations.agent_id` - for agent lookups
   - `phone_conversations.status` - for status filtering
   - **Status:** ✅ All indexes added via migration `20251107130000_comprehensive_cleanup.sql`

3. **Backup Table:**
   - `wizyty_backup` - 60 rows, no RLS, 48 kB
   - **Status:** ⚠️ Commented out in migration (uncomment if not needed)
   - **Action:** Review if backup is needed, uncomment DROP TABLE in migration if removing

4. **Column Documentation:**
   - Added comments to deprecated columns in `agent_config`
   - **Status:** ✅ Comments added via migration `20251107130000_comprehensive_cleanup.sql`

### Database Columns to Review

The following columns in `agent_config` table are no longer used by the UI but kept for backward compatibility:

**Not used by UI (22 columns):**
- `voice_id`, `voice_name`, `model_id`
- `voice_stability`, `voice_similarity_boost`, `voice_style`, `use_speaker_boost`
- `llm_model_id`, `turn_timeout`, `initial_wait_time`, `silence_end_call_timeout`
- `turn_eagerness`, `asr_quality`, `asr_user_input_audio_format`
- `conversation_text_only`, `conversation_max_duration`
- `webhook_events`, `webhook_send_audio`
- `personalization_url`, `personalization_secret`

**Recommendation:** Keep columns for backward compatibility, but document which are actively used.

### Actively Used Fields in `agent_config`

- ✅ `id`, `elevenlabs_agent_id`, `twilio_phone_number`
- ✅ `agent_name`, `agent_greeting`
- ✅ `webhook_url`, `webhook_secret`
- ✅ `created_at`, `updated_at`

## Optimization Actions

### Phase 1: Cleanup (Completed ✅)
- [x] Delete `create-elevenlabs-agent` Edge Function locally ✅
- [x] Delete `assign-twilio-phone` Edge Function locally ✅
- [x] Delete `get-elevenlabs-voices` Edge Function locally ✅
- [x] Delete `elevenlabs-personalization` Edge Function locally ✅
- [x] Create comprehensive migration SQL ✅
- [x] Apply migration `20251107130000_comprehensive_cleanup.sql` via MCP ✅
- [ ] Delete functions from Supabase Dashboard/CLI (manual - still needed)
- [ ] Review and potentially remove `wizyty_backup` table (optional)

### Phase 2: Documentation (Week 1-2)
- [ ] Document which `agent_config` columns are actively used
- [ ] Mark deprecated functions in code comments
- [ ] Update architecture documentation

## See Also

- `SUPABASE_OPTIMIZATION_REPORT.md` - Detailed analysis and recommendations
- `AGENT_PRIVACY.md` - Privacy rules and data flow documentation

