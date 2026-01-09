-- Add status and remarks columns to regh table if they don't exist
-- These columns are needed for the approval/rejection workflow

-- Check and add status column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'regh' 
        AND column_name = 'status'
    ) THEN
        ALTER TABLE public.regh ADD COLUMN status text;
    END IF;
END $$;

-- Check and add remarks column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'regh' 
        AND column_name = 'remarks'
    ) THEN
        ALTER TABLE public.regh ADD COLUMN remarks text;
    END IF;
END $$;

-- Create index on status for better query performance
CREATE INDEX IF NOT EXISTS idx_regh_status ON public.regh USING btree (status);

