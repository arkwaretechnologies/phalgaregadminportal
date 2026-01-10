-- Setup Row Level Security policies for config table
-- We use custom auth (JWT in app), not Supabase Auth.
-- Access control is enforced by the API routes; RLS policies allow the API to read/write.

-- Enable RLS on config table
ALTER TABLE public.config ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Allow select on config" ON public.config;
DROP POLICY IF EXISTS "Allow update on config" ON public.config;
DROP POLICY IF EXISTS "Allow insert on config" ON public.config;

-- Allow all SELECT operations (authorization checked in API)
CREATE POLICY "Allow select on config"
  ON public.config
  FOR SELECT
  USING (true);

-- Allow all UPDATE operations (authorization checked in API)
CREATE POLICY "Allow update on config"
  ON public.config
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Allow all INSERT operations (needed for upsert; authorization checked in API)
CREATE POLICY "Allow insert on config"
  ON public.config
  FOR INSERT
  WITH CHECK (true);

