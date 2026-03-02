-- Extend t-shirt size report view to include status (APPROVED, PENDING)
-- Enables filtering by participant status in the report
-- Must DROP first because adding a column in the middle changes positions

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
where h.status in ('APPROVED', 'PENDING')
group by
  h.confcode,
  h.status,
  nullif(trim(d.tshirtsize), '');
