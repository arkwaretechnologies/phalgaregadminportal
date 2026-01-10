-- Setup Row Level Security policies for conference table
-- We use custom auth (JWT in app), not Supabase Auth.
-- Access control is enforced by the API routes; RLS policies allow the API to read/write.

-- Enable RLS on conference table
ALTER TABLE public.conference ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Allow select on conference" ON public.conference;
DROP POLICY IF EXISTS "Allow update on conference" ON public.conference;
DROP POLICY IF EXISTS "Allow insert on conference" ON public.conference;
DROP POLICY IF EXISTS "Allow delete on conference" ON public.conference;

-- Allow all SELECT operations (authorization checked in API)
CREATE POLICY "Allow select on conference"
  ON public.conference
  FOR SELECT
  USING (true);

-- Allow all UPDATE operations (authorization checked in API)
CREATE POLICY "Allow update on conference"
  ON public.conference
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Allow all INSERT operations (authorization checked in API)
CREATE POLICY "Allow insert on conference"
  ON public.conference
  FOR INSERT
  WITH CHECK (true);

-- Allow all DELETE operations (authorization checked in API)
CREATE POLICY "Allow delete on conference"
  ON public.conference
  FOR DELETE
  USING (true);
