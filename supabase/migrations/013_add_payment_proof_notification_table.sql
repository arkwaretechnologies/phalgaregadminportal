-- Create upload_notification table to track payment proof uploads and views
-- This table is completely separate from regh/regdep and does NOT modify existing tables

-- Create the notification table
CREATE TABLE IF NOT EXISTS public.upload_notification (
  regid text PRIMARY KEY,
  proof_uploaded_at timestamptz,
  last_viewed_at timestamptz,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW(),
  CONSTRAINT fk_upload_notification_regid 
    FOREIGN KEY (regid) 
    REFERENCES public.regh(regid) 
    ON DELETE CASCADE
);

-- Create index on regid for faster lookups (though it's already the primary key)
CREATE INDEX IF NOT EXISTS idx_upload_notification_regid ON public.upload_notification USING btree (regid);

-- Create index on proof_uploaded_at for querying recent uploads
CREATE INDEX IF NOT EXISTS idx_upload_notification_proof_uploaded_at ON public.upload_notification USING btree (proof_uploaded_at);

-- Enable Row Level Security
ALTER TABLE public.upload_notification ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only admins and reviewers can access (authorization checked in API)
CREATE POLICY "Allow select on upload_notification"
  ON public.upload_notification
  FOR SELECT
  USING (true);

CREATE POLICY "Allow insert on upload_notification"
  ON public.upload_notification
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow update on upload_notification"
  ON public.upload_notification
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Create trigger function to update notification table when payment proof is uploaded
CREATE OR REPLACE FUNCTION fn_update_upload_notification()
RETURNS TRIGGER AS $$
BEGIN
  -- This function ONLY writes to upload_notification table
  -- It NEVER modifies regh or regdep tables
  
  IF TG_TABLE_NAME = 'regh' THEN
    -- Triggered from regh table (BEFORE UPDATE)
    -- Only update if payment_proof_url changed to a non-null, non-empty value
    IF NEW.payment_proof_url IS DISTINCT FROM OLD.payment_proof_url 
       AND NEW.payment_proof_url IS NOT NULL 
       AND NEW.payment_proof_url != '' THEN
      
      INSERT INTO public.upload_notification (regid, proof_uploaded_at, updated_at)
      VALUES (NEW.regid, NOW(), NOW())
      ON CONFLICT (regid) 
      DO UPDATE SET 
        proof_uploaded_at = NOW(),
        updated_at = NOW();
    END IF;
    RETURN NEW;
    
  ELSIF TG_TABLE_NAME = 'regdep' THEN
    -- Triggered from regdep table (AFTER INSERT OR UPDATE)
    -- Only update if payment_proof_url is non-null and non-empty
    IF NEW.payment_proof_url IS NOT NULL AND NEW.payment_proof_url != '' THEN
      
      INSERT INTO public.upload_notification (regid, proof_uploaded_at, updated_at)
      VALUES (NEW.regid, NOW(), NOW())
      ON CONFLICT (regid) 
      DO UPDATE SET 
        proof_uploaded_at = NOW(),
        updated_at = NOW();
    END IF;
    RETURN NEW;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on regh table (BEFORE UPDATE - observes changes, doesn't modify regh)
DROP TRIGGER IF EXISTS tr_regh_proof_notification ON public.regh;
CREATE TRIGGER tr_regh_proof_notification
BEFORE UPDATE ON public.regh
FOR EACH ROW
EXECUTE FUNCTION fn_update_upload_notification();

-- Create trigger on regdep table (AFTER INSERT OR UPDATE - observes changes, doesn't modify regdep)
DROP TRIGGER IF EXISTS tr_regdep_proof_notification ON public.regdep;
CREATE TRIGGER tr_regdep_proof_notification
AFTER INSERT OR UPDATE ON public.regdep
FOR EACH ROW
EXECUTE FUNCTION fn_update_upload_notification();
