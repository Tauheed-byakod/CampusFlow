-- CampusFlow college management schema.
-- Safe to re-run: creates objects only when missing and replaces policies/triggers.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text,
  role text not null default 'student'
    check (role in ('admin', 'teacher', 'student')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.teachers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles (id) on delete set null,
  teacher_id text not null unique,
  name text not null,
  email text not null,
  phone text,
  subjects text[] not null default '{}',
  gender text,
  date_of_birth date,
  department text,
  designation text,
  qualification text,
  joining_date date,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  course_code text not null unique,
  department text,
  description text,
  duration text,
  credits smallint check (credits > 0),
  assigned_teacher uuid references public.teachers (id) on delete set null,
  status text not null default 'active'
    check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles (id) on delete set null,
  student_id text not null unique,
  name text not null,
  email text not null,
  phone text,
  gender text,
  date_of_birth date,
  department text not null,
  course_id uuid references public.courses (id) on delete set null,
  course_name text,
  year smallint not null check (year between 1 and 12),
  admission_year smallint check (admission_year between 2020 and 2030),
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, course_id)
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  attendance_date date not null,
  status text not null check (status in ('present', 'absent', 'late', 'excused')),
  marked_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, course_id, attendance_date)
);

create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subject text not null,
  course_id uuid not null references public.courses (id) on delete cascade,
  exam_date date not null,
  exam_type text check (exam_type in ('Internal', 'Midterm', 'Practical', 'Final')),
  start_time time,
  duration_minutes smallint check (duration_minutes > 0),
  max_marks numeric(7, 2) check (max_marks > 0),
  passing_marks numeric(7, 2) check (passing_marks >= 0),
  description text,
  check (passing_marks is null or max_marks is null or passing_marks <= max_marks),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.results (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  exam_id uuid not null references public.exams (id) on delete cascade,
  marks numeric(7, 2) not null check (marks >= 0),
  grade text not null,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, exam_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  message text not null,
  notification_type text not null default 'general',
  is_read boolean not null default false,
  link text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_email_lower_uidx
  on public.profiles (lower(email))
  where email is not null;
create unique index if not exists teachers_email_lower_uidx
  on public.teachers (lower(email));
create unique index if not exists students_email_lower_uidx
  on public.students (lower(email));
create index if not exists teachers_profile_id_idx on public.teachers (profile_id);
create index if not exists courses_assigned_teacher_idx on public.courses (assigned_teacher);
create index if not exists courses_department_idx on public.courses (department);
create index if not exists courses_status_idx on public.courses (status);
create index if not exists students_profile_id_idx on public.students (profile_id);
create index if not exists students_course_id_idx on public.students (course_id);
create index if not exists students_department_idx on public.students (department);
create index if not exists enrollments_course_student_idx on public.enrollments (course_id, student_id);
create index if not exists attendance_student_date_idx on public.attendance (student_id, attendance_date desc);
create index if not exists attendance_course_date_idx on public.attendance (course_id, attendance_date desc);
create index if not exists exams_course_date_idx on public.exams (course_id, exam_date);
create index if not exists exams_exam_date_idx on public.exams (exam_date);
create index if not exists exams_exam_type_idx on public.exams (exam_type);
create index if not exists results_exam_id_idx on public.results (exam_id);
create index if not exists notifications_user_created_idx on public.notifications (user_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

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

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
drop trigger if exists teachers_set_updated_at on public.teachers;
create trigger teachers_set_updated_at before update on public.teachers
  for each row execute function public.set_updated_at();
drop trigger if exists courses_set_updated_at on public.courses;
create trigger courses_set_updated_at before update on public.courses
  for each row execute function public.set_updated_at();
drop trigger if exists students_set_updated_at on public.students;
create trigger students_set_updated_at before update on public.students
  for each row execute function public.set_updated_at();
drop trigger if exists enrollments_set_updated_at on public.enrollments;
create trigger enrollments_set_updated_at before update on public.enrollments
  for each row execute function public.set_updated_at();
drop trigger if exists attendance_set_updated_at on public.attendance;
create trigger attendance_set_updated_at before update on public.attendance
  for each row execute function public.set_updated_at();
drop trigger if exists exams_set_updated_at on public.exams;
create trigger exams_set_updated_at before update on public.exams
  for each row execute function public.set_updated_at();
drop trigger if exists results_set_updated_at on public.results;
create trigger results_set_updated_at before update on public.results
  for each row execute function public.set_updated_at();
drop trigger if exists results_validate_marks on public.results;
create trigger results_validate_marks
  before insert or update of student_id, exam_id, marks
  on public.results
  for each row execute function public.validate_result_marks();
drop trigger if exists notifications_set_updated_at on public.notifications;
create trigger notifications_set_updated_at before update on public.notifications
  for each row execute function public.set_updated_at();

-- A new Auth account always receives the least-privileged role.
-- User-supplied Auth metadata is intentionally never used to assign a role.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email,
    'student'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- These SECURITY DEFINER helpers avoid recursive RLS checks when policies
-- inspect membership in related tables. They return only role/membership data.
create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles as p
  where p.id = (select auth.uid())
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_app_role() = 'admin', false)
$$;

create or replace function public.is_teacher()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_app_role() = 'teacher', false)
$$;

