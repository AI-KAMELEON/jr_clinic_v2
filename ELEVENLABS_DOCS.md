# 🎙️ ElevenLabs API - Dokumentacja dla projektu

## 📋 Wprowadzenie

ElevenLabs to platforma AI oferująca zaawansowane narzędzia do syntezy mowy, konwersacyjnego AI, oraz generowania audio. W tym projekcie planujemy używać ElevenLabs do implementacji głosowego asystenta dla systemu wizyt klinicznych.

## 🔗 Przydatne linki

- **Oficjalna dokumentacja API**: https://elevenlabs.io/docs/api-reference
- **Conversational AI**: https://elevenlabs.io/docs/conversational-ai
- **Model Control Protocol (MCP)**: https://elevenlabs.io/blog/introducing-elevenlabs-mcp

## ⚙️ Konfiguracja w projekcie

### MCP Server w Cursor

Projekt jest skonfigurowany z ElevenLabs MCP Server w pliku `~/.cursor/mcp.json`:

```json
"ElevenLabs": {
  "command": "/Users/administrator/.langflow/uv/uvx",
  "args": [
    "elevenlabs-mcp"
  ],
  "env": {
    "ELEVENLABS_API_KEY": "sk_2f9a115fb638bccd5cebf8ce899ba5e1f7207ccf0934a251"
  }
}
```

### Instalacja Node.js SDK

Aby używać ElevenLabs API w kodzie projektu:

```bash
npm install @elevenlabs/elevenlabs-js
```

## 🎯 Główne funkcje API

### 1. Text to Speech (TTS)

Konwersja tekstu na mowę z naturalnym brzmieniem głosu.

**Kluczowe endpointy:**
- `POST /v1/text-to-speech/{voice_id}` - Synteza mowy z tekstu
- `POST /v1/text-to-speech/{voice_id}/stream` - Streaming audio

**Przykład użycia:**
```typescript
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

const client = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY
});

async function convertTextToSpeech(text: string) {
  const audio = await client.textToSpeech.convert(
    "voice_id_here",
    {
      text: text,
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75
      }
    }
  );
  
  return audio;
}
```

### 2. Conversational AI (Agents)

Platforma do tworzenia głosowych agentów AI, które mogą prowadzić rozmowy telefoniczne.

**Kluczowe endpointy:**
- `POST /v1/convai/agents/create` - Tworzenie nowego agenta (z `s` w `agents`)
- `PATCH /v1/convai/agents/{agent_id}` - Aktualizacja agenta
- `GET /v1/convai/agents/{agent_id}` - Pobieranie informacji o agencie
- `POST /v1/convai/conversation` - Rozpoczęcie konwersacji
- `POST /v1/convai/conversation/{conversation_id}/end` - Zakończenie konwersacji

**Przykład tworzenia agenta:**
```typescript
async function createVoiceAgent() {
  const agent = await client.conversationalAI.create({
    name: "Asystent Wizyt Klinicznych",
    prompt: {
      prompt: "Jesteś asystentem w klinice. Pomagasz pacjentom umawiać wizyty...",
    },
    language: "pl",
    voice_id: "polish_voice_id",
    webhook_url: "https://your-supabase-functions.supabase.co/functions/v1/elevenlabs-webhook"
  });
  
  return agent;
}
```

### 3. Voices (Głosy)

Zarządzanie dostępnymi głosami do syntezy mowy.

**Kluczowe endpointy:**
- `GET /v1/voices` - Lista dostępnych głosów
- `GET /v1/voices/{voice_id}` - Szczegóły głosu
- `POST /v1/voices/{voice_id}/edit` - Edycja głosu

### 4. Speech to Text (STT)

Transkrypcja mowy na tekst.

**Kluczowe endpointy:**
- `POST /v1/speech-to-text` - Transkrypcja audio

### 5. Text to Dialogue

Generowanie dialogów z wieloma postaciami.

### 6. Dubbing

Automatyczne dubbingowanie treści w różnych językach.

## 🔧 Planowana integracja w projekcie

### Faza 2: Voice AI (zgodnie z progress.md)

1. **ElevenLabs Conversational AI Agent**
   - Agent setup z custom prompt dla kliniki
   - Integracja z bazą danych pacjentów
   - Custom tools/variables (patient_id, available_slots)

2. **Supabase Edge Functions**
   - `verify-patient` - Identyfikacja pacjenta po PESEL/telefon
   - `get-available-slots` - Pobieranie wolnych terminów
   - `book-appointment` - Rezerwacja wizyty
   - `cancel-appointment` - Anulowanie wizyty

3. **Tabela phone_conversations**
   - Logowanie wszystkich rozmów telefonicznych
   - Przechowywanie transkrypcji
   - Analiza jakości rozmów

## 📝 Przykład integracji z Supabase Edge Function

