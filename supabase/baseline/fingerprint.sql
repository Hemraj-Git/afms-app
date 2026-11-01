-- Fingerprint of the app's database structure: one hash per part. Run it on
-- SoMS and on a new client's database; equal hashes mean the same schema.
-- Read-only. Shows the part names that differ when compared side by side.
with parts(part, item) as (
  select 'columns', c.relname || '.' || a.attname || ' ' || format_type(a.atttypid, a.atttypmod)
         || coalesce(' default ' || pg_get_expr(d.adbin, d.adrelid), '') || case when a.attnotnull then ' not null' else '' end
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
  left join pg_attrdef d on d.adrelid = c.oid and d.adnum = a.attnum
  where n.nspname = 'public' and c.relkind = 'r'
  union all
  select 'constraints', c.relname || ' ' || co.conname || ' ' || pg_get_constraintdef(co.oid)
  from pg_constraint co join pg_class c on c.oid = co.conrelid join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
  union all
  select 'indexes', indexdef from pg_indexes where schemaname = 'public'
  union all
  -- Line endings ignored: some SoMS functions were applied from Windows files.
  select 'functions', replace(pg_get_functiondef(p.oid), E'\r', '')
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
  union all
  select 'function_grants', p.proname || ' ' || case when e.grantee = 0 then 'PUBLIC' else pg_get_userbyid(e.grantee) end || ' ' || e.privilege_type
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) e
  where n.nspname = 'public'
  union all
  select 'table_grants', c.relname || ' ' || g.grantee || ' ' || g.privilege_type
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  cross join lateral (select pg_get_userbyid(e.grantee) grantee, e.privilege_type from aclexplode(c.relacl) e) g
  where n.nspname = 'public' and c.relkind in ('r', 'S') and g.grantee in ('anon', 'authenticated', 'service_role')
  union all
  select 'triggers', c.relname || ' ' || pg_get_triggerdef(t.oid)
  from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
  where not t.tgisinternal and n.nspname in ('public', 'auth')
  union all
  select 'rls', c.relname || ' ' || c.relrowsecurity
  from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r'
  union all
  select 'policies', schemaname || '.' || tablename || ' ' || policyname || ' ' || cmd || ' ' || roles::text
         || ' ' || coalesce(qual, '') || ' ' || coalesce(with_check, '')
  from pg_policies where schemaname in ('public', 'storage')
  union all
  select 'sequences', sequencename || ' ' || start_value || ' ' || increment_by from pg_sequences where schemaname = 'public'
  union all
  select 'buckets', id || ' ' || public || ' ' || coalesce(file_size_limit::text, '') || ' ' || coalesce(allowed_mime_types::text, '')
  from storage.buckets
  union all
  select 'realtime', tablename from pg_publication_tables where pubname = 'supabase_realtime'
  union all
  select 'cron', jobname || ' ' || schedule || ' ' || command from cron.job
)
select part, count(*) as items, md5(string_agg(item, E'\n' order by item)) as hash
from parts group by part order by part;
