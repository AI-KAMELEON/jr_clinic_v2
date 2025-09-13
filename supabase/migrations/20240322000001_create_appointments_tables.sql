CREATE TABLE IF NOT EXISTS public.pacjenci (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  imie TEXT NOT NULL,
  nazwisko TEXT NOT NULL,
  telefon TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.wizyty (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pacjent_id UUID REFERENCES public.pacjenci(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  godzina TIME NOT NULL,
  rodzaj TEXT NOT NULL,
  notatki TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(data, godzina)
);

INSERT INTO public.pacjenci (id, imie, nazwisko, telefon) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Jan', 'Kowalski', '123-456-789'),
  ('22222222-2222-2222-2222-222222222222', 'Anna', 'Nowak', '987-654-321'),
  ('33333333-3333-3333-3333-333333333333', 'Piotr', 'Wiśniewski', '555-123-456'),
  ('44444444-4444-4444-4444-444444444444', 'Magdalena', 'Dąbrowska', '333-222-111'),
  ('55555555-5555-5555-5555-555555555555', 'Tomasz', 'Lewandowski', '111-222-333')
ON CONFLICT (id) DO NOTHING;

alter publication supabase_realtime add table pacjenci;
alter publication supabase_realtime add table wizyty;