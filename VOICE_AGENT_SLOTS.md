# Voice Agent Slot Workflow

This document describes how to expose appointment availability to the voice
agent and automation (n8n) using the `schedule_slots` table. The goal is to
pre-compute availability units so the agent can quickly list,
reserve, and cancel time windows without recalculating schedules on the fly.

## Data Model

`schedule_slots` stores available slots in 15-minute units (base) and optionally
pre-generated 30-minute units:

- `id` – UUID primary key (slot identifier).
- `resource_id` – optional UUID for the resource/doctor/gabinet.
- `slot_date`, `slot_start`, `slot_end` – slot window in local time.
- `slot_unit_minutes` – length of the slot (15 or 30 when pre-generated).
- `slot_group_id` – optional UUID grouping slots that came from the same window.
- `status` – `free` (available) or `booked` (zarezerwowane przez wizytę).
- `linked_wizyta_id` – UUID of the record in `wizyty` once the slot is booked.
- `metadata` – JSON payload for extra details.

## Generating Slots

1. **Source data:** `plany_pracy`, `urlopy`, and **existing `wizyty`**.
2. **Cron / automation:** Once per day (or on demand), `generate-slots` Edge Function:
   - Fetches work plans and holidays.
   - Fetches existing visits to avoid collisions.
   - Generates both **15-minute** and **30-minute** slots for every available 15-minute interval.
   - Inserts only `status='free'` slots (slots overlapping with visits or holidays are skipped).
3. **On plan changes:** Re-run the generator for the affected range to refresh slots.

## Booking Flow (n8n or other automation)

1. Fetch slot list based on patient preference:
   
   For **15-minute** visit:
   ```http
   GET /rest/v1/schedule_slots
     ?status=eq.free
     &slot_unit_minutes=eq.15
     &slot_date=gte.{{from_date}}
     &order=slot_date.asc,slot_start.asc
     &limit=10
   ```

   For **30-minute** visit:
   ```http
   GET /rest/v1/schedule_slots
     ?status=eq.free
     &slot_unit_minutes=eq.30
     &slot_date=gte.{{from_date}}
     &order=slot_date.asc,slot_start.asc
     &limit=10
   ```

2. Reserve slot(s) (15-minute base):
  ```sql
  -- blokada wszystkich 15-min slotów w zakresie wizyty
  update schedule_slots
     set status = 'booked',
         slot_group_id = :group_id,
         linked_wizyta_id = :wizyta_id,
         updated_at = now()
   where slot_date = :slot_date
     and slot_start >= :slot_start
     and slot_start < :slot_end
     and slot_unit_minutes = 15
     and status = 'free';

  insert into wizyty (id, data, godzina, godzina_od, godzina_do, pacjent_id, status, ...)
  values (:wizyta_id, :slot_date, :slot_start, :slot_start, :slot_end, :patient_id, 'zaplanowana', ...);
  ```
  
  *Note: Dłuższe wizyty (30/45/60) są realizowane przez blokowanie kilku slotów 15-minutowych.*

3. Cancellation:
   ```sql
   update wizyty
      set status = 'odwolana',
          pacjent_id = null
    where id = :wizyta_id;

   update schedule_slots
      set status = 'free',
          linked_wizyta_id = null,
          updated_at = now()
    where linked_wizyta_id = :wizyta_id;
   ```

## Voice Agent Contract

- **List slots:** Agent asks patient for preferred duration (wielokrotność 15 min) i przekazuje `duration_minutes`.
- **Book:** send `slot_id` + `patient_id` + opcjonalnie `duration_minutes`.
- **Cancel:** provide `wizyta_id`.
