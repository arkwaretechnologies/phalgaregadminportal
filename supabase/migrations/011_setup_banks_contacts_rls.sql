-- Setup Row Level Security policies for banks and contacts tables
-- We use custom auth (JWT in app), not Supabase Auth.
-- Access control is enforced by the API routes; RLS policies allow the API to read/write.

-- ============================================
-- BANKS TABLE
-- ============================================

-- Enable RLS on banks table
ALTER TABLE public.banks ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Allow select on banks" ON public.banks;
DROP POLICY IF EXISTS "Allow insert on banks" ON public.banks;
DROP POLICY IF EXISTS "Allow update on banks" ON public.banks;
DROP POLICY IF EXISTS "Allow delete on banks" ON public.banks;

-- Allow all SELECT operations (authorization checked in API)
CREATE POLICY "Allow select on banks"
  ON public.banks
  FOR SELECT
  USING (true);

-- Allow all INSERT operations (authorization checked in API)
CREATE POLICY "Allow insert on banks"
  ON public.banks
  FOR INSERT
  WITH CHECK (true);

-- Allow all UPDATE operations (authorization checked in API)
CREATE POLICY "Allow update on banks"
  ON public.banks
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Allow all DELETE operations (authorization checked in API)
CREATE POLICY "Allow delete on banks"
  ON public.banks
  FOR DELETE
  USING (true);

-- ============================================
-- CONTACTS TABLE
-- ============================================

-- Enable RLS on contacts table
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Allow select on contacts" ON public.contacts;
DROP POLICY IF EXISTS "Allow insert on contacts" ON public.contacts;
DROP POLICY IF EXISTS "Allow update on contacts" ON public.contacts;
DROP POLICY IF EXISTS "Allow delete on contacts" ON public.contacts;

-- Allow all SELECT operations (authorization checked in API)
CREATE POLICY "Allow select on contacts"
  ON public.contacts
  FOR SELECT
  USING (true);

-- Allow all INSERT operations (authorization checked in API)
CREATE POLICY "Allow insert on contacts"
  ON public.contacts
  FOR INSERT
  WITH CHECK (true);

-- Allow all UPDATE operations (authorization checked in API)
CREATE POLICY "Allow update on contacts"
  ON public.contacts
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Allow all DELETE operations (authorization checked in API)
CREATE POLICY "Allow delete on contacts"
  ON public.contacts
  FOR DELETE
  USING (true);
