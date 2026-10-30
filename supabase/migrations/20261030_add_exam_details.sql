-- Add examination scheduling details while preserving existing exam rows.
alter table public.exams
  add column if not exists exam_type text
    check (exam_type in ('Internal', 'Midterm', 'Practical', 'Final')),
  add column if not exists start_time time,
  add column if not exists duration_minutes smallint
    check (duration_minutes > 0),
  add column if not exists max_marks numeric(7, 2)
    check (max_marks > 0),
  add column if not exists passing_marks numeric(7, 2)
    check (passing_marks >= 0),
  add column if not exists description text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'exams_passing_marks_within_max'
      and conrelid = 'public.exams'::regclass
  ) then
    alter table public.exams
      add constraint exams_passing_marks_within_max
      check (passing_marks is null or max_marks is null or passing_marks <= max_marks);
  end if;
end;
$$;

create index if not exists exams_exam_date_idx on public.exams (exam_date);
create index if not exists exams_exam_type_idx on public.exams (exam_type);
