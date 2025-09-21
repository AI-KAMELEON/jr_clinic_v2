-- Comprehensive RLS policies for all tables
-- Enable Row Level Security for all tables

-- =============================================
-- ENABLE RLS FOR ALL TABLES
-- =============================================

-- Enable RLS for main tables
ALTER TABLE public.pacjenci ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wizyty ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.urlopy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plany_pracy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.administrators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cron_logs ENABLE ROW LEVEL SECURITY;

-- =============================================
-- ADMINISTRATORS TABLE POLICIES
-- =============================================

-- Only administrators can manage other administrators
CREATE POLICY "Administrators full access for admins" ON public.administrators
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.administrators 
      WHERE email = auth.jwt() ->> 'email' 
      AND active = true
    )
  );

-- =============================================
-- PACJENCI TABLE POLICIES
-- =============================================

-- Administrators have full access to patients
CREATE POLICY "Pacjenci full access for administrators" ON public.pacjenci
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.administrators 
      WHERE email = auth.jwt() ->> 'email' 
      AND active = true
    )
  );

-- =============================================
-- WIZYTY TABLE POLICIES
-- =============================================

-- Administrators have full access to visits
CREATE POLICY "Wizyty full access for administrators" ON public.wizyty
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.administrators 
      WHERE email = auth.jwt() ->> 'email' 
      AND active = true
    )
  );

-- =============================================
-- URLOPY TABLE POLICIES
-- =============================================

-- Administrators have full access to vacations
CREATE POLICY "Urlopy full access for administrators" ON public.urlopy
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.administrators 
      WHERE email = auth.jwt() ->> 'email' 
      AND active = true
    )
  );

-- =============================================
-- PLANY_PRACY TABLE POLICIES
-- =============================================

-- Administrators have full access to work schedules
CREATE POLICY "Plany_pracy full access for administrators" ON public.plany_pracy
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.administrators 
      WHERE email = auth.jwt() ->> 'email' 
      AND active = true
    )
  );

-- =============================================
-- LOG TABLES POLICIES
-- =============================================

-- Administrators have full access to logs
CREATE POLICY "Sms_logs full access for administrators" ON public.sms_logs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.administrators 
      WHERE email = auth.jwt() ->> 'email' 
      AND active = true
    )
  );

CREATE POLICY "Cron_logs full access for administrators" ON public.cron_logs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.administrators 
      WHERE email = auth.jwt() ->> 'email' 
      AND active = true
    )
  );

-- =============================================
-- REALTIME PUBLICATIONS
-- =============================================

-- Add realtime publications for tables that need real-time updates
ALTER PUBLICATION supabase_realtime ADD TABLE pacjenci;
ALTER PUBLICATION supabase_realtime ADD TABLE wizyty;
ALTER PUBLICATION supabase_realtime ADD TABLE urlopy;
ALTER PUBLICATION supabase_realtime ADD TABLE plany_pracy;
ALTER PUBLICATION supabase_realtime ADD TABLE cron_logs;

-- =============================================
-- COMMENTS FOR DOCUMENTATION
-- =============================================

COMMENT ON POLICY "Administrators full access for admins" ON public.administrators 
IS 'Only active administrators can manage administrator accounts';

COMMENT ON POLICY "Pacjenci full access for administrators" ON public.pacjenci 
IS 'Only active administrators can manage patients';

COMMENT ON POLICY "Wizyty full access for administrators" ON public.wizyty 
IS 'Only active administrators can manage visits';

COMMENT ON POLICY "Urlopy full access for administrators" ON public.urlopy 
IS 'Only active administrators can manage vacations';

COMMENT ON POLICY "Plany_pracy full access for administrators" ON public.plany_pracy 
IS 'Only active administrators can manage work schedules';

COMMENT ON POLICY "Sms_logs full access for administrators" ON public.sms_logs 
IS 'Only active administrators can view SMS logs';

COMMENT ON POLICY "Cron_logs full access for administrators" ON public.cron_logs 
IS 'Only active administrators can view cron logs';
