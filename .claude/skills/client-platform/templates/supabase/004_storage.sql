-- 004 Storage: one private bucket for client uploads, scoped per user folder.
-- Files are stored under /{auth.uid()}/... so the policy matches the first folder.

insert into storage.buckets (id, name, public) values ('uploads','uploads',false)
on conflict (id) do nothing;

drop policy if exists uploads_insert_own on storage.objects;
create policy uploads_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists uploads_read_own on storage.objects;
create policy uploads_read_own on storage.objects for select to authenticated
  using (bucket_id = 'uploads' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff()));

drop policy if exists uploads_delete_own on storage.objects;
create policy uploads_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text);
