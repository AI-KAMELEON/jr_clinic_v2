-- Nadaj uprawnienia service_role do tabel
GRANT ALL ON TABLE public.pacjenci TO service_role;
GRANT ALL ON TABLE public.wizyty TO service_role;
GRANT ALL ON TABLE public.sms_logs TO service_role;
GRANT USAGE ON SCHEMA public TO service_role;;
