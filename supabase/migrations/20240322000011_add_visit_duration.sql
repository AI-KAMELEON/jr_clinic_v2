-- Add visit duration columns to wizyty table
ALTER TABLE public.wizyty 
ADD COLUMN godzina_od TIME,
ADD COLUMN godzina_do TIME;

-- Add check constraint for time validation
ALTER TABLE public.wizyty 
ADD CONSTRAINT check_visit_duration 
CHECK (godzina_do > godzina_od);

-- Update existing records to use godzina as both start and end time (30-minute duration)
UPDATE public.wizyty 
SET 
  godzina_od = godzina::TIME,
  godzina_do = (godzina::TIME + INTERVAL '30 minutes')::TIME
WHERE godzina_od IS NULL OR godzina_do IS NULL;

-- Make the new columns NOT NULL after updating existing data
ALTER TABLE public.wizyty 
ALTER COLUMN godzina_od SET NOT NULL,
ALTER COLUMN godzina_do SET NOT NULL;

-- Create index for efficient time range queries
CREATE INDEX IF NOT EXISTS idx_wizyty_time_range ON public.wizyty(data, godzina_od, godzina_do);

-- Add comment explaining the change
COMMENT ON COLUMN public.wizyty.godzina_od IS 'Start time of the visit';
COMMENT ON COLUMN public.wizyty.godzina_do IS 'End time of the visit';
COMMENT ON COLUMN public.wizyty.godzina IS 'Legacy field - kept for backward compatibility, represents start time';
