-- Add default_conference column to users table
-- This stores each user's preferred default conference for pre-selection
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS default_conference varchar(20) NULL 
REFERENCES public.conference(confcode) ON DELETE SET NULL;

-- Create index for the foreign key
CREATE INDEX IF NOT EXISTS idx_users_default_conference ON public.users(default_conference);
