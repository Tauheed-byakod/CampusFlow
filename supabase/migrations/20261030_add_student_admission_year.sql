-- Store the calendar year in which a student was admitted.
alter table public.students
  add column if not exists admission_year smallint
  check (admission_year between 2020 and 2030);
