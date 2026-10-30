-- Add course catalog fields without changing existing course records.
alter table public.courses
  add column if not exists department text,
  add column if not exists duration text,
  add column if not exists credits smallint check (credits > 0),
  add column if not exists status text not null default 'active'
    check (status in ('active', 'inactive'));

create index if not exists courses_department_idx on public.courses (department);
create index if not exists courses_status_idx on public.courses (status);
