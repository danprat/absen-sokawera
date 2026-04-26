select 'face_clients' as table_name, count(*)::int as rows from public.face_clients
union all
select 'face_subjects', count(*)::int from public.face_subjects
union all
select 'face_templates', count(*)::int from public.face_templates
union all
select 'face_embeddings', count(*)::int from public.face_embeddings
order by table_name;

select
  coalesce(fe.tenant_id, 'default') as tenant_id,
  e.id::text as external_subject_id,
  count(fe.id)::int as legacy_face_embeddings,
  count(ft.id)::int as agnostic_face_templates
from public.employees e
left join public.face_embeddings fe
  on fe.employee_id = e.id
left join public.face_subjects fs
  on fs.tenant_id = coalesce(fe.tenant_id, e.tenant_id, 'default')
  and fs.external_subject_id = e.id::text
left join public.face_templates ft
  on ft.tenant_id = fs.tenant_id
  and ft.subject_id = fs.id
group by coalesce(fe.tenant_id, 'default'), e.id
order by e.id;

select
  schemaname,
  tablename,
  rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('face_clients', 'face_subjects', 'face_templates', 'face_embeddings')
order by tablename;
