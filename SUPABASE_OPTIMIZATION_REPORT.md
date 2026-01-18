# Raport Analizy i Optymalizacji Supabase

**Data:** 2025-11-07  
**Projekt:** frontvisitella  
**Analiza:** Edge Functions + Tabele + Migracje

---

## 1. ANALIZA EDGE FUNCTIONS

### Aktywne Funkcje (11 funkcji)

| Funkcja | Status | Wersja | verify_jwt | Użycie |
|---------|--------|--------|------------|--------|
| `send-admin-sms` | ACTIVE | 16 | ❌ | ✅ Używana |
| `daily-reminder` | ACTIVE | 5 | ❌ | ✅ Używana (cron) |
| `cron-test` | ACTIVE | 5 | ❌ | ⚠️ Testowa |
| `send-patient-email` | ACTIVE | 3 | ❌ | ✅ Używana |
| `send-patient-sms` | ACTIVE | 9 | ❌ | ✅ Używana |
| `agent-config` | ACTIVE | 3 | ❌ | ✅ Używana |
| `elevenlabs-webhook` | ACTIVE | 5 | ❌ | ✅ Używana (główna) |
| `elevenlabs-personalization` | ACTIVE | 4 | ❌ | ✅ Używana |
| `get-elevenlabs-voices` | ACTIVE | 8 | ❌ | ✅ Używana |
| `create-elevenlabs-agent` | ACTIVE | 6 | ❌ | ⚠️ **NIEUŻYWANA** |
| `assign-twilio-phone` | ACTIVE | 3 | ✅ | ⚠️ **NIEUŻYWANA** |

### Problemy zidentyfikowane:

1. **`create-elevenlabs-agent`** - Funkcja nie jest używana w UI (usunięta z `AgentConfigPanel`)
   - **Akcja:** Usunąć lub oznaczyć jako deprecated
   
2. **`assign-twilio-phone`** - Funkcja nie jest używana (pusty katalog lokalnie)
   - **Akcja:** Usunąć z Supabase

3. **`cron-test`** - Funkcja testowa w produkcji
   - **Akcja:** Rozważyć usunięcie lub przeniesienie do środowiska dev

4. **Brak `verify_jwt`** - Wszystkie funkcje mają `verify_jwt: false`
   - **Akcja:** Rozważyć włączenie dla funkcji wymagających autoryzacji

---

## 2. ANALIZA TABEL

### Rozmiary tabel (od największej):

| Tabela | Rozmiar | Wiersze | Status |
|--------|---------|---------|--------|
| `wizyty` | 424 kB | 901 | ✅ Aktywna |
| `sms_logs` | 288 kB | 508 | ✅ Aktywna |
| `pacjenci` | 232 kB | 752 | ✅ Aktywna |
| `notatki_dzienne` | 64 kB | 22 | ✅ Aktywna |
| `plany_pracy` | 64 kB | 7 | ✅ Aktywna |
| `agent_config` | 48 kB | 1 | ✅ Aktywna |
| `urlopy` | 48 kB | 15 | ✅ Aktywna |
| `wizyty_backup` | 48 kB | 60 | ⚠️ **BACKUP** |
| `administrators` | 48 kB | 1 | ✅ Aktywna |
| `email_logs` | 40 kB | 0 | ✅ Pusta |
| `email_inbox` | 40 kB | 0 | ✅ Pusta |
| `email_accounts` | 32 kB | 0 | ✅ Pusta |
| `cron_logs` | 32 kB | 2 | ✅ Aktywna |
| `phone_conversations` | 24 kB | 0 | ✅ Pusta |

### Problemy zidentyfikowane:

1. **`wizyty_backup`** - Tabela backup bez RLS
   - **Rozmiar:** 48 kB, 60 wierszy
   - **Akcja:** Rozważyć archiwizację lub usunięcie jeśli backup nie jest potrzebny

2. **Puste tabele emailowe** - `email_logs`, `email_inbox`, `email_accounts`
   - **Status:** Gotowe do użycia, ale nieużywane
   - **Akcja:** Zachować (funkcjonalność gotowa)

3. **`phone_conversations`** - Pusta (gotowa na użycie)
   - **Status:** Gotowa do użycia przez agenta głosowego
   - **Akcja:** Zachować

---

## 3. ANALIZA TABELI `agent_config`

### Kolumny (29 kolumn):

**Aktywnie używane (7):**
- ✅ `id`, `elevenlabs_agent_id`, `twilio_phone_number`
- ✅ `agent_name`, `agent_greeting`
- ✅ `webhook_url`, `webhook_secret`
- ✅ `created_at`, `updated_at`

**Nieużywane przez UI (22 kolumny):**
- ❌ `voice_id`, `voice_name`, `model_id`
- ❌ `voice_stability`, `voice_similarity_boost`, `voice_style`, `use_speaker_boost`
- ❌ `llm_model_id`, `turn_timeout`, `initial_wait_time`, `silence_end_call_timeout`
- ❌ `turn_eagerness`, `asr_quality`, `asr_user_input_audio_format`
- ❌ `conversation_text_only`, `conversation_max_duration`
- ❌ `webhook_events`, `webhook_send_audio`
- ❌ `personalization_url`, `personalization_secret`

**Problem:**
- Tabela ma 29 kolumn, ale tylko 7 jest używanych przez UI
- Większość kolumn to legacy z wcześniejszych wersji konfiguracji