```typescript
// supabase/functions/elevenlabs-webhook/index.ts
import { serve } from "https://deno.land/std@0.181.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  const { event, data } = await req.json();
  
  // Obsługa eventów z ElevenLabs
  switch (event) {
    case "conversation_started":
      await logConversation(data);
      break;
    
    case "function_call":
      return await handleFunctionCall(data);
      break;
    
    case "conversation_ended":
      await finalizeConversation(data);
      break;
  }
  
  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" },
  });
});

async function handleFunctionCall(data: any) {
  const { function_name, parameters } = data;
  
  switch (function_name) {
    case "verify_patient":
      return await verifyPatient(parameters);
    case "get_available_slots":
      return await getAvailableSlots(parameters);
    case "book_appointment":
      return await bookAppointment(parameters);
  }
}

async function verifyPatient(params: { pesel?: string; telefon?: string }) {
  const { data, error } = await supabase
    .from("pacjenci")
    .select("id, imie, nazwisko")
    .or(`pesel.eq.${params.pesel},telefon.eq.${params.telefon}`)
    .single();
  
  if (error || !data) {
    return { success: false, message: "Nie znaleziono pacjenta" };
  }
  
  return {
    success: true,
    patient_id: data.id,
    name: `${data.imie} ${data.nazwisko}`
  };
}

async function getAvailableSlots(params: { data?: string }) {
  const targetDate = params.data || new Date().toISOString().split('T')[0];
  
  const { data: slots, error } = await supabase
    .from("wizyty")
    .select("id, godzina, lekarz_id")
    .eq("data", targetDate)
    .eq("status", "wolna")
    .order("godzina");
  
  if (error) {
    return { success: false, slots: [] };
  }
  
  return {
    success: true,
    slots: slots.map(s => ({
      id: s.id,
      time: s.godzina,
      doctor_id: s.lekarz_id
    }))
  };
}

async function bookAppointment(params: { 
  patient_id: string; 
  appointment_id: string;
}) {
  const { error } = await supabase
    .from("wizyty")
    .update({ 
      pacjent_id: params.patient_id,
      status: "zarezerwowana"
    })
    .eq("id", params.appointment_id);
  
  if (error) {
    return { success: false, message: "Błąd rezerwacji" };
  }
  
  return { success: true, message: "Wizyta zarezerwowana" };
}
```

## 🔐 Bezpieczeństwo

- **API Key**: Przechowuj w zmiennych środowiskowych, nigdy w kodzie
- **Webhook Security**: Weryfikuj podpisy webhooków od ElevenLabs
- **RLS Policies**: Upewnij się, że dane pacjentów są chronione przez Row Level Security
- **Environment Variables**: Używaj Supabase Secrets dla kluczy API

## 📊 Modele kontroli jakości

Dostępne modele:
- `eleven_multilingual_v2` - Wielojęzyczny (zalecany dla polskiego)
- `eleven_turbo_v2` - Szybszy, optymalizowany
- `eleven_monolingual_v1` - Monolingwalny

## 🎚️ Voice Settings

- **Stability** (0.0-1.0): Stabilność głosu, wyższa wartość = bardziej konsystentny
- **Similarity Boost** (0.0-1.0): Podobieństwo do oryginalnego głosu
- **Style** (0.0-1.0): Ekspresywność (tylko niektóre głosy)
- **Use Speaker Boost** (boolean): Wzmacnianie jakości głosu

**Rekomendowane ustawienia dla polskiego:**
```typescript
{
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0.3,
  use_speaker_boost: true
}
```

## 🌐 Obsługa języków

ElevenLabs wspiera wiele języków, w tym:
- Polski (pl) - **ważne dla projektu**
- Angielski (en)
- Hiszpański (es)
- Francuski (fr)
- Niemiecki (de)
- Włoski (it)

## 📞 Integracja z Twilio (planowana)

ElevenLabs może być zintegrowany z Twilio dla połączeń telefonicznych:

1. **Flow:**
   - Twilio odbiera połączenie przychodzące
   - Przekierowuje do ElevenLabs Conversational AI
   - Agent prowadzi rozmowę
   - Webhook do Supabase dla zapisu danych

2. **Konfiguracja Twilio:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://api.elevenlabs.io/v1/convai/conversation/start" />
  </Connect>
</Response>
```

## 🧪 Testowanie

### Test lokalny z ElevenLabs MCP:

Użyj MCP server w Cursor do testowania bezpośrednio:
- Wywołaj funkcje MCP przez Cursor
- Sprawdź odpowiedzi agentów
- Przetestuj różne scenariusze rozmów

### Test w Supabase Edge Functions:

```bash
# Deployment funkcji
supabase functions deploy elevenlabs-webhook

# Test lokalny
supabase functions serve elevenlabs-webhook

