
-- Tabela dla logowania wysłanych email'i
CREATE TABLE IF NOT EXISTS public.email_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pacjent_id UUID NOT NULL REFERENCES public.pacjenci(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  temat TEXT NOT NULL,
  tresc TEXT NOT NULL,
  status TEXT DEFAULT 'SENT' CHECK (status IN ('SENT', 'FAILED', 'PENDING')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indeksy dla szybszych zapytań
CREATE INDEX idx_email_logs_pacjent_id ON public.email_logs(pacjent_id);
CREATE INDEX idx_email_logs_created_at ON public.email_logs(created_at DESC);
CREATE INDEX idx_email_logs_status ON public.email_logs(status);

-- RLS Policy - Pozwalaj na dostęp do wszystkich zalogowanych użytkowników
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access" ON public.email_logs 
  FOR ALL USING (true) WITH CHECK (true);

-- Komentarze dla dokumentacji
COMMENT ON TABLE public.email_logs IS 'Logi wysłanych email do pacjentów';
COMMENT ON COLUMN public.email_logs.pacjent_id IS 'ID pacjenta - odwołanie do tabeli pacjenci';
COMMENT ON COLUMN public.email_logs.email IS 'Adres email odbiorcy';
COMMENT ON COLUMN public.email_logs.temat IS 'Temat wiadomości email';
COMMENT ON COLUMN public.email_logs.tresc IS 'Treść wiadomości email';
COMMENT ON COLUMN public.email_logs.status IS 'Status wysłania: SENT, FAILED, PENDING';
COMMENT ON COLUMN public.email_logs.error_message IS 'Komunikat błędu w przypadku nieudanego wysłania';
;
