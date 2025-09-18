-- Usuń wszystkie istniejące polityki RLS
DROP POLICY IF EXISTS "admin_select_policy" ON public.administrators;
DROP POLICY IF EXISTS "admin_insert_policy" ON public.administrators;
DROP POLICY IF EXISTS "admin_update_policy" ON public.administrators;
DROP POLICY IF EXISTS "admin_delete_policy" ON public.administrators;
DROP POLICY IF EXISTS "Administrators can view all administrators" ON public.administrators;
DROP POLICY IF EXISTS "Administrators can insert administrators" ON public.administrators;
DROP POLICY IF EXISTS "Administrators can update administrators" ON public.administrators;
DROP POLICY IF EXISTS "Administrators can delete administrators" ON public.administrators;

-- Utwórz nowe, proste polityki RLS
CREATE POLICY "admin_select_policy" ON public.administrators
    FOR SELECT
    USING (true);

CREATE POLICY "admin_insert_policy" ON public.administrators
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "admin_update_policy" ON public.administrators
    FOR UPDATE
    USING (true);

CREATE POLICY "admin_delete_policy" ON public.administrators
    FOR DELETE
    USING (true);
