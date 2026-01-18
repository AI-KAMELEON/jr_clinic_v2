# Integracja Retell AI z MCP Server

## Przegląd

MCP Server jest uniwersalnym interfejsem dla wszystkich narzędzi agenta głosowego, zgodnym z protokołem Model Context Protocol (MCP). Retell AI może używać tego serwera przez MCP Node w conversation flow.

## Konfiguracja MCP Node w Retell AI

### 1. Dodaj MCP Node w Retell AI Dashboard

1. Przejdź do Retell AI Dashboard → Twój Agent → Conversation Flow
2. Kliknij "Add Node" → wybierz "MCP Node"
3. Wypełnij następujące pola:

**MCP Server URL:**
```
https://twoj-projekt.supabase.co/functions/v1/mcp-server
```

**Request Headers:**
```
Authorization: Bearer YOUR_SUPABASE_ANON_KEY
Content-Type: application/json
```

**Query Parameters:**
```
(pozostaw puste)
```

### 2. Wybierz dostępne narzędzia

MCP Server udostępnia następujące 8 narzędzi:

1. **verify_patient** - Weryfikuje pacjenta na podstawie numeru telefonu
2. **get_available_slots** - Pobiera dostępne wolne terminy wizyt
3. **get_patient_appointments** - Pobiera listę zaplanowanych wizyt pacjenta
4. **book_appointment** - Rezerwuje wizytę dla pacjenta
5. **cancel_appointment** - Anuluje zaplanowaną wizytę
6. **add_note** - Dodaje notatkę do wizyty
7. **update_note** - Aktualizuje notatkę wizyty
8. **reschedule_appointment** - Przełożenie wizyty pacjenta

### 3. Konfiguracja Response Extraction

Dla każdego narzędzia możesz wyodrębnić wartości z odpowiedzi i zapisać jako dynamiczne zmienne:

**Przykład dla verify_patient:**
- Variable Name: `patient_id`
- Extract Path: `result.patient_id`
- Variable Type: Text

**Przykład dla get_available_slots:**
- Variable Name: `available_slots`
- Extract Path: `result.slots`
- Variable Type: Text (JSON array)

## Przykładowe Conversation Flow

```
Start
  ↓
Extract DV Node: "Numer telefonu pacjenta"
  ↓
MCP Node: verify_patient
  ├─ Extract: patient_id
  └─ Extract: patient_name
  ↓
Conditional Node: Czy pacjent istnieje?
  ├─ Tak → MCP Node: get_patient_appointments
  │         └─ Extract: appointments
  └─ Nie → Informacja: "Nie znaleziono pacjenta"
  ↓
MCP Node: get_available_slots
  └─ Extract: available_slots
  ↓
MCP Node: book_appointment
  └─ Extract: booking_result
  ↓
End
```

## Format Request/Response

### Request Format (MCP Protocol)

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "verify_patient",
    "arguments": {
      "telefon": "123456789"
    }
  }
}
```

### Response Format

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "success": true,
    "patient_id": "uuid-here",
    "name": "Jan Kowalski"
  }
}
```

## Szczegóły narzędzi

### verify_patient

**Parametry:**
- `telefon` (string, wymagany) - Numer telefonu pacjenta (9 cyfr)

**Odpowiedź:**
```json
{
  "success": true,
  "patient_id": "uuid",
  "name": "Imię Nazwisko"
}
```

### get_available_slots

**Parametry:**
- `data` (string, opcjonalny) - Data w formacie YYYY-MM-DD

**Odpowiedź:**
```json
{
  "success": true,
  "slots": [
    {
      "id": "uuid",
      "time": "09:00",
      "time_from": "09:00",
      "time_to": "09:30",
      "type": "konsultacja"
    }
  ]
}
```

### get_patient_appointments

**Parametry:**
- `patient_id` (string, wymagany) - UUID pacjenta
- `data` (string, opcjonalny) - Data w formacie YYYY-MM-DD

