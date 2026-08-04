-- ============================================================================
-- 004_storage.sql — private, per-tenant document bucket.
--
-- Path convention (REQUIRED):  documents/<org_id>/<client_id>/<uuid>-<filename>
--   segment 1 = org_id   -> tenant isolation, enforced by membership
--   segment 2 = client_id -> client self-service
-- The bucket is PRIVATE; files are served only through short-lived signed URLs.
-- Because isolation keys off the path, the app MUST build paths to this shape.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- Staff: any file within an org they staff.
create policy "documents staff all"
  on storage.objects for all
  using (
    bucket_id = 'documents'
    and public.is_staff( ((storage.foldername(name))[1])::uuid )
  )
  with check (
    bucket_id = 'documents'
    and public.is_staff( ((storage.foldername(name))[1])::uuid )
  );

-- Client: read + upload only within their own org/client folder.
create policy "documents client read"
  on storage.objects for select
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[2] = public.my_client_id( ((storage.foldername(name))[1])::uuid )::text
  );

create policy "documents client upload"
  on storage.objects for insert
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[2] = public.my_client_id( ((storage.foldername(name))[1])::uuid )::text
  );
