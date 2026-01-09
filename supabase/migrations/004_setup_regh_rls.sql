-- Setup Row Level Security policies for regh table
-- Allow authenticated users (via API) to update status and remarks

-- Enable RLS on regh table if not already enabled
ALTER TABLE public.regh ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Allow select on regh" ON public.regh;
DROP POLICY IF EXISTS "Allow update on regh" ON public.regh;
DROP POLICY IF EXISTS "Allow insert on regh" ON public.regh;

-- Allow all SELECT operations (since we're using custom auth, not Supabase Auth)
-- Authorization is checked in the application layer
CREATE POLICY "Allow select on regh"
  ON public.regh
  FOR SELECT
  USING (true);

-- Allow all UPDATE operations (authorization checked in API)
CREATE POLICY "Allow update on regh"
  ON public.regh
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Allow all INSERT operations (if needed)
CREATE POLICY "Allow insert on regh"
  ON public.regh
  FOR INSERT
  WITH CHECK (true);

