-- Include award-conference approval status in t-shirt counts (same participants as APPROVED)

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
where h.status in ('APPROVED', 'PENDING', 'APPROVED PARTICIPANT AND ACCOMPANYING')
group by
  h.confcode,
  h.status,
  nullif(trim(d.tshirtsize), '');