create or replace function public.is_own_student(target_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.students as s
    where s.id = target_student_id
      and s.profile_id = (select auth.uid())
  )
$$;

create or replace function public.is_course_teacher(target_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.courses as c
    join public.teachers as t on t.id = c.assigned_teacher
    where c.id = target_course_id
      and t.profile_id = (select auth.uid())
  )
$$;

create or replace function public.is_student_enrolled(target_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.enrollments as e
    join public.students as s on s.id = e.student_id
    where e.course_id = target_course_id
      and s.profile_id = (select auth.uid())
  )
$$;

create or replace function public.is_course_student(
  target_student_id uuid,
  target_course_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.enrollments as e
    where e.student_id = target_student_id
      and e.course_id = target_course_id
  )
$$;

create or replace function public.can_access_student(target_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_own_student(target_student_id)
    or exists (
      select 1
      from public.enrollments as e
      join public.courses as c on c.id = e.course_id
      join public.teachers as t on t.id = c.assigned_teacher
      where e.student_id = target_student_id
        and t.profile_id = (select auth.uid())
    )
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
revoke all on function public.current_app_role() from public, anon;
revoke all on function public.is_admin() from public, anon;
revoke all on function public.is_teacher() from public, anon;
revoke all on function public.is_own_student(uuid) from public, anon;
revoke all on function public.is_course_teacher(uuid) from public, anon;
revoke all on function public.is_student_enrolled(uuid) from public, anon;
revoke all on function public.is_course_student(uuid, uuid) from public, anon;
revoke all on function public.can_access_student(uuid) from public, anon;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_teacher() to authenticated;
grant execute on function public.is_own_student(uuid) to authenticated;
grant execute on function public.is_course_teacher(uuid) to authenticated;
grant execute on function public.is_student_enrolled(uuid) to authenticated;
grant execute on function public.is_course_student(uuid, uuid) to authenticated;
grant execute on function public.can_access_student(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.teachers enable row level security;
alter table public.courses enable row level security;
alter table public.enrollments enable row level security;
alter table public.attendance enable row level security;
alter table public.exams enable row level security;
alter table public.results enable row level security;
alter table public.notifications enable row level security;

-- Profiles: users can read/update their own profile, but its role must remain
-- unchanged. Only an existing Admin can manage other profiles and assign roles.
drop policy if exists profiles_select_self_or_admin on public.profiles;
create policy profiles_select_self_or_admin on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists profiles_insert_admin on public.profiles;
create policy profiles_insert_admin on public.profiles
  for insert to authenticated
  with check ((select public.is_admin()));
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (
    id = (select auth.uid())
    and role = (select public.current_app_role())
  );
drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Students: a student sees their own row; a teacher sees students enrolled
-- in courses they teach. Only Admins create, change, or delete student records.
drop policy if exists students_select_authorized on public.students;
create policy students_select_authorized on public.students
  for select to authenticated
  using (
    (select public.is_admin())
    or (select public.can_access_student(id))
  );
drop policy if exists students_admin_insert on public.students;
create policy students_admin_insert on public.students
  for insert to authenticated
  with check ((select public.is_admin()));
drop policy if exists students_admin_update on public.students;
create policy students_admin_update on public.students
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
drop policy if exists students_admin_delete on public.students;
create policy students_admin_delete on public.students
  for delete to authenticated
  using ((select public.is_admin()));

-- Teachers can read their own directory record; Admins manage the directory.
drop policy if exists teachers_select_self_or_admin on public.teachers;
create policy teachers_select_self_or_admin on public.teachers
  for select to authenticated
  using (
    (select public.is_admin())
    or profile_id = (select auth.uid())
  );
drop policy if exists teachers_admin_insert on public.teachers;
create policy teachers_admin_insert on public.teachers
  for insert to authenticated
  with check ((select public.is_admin()));
drop policy if exists teachers_admin_update on public.teachers;
create policy teachers_admin_update on public.teachers
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
drop policy if exists teachers_admin_delete on public.teachers;
create policy teachers_admin_delete on public.teachers
  for delete to authenticated
  using ((select public.is_admin()));

-- Courses are visible to Admins, assigned Teachers, and enrolled Students.
-- Only Admins manage course records or change teacher assignments.
drop policy if exists courses_select_authorized on public.courses;
create policy courses_select_authorized on public.courses
  for select to authenticated
  using (
    (select public.is_admin())
    or (select public.is_course_teacher(id))
    or (select public.is_student_enrolled(id))
  );
drop policy if exists courses_admin_insert on public.courses;
create policy courses_admin_insert on public.courses
  for insert to authenticated
  with check ((select public.is_admin()));
drop policy if exists courses_admin_update on public.courses;
create policy courses_admin_update on public.courses
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
drop policy if exists courses_admin_delete on public.courses;
create policy courses_admin_delete on public.courses
  for delete to authenticated
  using ((select public.is_admin()));

-- Enrollment relationships are readable only by the involved student,
-- the course's assigned teacher, or an Admin. Admins manage enrollment.
drop policy if exists enrollments_select_authorized on public.enrollments;
create policy enrollments_select_authorized on public.enrollments
  for select to authenticated
  using (
    (select public.is_admin())
    or (select public.is_own_student(student_id))
    or (select public.is_course_teacher(course_id))
  );
drop policy if exists enrollments_admin_insert on public.enrollments;
create policy enrollments_admin_insert on public.enrollments
  for insert to authenticated
  with check ((select public.is_admin()));
drop policy if exists enrollments_admin_update on public.enrollments;
create policy enrollments_admin_update on public.enrollments
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
drop policy if exists enrollments_admin_delete on public.enrollments;
create policy enrollments_admin_delete on public.enrollments
  for delete to authenticated
  using ((select public.is_admin()));

-- Teachers may record attendance for their assigned courses. Students can
-- only read their own attendance; Admins have full access.
drop policy if exists attendance_select_authorized on public.attendance;
create policy attendance_select_authorized on public.attendance
  for select to authenticated
  using (
    (select public.is_admin())
    or (select public.is_own_student(student_id))
    or (select public.is_course_teacher(course_id))
  );
drop policy if exists attendance_admin_insert on public.attendance;
create policy attendance_admin_insert on public.attendance
  for insert to authenticated
  with check ((select public.is_admin()));
drop policy if exists attendance_teacher_insert on public.attendance;
create policy attendance_teacher_insert on public.attendance
  for insert to authenticated
  with check (
    (select public.is_course_teacher(course_id))
    and (select public.is_course_student(student_id, course_id))
    and marked_by = (select auth.uid())
  );
drop policy if exists attendance_admin_update on public.attendance;
create policy attendance_admin_update on public.attendance
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
drop policy if exists attendance_teacher_update on public.attendance;
create policy attendance_teacher_update on public.attendance
  for update to authenticated
  using ((select public.is_course_teacher(course_id)))
  with check (
    (select public.is_course_teacher(course_id))
    and (select public.is_course_student(student_id, course_id))
    and marked_by = (select auth.uid())
  );
drop policy if exists attendance_admin_delete on public.attendance;
create policy attendance_admin_delete on public.attendance
  for delete to authenticated
  using ((select public.is_admin()));

-- Students read exams for courses in which they are enrolled. Assigned
-- Teachers manage their own course exams; Admins manage all exams.
drop policy if exists exams_select_authorized on public.exams;
create policy exams_select_authorized on public.exams
  for select to authenticated
  using (
    (select public.is_admin())
    or (select public.is_course_teacher(course_id))
    or (select public.is_student_enrolled(course_id))
  );
drop policy if exists exams_admin_insert on public.exams;
create policy exams_admin_insert on public.exams
  for insert to authenticated
  with check ((select public.is_admin()));
drop policy if exists exams_teacher_insert on public.exams;
create policy exams_teacher_insert on public.exams
  for insert to authenticated
  with check ((select public.is_course_teacher(course_id)));
drop policy if exists exams_admin_update on public.exams;
create policy exams_admin_update on public.exams
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
drop policy if exists exams_teacher_update on public.exams;
create policy exams_teacher_update on public.exams
  for update to authenticated
  using ((select public.is_course_teacher(course_id)))
  with check ((select public.is_course_teacher(course_id)));
drop policy if exists exams_admin_delete on public.exams;
create policy exams_admin_delete on public.exams
  for delete to authenticated
  using ((select public.is_admin()));
drop policy if exists exams_teacher_delete on public.exams;
create policy exams_teacher_delete on public.exams
  for delete to authenticated
  using ((select public.is_course_teacher(course_id)));

-- Students read only their own results. Assigned Teachers can read results
-- for enrolled students in their courses; only Admins can modify results.
drop policy if exists results_select_authorized on public.results;
create policy results_select_authorized on public.results
  for select to authenticated
  using (
    (select public.is_admin())
    or (select public.is_own_student(student_id))
    or exists (
      select 1
      from public.exams as e
      where e.id = exam_id
        and (select public.is_course_teacher(e.course_id))
        and (select public.is_course_student(student_id, e.course_id))
    )
  );
drop policy if exists results_admin_insert on public.results;
create policy results_admin_insert on public.results
  for insert to authenticated
  with check ((select public.is_admin()));
drop policy if exists results_teacher_insert on public.results;
drop policy if exists results_admin_update on public.results;
create policy results_admin_update on public.results
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
drop policy if exists results_teacher_update on public.results;
drop policy if exists results_admin_delete on public.results;
create policy results_admin_delete on public.results
  for delete to authenticated
  using ((select public.is_admin()));
drop policy if exists results_teacher_delete on public.results;
-- Users can read and mark their own notifications as read. Only Admins
-- create/delete notifications; recipients cannot change their content/owner.
drop policy if exists notifications_select_recipient_or_admin on public.notifications;
create policy notifications_select_recipient_or_admin on public.notifications
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists notifications_admin_insert on public.notifications;
create policy notifications_admin_insert on public.notifications
  for insert to authenticated
  with check ((select public.is_admin()));
drop policy if exists notifications_update_recipient_or_admin on public.notifications;
create policy notifications_update_recipient_or_admin on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()))
  with check (user_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists notifications_admin_delete on public.notifications;
create policy notifications_admin_delete on public.notifications
  for delete to authenticated
  using ((select public.is_admin()));
drop policy if exists notifications_delete_own on public.notifications;
create policy notifications_delete_own on public.notifications
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- Supabase's anon role gets no table access. Authenticated users get only
-- the SQL privileges needed by the RLS-governed policies below.
revoke all on public.profiles, public.students, public.teachers, public.courses,
  public.enrollments, public.attendance, public.exams, public.results,
  public.notifications from anon, authenticated;

grant select, insert, update, delete on public.profiles, public.students,
  public.teachers, public.courses, public.enrollments, public.attendance,
  public.exams, public.results to authenticated;
grant select, insert, delete on public.notifications to authenticated;
grant update (is_read) on public.notifications to authenticated;

-- Bootstrap the first Admin from the trusted Supabase SQL Editor only.
-- Create the Auth user in the Supabase Dashboard first, then run this once,
-- replacing the email with that user's actual account:
-- update public.profiles set role = 'admin' where email = 'admin@college.edu';
