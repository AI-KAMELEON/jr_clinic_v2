-- Utwórz administratora z hasłem
-- Zastąp 'admin@example.com' i 'admin123' swoimi danymi

-- Utwórz użytkownika administratora
INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  recovery_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'admin@example.com',
  crypt('admin123', gen_salt('bf')),
  NOW(),
  NULL,
  NULL,
  '{"provider": "email", "providers": ["email"]}',
  '{"full_name": "Administrator"}',
  NOW(),
  NOW(),
  '',
  '',
  '',
  ''
) ON CONFLICT (id) DO NOTHING;

-- Dodaj do tabeli administratorów
INSERT INTO public.administrators (id, email, name) VALUES
  ('00000000-0000-0000-0000-000000000001', 'admin@example.com', 'Administrator')
ON CONFLICT (email) DO NOTHING;

-- Komentarz z instrukcjami
COMMENT ON TABLE public.administrators IS 'Tabela administratorów - tylko oni mogą logować się do systemu';
COMMENT ON FUNCTION public.block_user_registration IS 'Blokuje wszystkie próby rejestracji użytkowników';
COMMENT ON FUNCTION public.handle_new_administrator IS 'Sprawdza czy nowy użytkownik jest administratorem';
