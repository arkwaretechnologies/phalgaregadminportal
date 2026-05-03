-- Include new award approval statuses in t-shirt report (keep legacy string for old rows)

drop view if exists public.report_tshirt_size_counts;

create view public.report_tshirt_size_counts as
select
  h.confcode,
  h.status,
  nullif(trim(d.tshirtsize), '') as tshirtsize,
  count(*)::bigint as participant_count
from public.regh h
join public.regd d
  on d.regid = h.regid
where h.status in (
  'APPROVED',
  'PENDING',
  'ACCEPTED',
  'APPROVED PARTICIPANT AND ACCOMPANYING',
  'APPROVED REPRESENTATIVE AND ACCOMPANYING'
)
group by
  h.confcode,
  h.status,
  nullif(trim(d.tshirtsize), '');
