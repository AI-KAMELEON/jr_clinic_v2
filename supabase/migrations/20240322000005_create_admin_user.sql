-- Dodaj pierwszego administratora
-- Zastąp 'admin@example.com' swoim emailem

INSERT INTO public.administrators (id, email, name) VALUES
  ('00000000-0000-0000-0000-000000000001', 'admin@example.com', 'Administrator')
ON CONFLICT (email) DO NOTHING;

-- Dodaj komentarz z instrukcjami
COMMENT ON TABLE public.administrators IS 'Tabela administratorów - tylko oni mogą logować się do systemu';
COMMENT ON FUNCTION public.block_user_registration IS 'Blokuje wszystkie próby rejestracji użytkowników';
COMMENT ON FUNCTION public.handle_new_administrator IS 'Sprawdza czy nowy użytkownik jest administratorem';
