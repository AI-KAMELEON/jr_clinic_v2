
-- Włączam RLS i tworzę politykę PUBLICZNĄ dla wszystkich tabel
ALTER TABLE public.wizyty ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access" ON public.wizyty FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.pacjenci ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access" ON public.pacjenci FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.notatki_dzienne ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access" ON public.notatki_dzienne FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.urlopy ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access" ON public.urlopy FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.plany_pracy ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access" ON public.plany_pracy FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access" ON public.sms_logs FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.administrators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access" ON public.administrators FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.cron_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access" ON public.cron_logs FOR ALL USING (true) WITH CHECK (true);
;
