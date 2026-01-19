
-- Usuwam wszystkie RLS polityki - będą tabelki bez RLS
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.wizyty;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.pacjenci;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.notatki_dzienne;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.urlopy;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.plany_pracy;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.sms_logs;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.administrators;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.cron_logs;

-- Usuwam stare polityki administratorów
DROP POLICY IF EXISTS "Wizyty full access for administrators" ON public.wizyty;
DROP POLICY IF EXISTS "Pacjenci full access for administrators" ON public.pacjenci;
DROP POLICY IF EXISTS "Notatki full access for administrators" ON public.notatki_dzienne;
DROP POLICY IF EXISTS "Urlopy full access for administrators" ON public.urlopy;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON public.urlopy;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON public.plany_pracy;
DROP POLICY IF EXISTS "admin_delete_policy" ON public.administrators;
DROP POLICY IF EXISTS "admin_insert_policy" ON public.administrators;
DROP POLICY IF EXISTS "admin_select_policy" ON public.administrators;
DROP POLICY IF EXISTS "admin_update_policy" ON public.administrators;

-- Usuwam stare SMS polityki
DROP POLICY IF EXISTS "Allow read for authenticated users" ON public.sms_logs;
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON public.sms_logs;
DROP POLICY IF EXISTS "Allow update for authenticated users" ON public.sms_logs;
DROP POLICY IF EXISTS "Allow delete for authenticated users" ON public.sms_logs;
;
