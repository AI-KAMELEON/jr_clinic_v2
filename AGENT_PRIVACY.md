# Privacy & Data Flow Documentation

## Voice Agent Privacy Rules

### Data Never Exposed to Agent

The voice agent **NEVER** receives or can access:

- **PESEL** - Completely masked, never in responses
- **Phone numbers** - Only used for verification, never returned
- **Email addresses** - Never exposed
- **Addresses** - Never exposed
- **Other patients' data** - Agent can only see caller's own data

### Data Always Sanitized

All responses go through `privacy-utils.ts` sanitization:

- `sanitizePatientData()` - Returns ONLY: `id`, `imie`, `nazwisko`
- `sanitizeAppointmentData()` - Returns ONLY: `id`, `date`, `time`, `time_from`, `time_to`, `type`, `status`
- `sanitizeSlotData()` - Returns ONLY: `id`, `time`, `time_from`, `time_to`, `type`

### Function Responses

#### `verify_patient`
```json
{
  "success": true,
  "patient_id": "uuid",
  "name": "Imię Nazwisko"
}
```
**Never includes:** PESEL, phone, email, address

#### `get_available_slots`
```json
{
  "success": true,
  "slots": [
    {
      "id": "uuid",
      "time": "09:00",
      "time_from": "09:00",
      "time_to": "09:30",
      "type": "Kontrola"
    }
  ]
}
```
**Never includes:** patient_id, PESEL, any patient data

#### `get_patient_appointments`
```json
{
  "success": true,
  "appointments": [
    {
      "id": "uuid",
      "date": "2025-11-08",
      "time": "09:00",
      "time_from": "09:00",
      "time_to": "09:30",
      "type": "Kontrola",
      "status": "zaplanowana"
    }
  ]
}
```
**Only shows:** Caller's own appointments (filtered by `patient_id`)

#### `book_appointment`, `cancel_appointment`, `add_note`, `update_note`, `reschedule_appointment`
```json
{
  "success": true,
  "message": "Operation completed successfully"
}
```
**Never includes:** Patient data, PESEL, or sensitive information

## Data Flow Diagram

```
ElevenLabs Agent
  ↓ (webhook with secret)
elevenlabs-webhook Edge Function
  ↓ (rate limit check: 100 req/min)
  ↓ (sanitize all inputs)
Handler Function (verify_patient, book_appointment, etc.)
  ↓ (query Supabase with service_role)
  ↓ (sanitize all outputs)
Response (only necessary fields)
  ↓ (audit log to phone_conversations)
ElevenLabs Agent
```

## Security Measures

1. **Webhook Secret Verification** - All requests must include valid `x-webhook-secret`
2. **Agent ID Verification** - Only configured agent can call webhook
3. **Rate Limiting** - Max 100 requests per minute per agent
4. **Input Validation** - All UUIDs and dates validated before use
5. **SQL Injection Protection** - All string inputs sanitized
6. **RLS Policies** - Service role has minimal necessary permissions
7. **Audit Logging** - All function calls logged (with sanitized parameters)

## Audit Logging

All agent operations are logged to `phone_conversations.transcript`:

- Function name
- Sanitized parameters (PESEL/phone removed)
- Result (success/error)
- Timestamp

**Never logged:**
- PESEL
- Phone numbers
- Email addresses
- Other sensitive data

## Rate Limiting

- **Limit:** 100 requests per minute per agent
- **Window:** 60 seconds
- **Storage:** In-memory (resets on function restart)
- **Response:** HTTP 429 if exceeded

## Validation Rules

- **UUIDs:** Must match regex `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`
- **Dates:** Must be `YYYY-MM-DD` format and valid date
- **Strings:** Sanitized to remove SQL injection patterns

## Notes

- Patient verification is done by phone number only (never PESEL)
- Agent can only access data for the verified caller
- All responses are minimal - only what's needed for the operation
- Error messages never expose sensitive data

