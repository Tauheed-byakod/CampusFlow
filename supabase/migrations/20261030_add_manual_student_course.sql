-- Store an unregistered course name without creating a courses row.
alter table public.students
  add column if not exists course_name text;
