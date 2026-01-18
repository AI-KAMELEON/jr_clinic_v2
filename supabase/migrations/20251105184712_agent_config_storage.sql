-- Create Storage bucket for agent configuration
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'agent-config',
  'agent-config',
  false,
  5242880,
  ARRAY['text/markdown', 'text/plain']
)
ON CONFLICT (id) DO NOTHING;

-- RLS Policy: Admins can read agent config files
CREATE POLICY "Admins can read agent config files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'agent-config' AND
  EXISTS (
    SELECT 1
    FROM "public"."administrators"
    WHERE "administrators"."email" = (auth.jwt() ->> 'email'::text)
  )
);

-- RLS Policy: Admins can upload agent config files
CREATE POLICY "Admins can upload agent config files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'agent-config' AND
  EXISTS (
    SELECT 1
    FROM "public"."administrators"
    WHERE "administrators"."email" = (auth.jwt() ->> 'email'::text)
  )
);

-- RLS Policy: Admins can update agent config files
CREATE POLICY "Admins can update agent config files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'agent-config' AND
  EXISTS (
    SELECT 1
    FROM "public"."administrators"
    WHERE "administrators"."email" = (auth.jwt() ->> 'email'::text)
  )
);

-- RLS Policy: Admins can delete agent config files
CREATE POLICY "Admins can delete agent config files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'agent-config' AND
  EXISTS (
    SELECT 1
    FROM "public"."administrators"
    WHERE "administrators"."email" = (auth.jwt() ->> 'email'::text)
  )
);

-- Service role full access (for Edge Functions)
CREATE POLICY "Service role full access to agent-config storage"
ON storage.objects
TO "service_role"
USING (bucket_id = 'agent-config')
WITH CHECK (bucket_id = 'agent-config');

