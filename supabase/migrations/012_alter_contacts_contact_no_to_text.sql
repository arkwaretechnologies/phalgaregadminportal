-- Change contact_no from integer to text
-- Phone numbers should be stored as text to preserve leading zeros and handle large values

ALTER TABLE public.contacts 
  ALTER COLUMN contact_no TYPE text 
  USING contact_no::text;