**Odpowiedź:**
```json
{
  "success": true,
  "appointments": [
    {
      "id": "uuid",
      "date": "2025-11-10",
      "time": "09:00",
      "time_from": "09:00",
      "time_to": "09:30",
      "type": "konsultacja",
      "status": "zaplanowana"
    }
  ]
}
```

### book_appointment

**Parametry:**
- `patient_id` (string, wymagany) - UUID pacjenta
- `appointment_id` (string, wymagany) - UUID terminu wizyty

**Odpowiedź:**
```json
{
  "success": true,
  "message": "Wizyta zarezerwowana pomyślnie"
}
```

### cancel_appointment

**Parametry:**
- `appointment_id` (string, wymagany) - UUID wizyty do anulowania

**Odpowiedź:**
```json
{
  "success": true,
  "message": "Wizyta anulowana pomyślnie"
}
```

### add_note

**Parametry:**
- `patient_id` (string, wymagany) - UUID pacjenta
- `appointment_id` (string, wymagany) - UUID wizyty
- `note_text` (string, wymagany) - Treść notatki

**Odpowiedź:**
```json
{
  "success": true,
  "message": "Notatka dodana pomyślnie"
}
```

### update_note

**Parametry:**
- `appointment_id` (string, wymagany) - UUID wizyty
- `note_text` (string, wymagany) - Nowa treść notatki

**Odpowiedź:**
```json
{
  "success": true,
  "message": "Notatka zaktualizowana pomyślnie"
}
```

### reschedule_appointment

**Parametry:**
- `old_appointment_id` (string, wymagany) - UUID starej wizyty
- `new_appointment_id` (string, wymagany) - UUID nowego terminu
- `patient_id` (string, wymagany) - UUID pacjenta

**Odpowiedź:**
```json
{
  "success": true,
  "message": "Wizyta przełożona pomyślnie",
  "old_slot": {
    "date": "2025-11-10",
    "time": "09:00"
  },
  "new_slot": {
    "date": "2025-11-15",
    "time": "14:00"
  }
}
```

## Bezpieczeństwo

- **Authentication**: Wymagany jest Supabase Anon Key lub Service Role Key w headerze `Authorization`
- **Rate Limiting**: 100 requestów na minutę na klienta
- **Privacy**: Wszystkie wrażliwe dane (PESEL, telefon, email) są automatycznie sanitizowane przed zwróceniem

## Testowanie

### Test przez curl

```bash
curl -X POST https://twoj-projekt.supabase.co/functions/v1/mcp-server \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }'
```

### Test wywołania narzędzia

```bash
curl -X POST https://twoj-projekt.supabase.co/functions/v1/mcp-server \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "verify_patient",
      "arguments": {
        "telefon": "123456789"
      }
    }
  }'
```

## Troubleshooting

### Błąd 401 Unauthorized
- Sprawdź czy header `Authorization` zawiera poprawny klucz Supabase
- Upewnij się że używasz `Bearer` przed kluczem

### Błąd 429 Rate Limit Exceeded
- Zwiększono limit do 100 requestów/minutę
- Poczekaj chwilę przed kolejnym wywołaniem

### Błąd -32601 Method not found
- Sprawdź czy nazwa narzędzia jest poprawna (case-sensitive)
- Upewnij się że używasz `tools/call` dla wywołań narzędzi

### Błąd -32602 Invalid params
- Sprawdź czy wszystkie wymagane parametry są podane
- Zweryfikuj format parametrów (UUID, daty YYYY-MM-DD)

## Integracja z innymi platformami

MCP Server może być używany przez:
- ✅ Retell AI (MCP Node)
- ✅ ElevenLabs (przez elevenlabs-webhook proxy)
- ✅ Cursor MCP (do testowania lokalnego)
- ✅ Claude Desktop (jeśli skonfigurowany)
- ✅ Inne platformy wspierające protokół MCP

## Wsparcie

W razie problemów sprawdź:
- Logi Supabase Edge Functions w Dashboard
- Console logs w Retell AI Dashboard
- Dokumentację MCP Protocol: https://modelcontextprotocol.io

