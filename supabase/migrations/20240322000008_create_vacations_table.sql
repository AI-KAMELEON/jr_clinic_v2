-- Create vacations table for managing clinic holidays/vacations
CREATE TABLE IF NOT EXISTS public.urlopy (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  data_od DATE NOT NULL,
  data_do DATE NOT NULL,
  opis TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add constraint to ensure data_do >= data_od
ALTER TABLE public.urlopy 
ADD CONSTRAINT check_vacation_dates 
CHECK (data_do >= data_od);

-- Add index for efficient date range queries
CREATE INDEX IF NOT EXISTS idx_urlopy_dates 
ON public.urlopy (data_od, data_do);

-- Add realtime publication for urlopy table
ALTER PUBLICATION supabase_realtime ADD TABLE urlopy;

-- Add RLS policies
ALTER TABLE public.urlopy ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users (admin only in this case)
CREATE POLICY "Allow all operations for authenticated users" ON public.urlopy
  FOR ALL USING (auth.role() = 'authenticated');
