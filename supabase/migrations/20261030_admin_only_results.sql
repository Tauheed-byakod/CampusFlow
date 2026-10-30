-- Add remarks and enforce the examination maximum without changing existing result rows.
alter table public.results
  add column if not exists remarks text;

create or replace function public.validate_result_marks()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  exam_max_marks numeric(7, 2);
begin
  select e.max_marks
    into exam_max_marks
    from public.exams as e
    where e.id = new.exam_id;

  if not found or exam_max_marks is null then
    raise exception 'The examination must have maximum marks before results can be entered.'
      using errcode = '23514';
  end if;

  if new.marks < 0 or new.marks > exam_max_marks then
    raise exception 'Result marks must be between zero and the examination maximum marks.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists results_validate_marks on public.results;
create trigger results_validate_marks
  before insert or update of student_id, exam_id, marks
  on public.results
  for each row execute function public.validate_result_marks();

-- The current UI and database should both restrict result entry/editing to Admins.
drop policy if exists results_teacher_insert on public.results;
drop policy if exists results_teacher_update on public.results;
drop policy if exists results_teacher_delete on public.results;
