-- 003 Table grants. RLS decides WHICH rows; grants decide table access at all.
-- Without these you get: permission denied for table X (even with correct RLS).

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles     to authenticated;
grant select, insert, update, delete on public.appointments to authenticated;
grant select, insert, update, delete on public.documents    to authenticated;
grant select, insert, update, delete on public.tasks        to authenticated;
