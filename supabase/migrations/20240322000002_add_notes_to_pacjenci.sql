ALTER TABLE public.pacjenci ADD COLUMN IF NOT EXISTS notatki TEXT;

UPDATE public.pacjenci SET notatki = 'Brak notatek' WHERE notatki IS NULL;

alter publication supabase_realtime add table pacjenci;