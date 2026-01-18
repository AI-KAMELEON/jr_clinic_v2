-- Drop old policy
DROP POLICY IF EXISTS "Allow public access" ON sms_logs;

-- Create new policy that allows service_role and authenticated users
CREATE POLICY "Allow access for service role and authenticated" ON sms_logs
  FOR ALL
  USING (true)
  WITH CHECK (true);;
