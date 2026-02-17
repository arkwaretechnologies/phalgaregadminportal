-- Setup Row Level Security for existing lgu_count_limit table
-- Used by the Settings > LGU Limits feature

-- Enable RLS if not already enabled
ALTER TABLE public.lgu_count_limit ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow select on lgu_count_limit" ON public.lgu_count_limit;
DROP POLICY IF EXISTS "Allow insert on lgu_count_limit" ON public.lgu_count_limit;
DROP POLICY IF EXISTS "Allow update on lgu_count_limit" ON public.lgu_count_limit;
DROP POLICY IF EXISTS "Allow delete on lgu_count_limit" ON public.lgu_count_limit;

-- Permissive policies - authorization is enforced in API routes (admin-only)
CREATE POLICY "Allow select on lgu_count_limit"
  ON public.lgu_count_limit
  FOR SELECT
  USING (true);

CREATE POLICY "Allow insert on lgu_count_limit"
  ON public.lgu_count_limit
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow update on lgu_count_limit"
  ON public.lgu_count_limit
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow delete on lgu_count_limit"
  ON public.lgu_count_limit
  FOR DELETE
  USING (true);