**Rekomendacja:**
- Zachować kolumny dla kompatybilności wstecznej
- Dokumentować które kolumny są aktywnie używane
- Rozważyć migrację do osobnej tabeli w przyszłości

---

## 4. ANALIZA INDEKSÓW

### Zduplikowane indeksy:

1. **`agent_config`** - Ma 2 indeksy na `id`:
   - `agent_config_pkey` (PRIMARY KEY)
   - `idx_agent_config_unique` (UNIQUE INDEX)
   - **Problem:** Duplikacja - PRIMARY KEY już zapewnia unikalność
   - **Akcja:** Usunąć `idx_agent_config_unique`

### Brakujące indeksy (potencjalne):

1. **`wizyty.pacjent_id`** - Często używane w zapytaniach, brak indeksu
   - **Akcja:** Dodać indeks `CREATE INDEX idx_wizyty_pacjent_id ON wizyty(pacjent_id)`

2. **`pacjenci.telefon`** - Używane w `verify_patient`, brak indeksu
   - **Akcja:** Dodać indeks `CREATE INDEX idx_pacjenci_telefon ON pacjenci(telefon)`

3. **`wizyty.data + status`** - Często filtrowane razem
   - **Akcja:** Rozważyć indeks złożony `CREATE INDEX idx_wizyty_data_status ON wizyty(data, status) WHERE status = 'zaplanowana'`

---

## 5. REKOMENDACJE OPTYMALIZACJI

### Priorytet 1: Czyszczenie (Wysoki)

1. **Usunąć nieużywane Edge Functions:**
   ```sql
   -- W Supabase Dashboard lub przez CLI:
   -- supabase functions delete create-elevenlabs-agent
   -- supabase functions delete assign-twilio-phone
   ```

2. **Usunąć zduplikowany indeks:**
   ```sql
   DROP INDEX IF EXISTS idx_agent_config_unique;
   ```

3. **Rozważyć usunięcie `wizyty_backup`:**
   ```sql
   -- Jeśli backup nie jest potrzebny:
   DROP TABLE IF EXISTS wizyty_backup;
   ```

### Priorytet 2: Optymalizacja wydajności (Średni)

1. **Dodać brakujące indeksy:**
   ```sql
   CREATE INDEX IF NOT EXISTS idx_wizyty_pacjent_id 
     ON wizyty(pacjent_id);
   
   CREATE INDEX IF NOT EXISTS idx_pacjenci_telefon 
     ON pacjenci(telefon);
   
   CREATE INDEX IF NOT EXISTS idx_wizyty_data_status 
     ON wizyty(data, status) 
     WHERE status = 'zaplanowana';
   ```

2. **Optymalizacja `sms_logs`:**
   ```sql
   -- Indeks dla częstych zapytań po dacie:
   CREATE INDEX IF NOT EXISTS idx_sms_logs_data_wizyty 
     ON sms_logs(data_wizyty DESC);
   ```

### Priorytet 3: Dokumentacja (Niski)

1. **Dokumentować aktywnie używane kolumny w `agent_config`**
2. **Oznaczyć deprecated funkcje w kodzie**
3. **Utworzyć dokumentację architektury**

---

## 6. PLAN DZIAŁAŃ

### Faza 1: Czyszczenie (Teraz)

- [ ] Usunąć `create-elevenlabs-agent` Edge Function
- [ ] Usunąć `assign-twilio-phone` Edge Function
- [ ] Usunąć `idx_agent_config_unique` (duplikat)
- [ ] Rozważyć usunięcie `wizyty_backup` (jeśli niepotrzebna)

### Faza 2: Optymalizacja (Tydzień 1-2)

- [ ] Dodać indeks na `wizyty.pacjent_id`
- [ ] Dodać indeks na `pacjenci.telefon`
- [ ] Dodać indeks złożony na `wizyty(data, status)`
- [ ] Dodać indeks na `sms_logs.data_wizyty`

### Faza 3: Dokumentacja (Tydzień 2-3)

- [ ] Zaktualizować `CLEANUP_CHECKLIST.md` z wykonanymi akcjami
- [ ] Utworzyć dokumentację architektury funkcji
- [ ] Oznaczyć deprecated kolumny w `agent_config`

---

## 7. PODSUMOWANIE

### Statystyki:

- **Edge Functions:** 11 (2 do usunięcia, 1 testowa)
- **Tabele:** 14 (1 backup do przeglądu)
- **Indeksy:** 30 (1 duplikat do usunięcia, 3-4 do dodania)
- **Rozmiar bazy:** ~1.5 MB (bardzo mała, optymalizacja nie krytyczna)

### Główne problemy:

1. ⚠️ Nieużywane funkcje w produkcji
2. ⚠️ Zduplikowany indeks
3. ⚠️ Brakujące indeksy dla częstych zapytań
4. ⚠️ Tabela backup bez RLS

### Korzyści z optymalizacji:

- ✅ Mniejsza powierzchnia ataku (mniej funkcji)
- ✅ Lepsza wydajność zapytań (indeksy)
- ✅ Czystsza architektura (usunięcie legacy)
- ✅ Łatwiejsze utrzymanie (mniej kodu)

---

**Następne kroki:** Wykonać Faza 1 (czyszczenie) natychmiast, Faza 2 (optymalizacja) w ciągu tygodnia.

