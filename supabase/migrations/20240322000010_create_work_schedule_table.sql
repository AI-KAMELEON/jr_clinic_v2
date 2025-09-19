-- Create work schedule table
CREATE TABLE IF NOT EXISTS public.plany_pracy (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dzien_tygodnia TEXT NOT NULL CHECK (dzien_tygodnia IN ('poniedzialek', 'wtorek', 'sroda', 'czwartek', 'piatek', 'sobota', 'niedziela')),
    aktywny BOOLEAN NOT NULL DEFAULT true,
    godzina_od TIME NOT NULL,
    godzina_do TIME NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(dzien_tygodnia)
);

-- Add check constraint for time validation
ALTER TABLE public.plany_pracy 
ADD CONSTRAINT check_work_hours 
CHECK (godzina_do > godzina_od);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_plany_pracy_dzien ON public.plany_pracy(dzien_tygodnia);

-- Enable RLS
ALTER TABLE public.plany_pracy ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users
CREATE POLICY "Allow all operations for authenticated users" ON public.plany_pracy
    FOR ALL USING (auth.role() = 'authenticated');

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.plany_pracy;

-- Insert default work schedule (Monday-Friday 8:00-17:00, Saturday-Sunday inactive)
INSERT INTO public.plany_pracy (dzien_tygodnia, aktywny, godzina_od, godzina_do) VALUES
('poniedzialek', true, '08:00:00', '17:00:00'),
('wtorek', true, '08:00:00', '17:00:00'),
('sroda', true, '08:00:00', '17:00:00'),
('czwartek', true, '08:00:00', '17:00:00'),
('piatek', true, '08:00:00', '17:00:00'),
('sobota', false, '08:00:00', '14:00:00'),
('niedziela', false, '08:00:00', '14:00:00')
ON CONFLICT (dzien_tygodnia) DO NOTHING;
