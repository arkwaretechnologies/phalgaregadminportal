-- Setup Row Level Security policies for regd table
-- Allow authenticated users (via API) to perform CRUD operations on participants

-- Enable RLS on regd table if not already enabled
ALTER TABLE public.regd ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Allow select on regd" ON public.regd;
DROP POLICY IF EXISTS "Allow update on regd" ON public.regd;
DROP POLICY IF EXISTS "Allow insert on regd" ON public.regd;
DROP POLICY IF EXISTS "Allow delete on regd" ON public.regd;

-- Allow all SELECT operations (since we're using custom auth, not Supabase Auth)
-- Authorization is checked in the application layer
CREATE POLICY "Allow select on regd"
  ON public.regd
  FOR SELECT
  USING (true);

-- Allow all UPDATE operations (authorization checked in API)
CREATE POLICY "Allow update on regd"
  ON public.regd
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Allow all INSERT operations (authorization checked in API)
CREATE POLICY "Allow insert on regd"
  ON public.regd
  FOR INSERT
  WITH CHECK (true);

-- Allow all DELETE operations (authorization checked in API)
CREATE POLICY "Allow delete on regd"
  ON public.regd
  FOR DELETE
  USING (true);
