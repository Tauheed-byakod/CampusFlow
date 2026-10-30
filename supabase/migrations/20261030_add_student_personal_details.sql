-- Add personal details to an existing students table without dropping data.
alter table public.students
  add column if not exists gender text,
  add column if not exists date_of_birth date,
  add column if not exists address text;
