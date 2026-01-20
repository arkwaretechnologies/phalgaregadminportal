-- Fix upload_notification triggers so approvals (updates on regh) do not fail.
-- Root cause: regh table does not have payment_proof_url, but the trigger function referenced NEW.payment_proof_url
-- when attached to regh, causing: record "new" has no field "payment_proof_url" (Code: 42703)
--
-- This migration:
-- 1) Drops the regh trigger (notifications are driven by regdep uploads)
-- 2) Replaces the trigger function with a regdep-only version
-- 3) Recreates the regdep trigger

-- Drop the trigger on regh (it is unsafe because regh has no payment_proof_url column)
DROP TRIGGER IF EXISTS tr_regh_proof_notification ON public.regh;

-- Replace function: only handle regdep table
CREATE OR REPLACE FUNCTION fn_update_upload_notification()
RETURNS TRIGGER AS $$
BEGIN
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
END;
$$ LANGUAGE plpgsql;

-- Ensure regdep trigger exists and points to the corrected function
DROP TRIGGER IF EXISTS tr_regdep_proof_notification ON public.regdep;
CREATE TRIGGER tr_regdep_proof_notification
AFTER INSERT OR UPDATE ON public.regdep
FOR EACH ROW
EXECUTE FUNCTION fn_update_upload_notification();

