-- Wyłącz rejestrację użytkowników - tylko administrator może dodawać użytkowników
-- Ta funkcja blokuje wszystkie próby rejestracji

CREATE OR REPLACE FUNCTION public.block_user_registration(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
BEGIN
  -- Blokuj wszystkie próby rejestracji
  RETURN jsonb_build_object(
    'error', jsonb_build_object(
      'message', 'Rejestracja jest wyłączona. Skontaktuj się z administratorem.',
      'http_code', 403
    )
  );
END;
$$;

-- Nadaj uprawnienia
GRANT EXECUTE ON FUNCTION public.block_user_registration TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.block_user_registration FROM authenticated, anon, public;

-- Utwórz tabelę dla administratorów
CREATE TABLE IF NOT EXISTS public.administrators (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Włącz RLS
ALTER TABLE public.administrators ENABLE ROW LEVEL SECURITY;

-- Polityka RLS - tylko administratorzy mogą widzieć innych administratorów
CREATE POLICY "Administrators can view all administrators" ON public.administrators
  FOR SELECT USING (auth.uid() IN (SELECT id FROM public.administrators));

-- Polityka RLS - tylko administratorzy mogą dodawać administratorów
CREATE POLICY "Administrators can insert administrators" ON public.administrators
  FOR INSERT WITH CHECK (auth.uid() IN (SELECT id FROM public.administrators));

-- Polityka RLS - tylko administratorzy mogą aktualizować administratorów
CREATE POLICY "Administrators can update administrators" ON public.administrators
  FOR UPDATE USING (auth.uid() IN (SELECT id FROM public.administrators));

-- Polityka RLS - tylko administratorzy mogą usuwać administratorów
CREATE POLICY "Administrators can delete administrators" ON public.administrators
  FOR DELETE USING (auth.uid() IN (SELECT id FROM public.administrators));

-- Dodaj trigger do automatycznego dodawania administratorów
CREATE OR REPLACE FUNCTION public.handle_new_administrator()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Sprawdź czy użytkownik jest na liście administratorów
  IF EXISTS (SELECT 1 FROM public.administrators WHERE email = NEW.email) THEN
    -- Dodaj do tabeli administratorów
    INSERT INTO public.administrators (id, email, name)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
    );
  ELSE
    -- Jeśli nie jest administratorem, usuń użytkownika
    DELETE FROM auth.users WHERE id = NEW.id;
    RETURN NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Utwórz trigger
DROP TRIGGER IF EXISTS on_auth_user_created_administrator ON auth.users;
CREATE TRIGGER on_auth_user_created_administrator
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_administrator();
