-- RLS policies for sms_logs table
-- Enable Row Level Security
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;

-- Policy for SELECT operations - allow authenticated users to read all logs
CREATE POLICY "Allow read for authenticated users" ON public.sms_logs
  FOR SELECT USING (auth.role() = 'authenticated');

-- Policy for INSERT operations - allow authenticated users to insert logs
CREATE POLICY "Allow insert for authenticated users" ON public.sms_logs
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Policy for DELETE operations - allow authenticated users to delete logs
CREATE POLICY "Allow delete for authenticated users" ON public.sms_logs
  FOR DELETE USING (auth.role() = 'authenticated');

-- Policy for UPDATE operations - allow authenticated users to update logs
CREATE POLICY "Allow update for authenticated users" ON public.sms_logs
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Add realtime publication for sms_logs table
ALTER PUBLICATION supabase_realtime ADD TABLE sms_logs;
