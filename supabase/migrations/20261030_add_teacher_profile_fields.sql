-- Add teacher profile details while preserving existing teacher records.
alter table public.teachers
  add column if not exists gender text,
  add column if not exists date_of_birth date,
  add column if not exists department text,
  add column if not exists designation text,
  add column if not exists qualification text,
  add column if not exists joining_date date,
  add column if not exists address text;