# Test webhook
curl -X POST https://your-project.supabase.co/functions/v1/elevenlabs-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event": "function_call",
    "data": {
      "function_name": "verify_patient",
      "parameters": {"pesel": "12345678901"}
    }
  }'
```

## 📈 Monitoring i Logi

### Logowanie rozmów:

```typescript
async function logConversation(data: any) {
  await supabase.from("phone_conversations").insert({
    conversation_id: data.conversation_id,
    phone_number: data.phone_number,
    started_at: new Date().toISOString(),
    agent_id: data.agent_id,
    status: "active"
  });
}

async function finalizeConversation(data: any) {
  await supabase
    .from("phone_conversations")
    .update({
      ended_at: new Date().toISOString(),
      status: "completed",
      transcript: data.transcript,
      duration_seconds: data.duration
    })
    .eq("conversation_id", data.conversation_id);
}
```

## 📚 Dodatkowe zasoby

- [ElevenLabs Pricing](https://elevenlabs.io/pricing)
- [API Status](https://status.elevenlabs.io)
- [Community Forum](https://elevenlabs.io/community)
- [GitHub Examples](https://github.com/elevenlabs)
- [MCP Server GitHub](https://github.com/elevenlabs/elevenlabs-mcp)

## 💰 Pricing

ElevenLabs oferuje różne plany:
- **Starter**: Darmowy tier z limitami
- **Creator**: $5/miesiąc
- **Pro**: $22/miesiąc
- **Business**: Custom pricing

Dla projektu klinicznego zalecany plan **Business** dla:
- Nielimitowanych rozmów telefonicznych
- Wsparcia SLA
- Zaawansowanych funkcji bezpieczeństwa

## 🎛️ Zarządzanie konfiguracją z UI

System agenta głosowego jest w pełni zarządzany z poziomu aplikacji webowej.

### Konfiguracja podstawowa

1. **Dostęp do panelu**: Menu boczne → "Agent głosowy"
2. **Wprowadzanie danych**:
   - **ElevenLabs Agent ID**: Wklej ID agenta utworzonego w panelu ElevenLabs
   - **Numer telefonu Twilio**: Numer przypisany do agenta w Twilio
   - **Powitanie**: Pierwsza wiadomość wypowiadana przez agenta

3. **Zapisywanie**: Dane są zapisywane do bazy danych przez Edge Function `agent-config`

### Edycja promptu

1. **Edytor Markdown**: Panel zawiera edytor do wprowadzania promptu w formacie Markdown
2. **Dostępne zmienne**:
   - `{{current_date}}` - Aktualna data (np. "poniedziałek, 5 listopada 2025")
   - `{{current_time}}` - Aktualna godzina (np. "18:47")
   - `{{caller_number}}` - Numer telefonu dzwoniącego

3. **Zapisywanie**: Prompt jest zapisywany do Supabase Storage jako plik `prompt.md`

### Edge Functions

System używa następujących Edge Functions:

- **`agent-config`**: Zarządzanie konfiguracją (GET/POST)
- **`elevenlabs-webhook`**: Obsługa eventów z ElevenLabs (conversation_started, function_call, conversation_ended)
- **`elevenlabs-personalization`**: Wczytywanie i personalizacja promptu dla każdego połączenia

### Struktura danych

**Tabela `agent_config`**:
- `elevenlabs_agent_id` - ID agenta z ElevenLabs
- `twilio_phone_number` - Numer telefonu Twilio
- `agent_greeting` - Powitanie agenta

**Storage `agent-config`**:
- `prompt.md` - Prompt agenta w formacie Markdown

**Tabela `phone_conversations`**:
- Logowanie wszystkich rozmów telefonicznych
- Przechowywanie transkrypcji
- Status rozmowy (active/completed/failed)

## 🚀 Następne kroki

1. ✅ Konfiguracja MCP Server (zrobione)
2. ✅ Implementacja Edge Functions (zrobione)
3. ✅ UI do zarządzania konfiguracją (zrobione)
4. ⏳ Instalacja Node.js SDK: `npm install @elevenlabs/elevenlabs-js` (opcjonalnie)
5. ⏳ Tworzenie pierwszego agenta w ElevenLabs i konfiguracja webhook URL
6. ⏳ Konfiguracja agenta w UI (wprowadzenie Agent ID i numeru telefonu)
7. ⏳ Testowanie funkcji verify_patient, get_available_slots, book_appointment
8. ⏳ Integracja z Twilio (konfiguracja numeru telefonu)
9. ⏳ Testy end-to-end z rzeczywistymi połączeniami
10. ⏳ Monitoring i analiza jakości rozmów

---

**Ostatnia aktualizacja**: 2025-11-05  
**Wersja API**: v1  
**Status**: Implementacja zakończona - gotowe do konfiguracji i testów  
**API Key**: Skonfigurowany w MCP Server


