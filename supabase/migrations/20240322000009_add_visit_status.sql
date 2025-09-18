-- Add status column to wizyty table
ALTER TABLE public.wizyty 
ADD COLUMN status TEXT DEFAULT 'zaplanowana' CHECK (status IN ('zaplanowana', 'wykonana', 'odwolana'));

-- Add index for efficient status queries
CREATE INDEX IF NOT EXISTS idx_wizyty_status 
ON public.wizyty (status);

-- Update existing wizyty to have default status
UPDATE public.wizyty 
SET status = 'zaplanowana' 
WHERE status IS NULL;
