-- Report view: count of t-shirt sizes per conference (approved registrations only)
-- Source tables:
-- - regh: registration header (status, confcode, regid)
-- - regd: participant detail rows (tshirtsize, regid)

create or replace view public.report_tshirt_size_counts as
select
  h.confcode,
  nullif(trim(d.tshirtsize), '') as tshirtsize,
  count(*)::bigint as participant_count
from public.regh h
join public.regd d
  on d.regid = h.regid
where h.status = 'APPROVED'
group by
  h.confcode,
  nullif(trim(d.tshirtsize), '');

