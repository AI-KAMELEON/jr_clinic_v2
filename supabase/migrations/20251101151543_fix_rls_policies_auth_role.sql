
-- Usuwam błędne polityki RLS i tworzę poprawne
-- Policja dla wizyty
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.wizyty;
DROP POLICY IF EXISTS "Wizyty full access for administrators" ON public.wizyty;

CREATE POLICY "Enable all for authenticated users" ON public.wizyty 
FOR ALL 
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Policja dla pacjenci
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.pacjenci;
DROP POLICY IF EXISTS "Pacjenci full access for administrators" ON public.pacjenci;

CREATE POLICY "Enable all for authenticated users" ON public.pacjenci 
FOR ALL 
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Policja dla notatki_dzienne
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.notatki_dzienne;
DROP POLICY IF EXISTS "Notatki full access for administrators" ON public.notatki_dzienne;

CREATE POLICY "Enable all for authenticated users" ON public.notatki_dzienne 
FOR ALL 
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Policja dla urlopy
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.urlopy;
DROP POLICY IF EXISTS "Urlopy full access for administrators" ON public.urlopy;

CREATE POLICY "Enable all for authenticated users" ON public.urlopy 
FOR ALL 
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Policja dla plany_pracy
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON public.plany_pracy;

CREATE POLICY "Enable all for authenticated users" ON public.plany_pracy 
FOR ALL 
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Policja dla sms_logs
DROP POLICY IF EXISTS "Allow read for authenticated users" ON public.sms_logs;
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON public.sms_logs;
DROP POLICY IF EXISTS "Allow update for authenticated users" ON public.sms_logs;
DROP POLICY IF EXISTS "Allow delete for authenticated users" ON public.sms_logs;

CREATE POLICY "Enable all for authenticated users" ON public.sms_logs 
FOR ALL 
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);
;
