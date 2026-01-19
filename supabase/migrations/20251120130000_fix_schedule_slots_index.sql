-- Drop the old unique index that prevented multiple slots starting at the same time
DROP INDEX IF EXISTS schedule_slots_unique_idx;

-- Create a new unique index that includes slot_unit_minutes
CREATE UNIQUE INDEX IF NOT EXISTS schedule_slots_unique_v2_idx
    ON public.schedule_slots (
        coalesce(resource_id, '00000000-0000-0000-0000-000000000000'::uuid),
        slot_date,
        slot_start,
        slot_unit_minutes
    );




