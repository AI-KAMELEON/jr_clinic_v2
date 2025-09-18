-- Add PESEL column and brak_pesel flag to pacjenci table
-- Remove data_urodzenia column as it will be extracted from PESEL
ALTER TABLE public.pacjenci 
ADD COLUMN pesel TEXT,
ADD COLUMN brak_pesel BOOLEAN DEFAULT FALSE;

-- Add unique constraint on PESEL (only when not null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_pacjenci_pesel_unique 
ON public.pacjenci (pesel) 
WHERE pesel IS NOT NULL;

-- Add check constraint to ensure PESEL is 11 digits when provided
ALTER TABLE public.pacjenci 
ADD CONSTRAINT check_pesel_format 
CHECK (pesel IS NULL OR (LENGTH(pesel) = 11 AND pesel ~ '^[0-9]+$'));

-- Add check constraint to ensure either PESEL is provided or brak_pesel is true
ALTER TABLE public.pacjenci 
ADD CONSTRAINT check_pesel_or_brak_pesel 
CHECK (pesel IS NOT NULL OR brak_pesel = TRUE);
