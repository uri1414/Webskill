-- ============================================================================
-- 016_task_appointment.sql — link prep tasks to an appointment.
--
-- The tasks table (001) already has title, assignee, status (todo/in_progress/
-- done/blocked), due_at, and client_id — everything the architect's prep-task
-- MVP needs except the appointment link. This adds it so a task belongs to one
-- client AND one appointment, and default prep tasks can be generated per
-- appointment. Staff-only (RLS: tasks_staff), so no policy change.
-- ============================================================================

alter table public.tasks add column if not exists appointment_id uuid
  references public.appointments(id) on delete cascade;

create index if not exists tasks_appointment_idx on public.tasks(appointment_id);
