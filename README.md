# CampusFlow College Management

A responsive college administration frontend built with React, Vite, Tailwind CSS, React Router, Lucide icons, and Recharts. Student, teacher, course, attendance, examination and results records use Supabase.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite and sign in with an account created in your Supabase project's **Authentication → Users** page. Student management requires an account whose `profiles.role` is `admin`.

## Pages and interactions

- **Dashboard:** paginated Supabase student, teacher and course totals, daily attendance rate, upcoming examinations, dated enrollment charts, and recent notifications visible under the signed-in user's RLS policies.
- **Students:** search and filter Supabase records, add/edit/delete records as an Admin, inspect student profiles, and export CSV.
- **Teachers:** Supabase-backed faculty directory with Admin-only add/edit/delete, profile details, department/designation filters, search, and CSV export.
- **Courses:** Supabase-backed catalog with Admin-only add/edit/delete, teacher assignments, course statistics, department/duration filters, search, and CSV export.
- **Examinations:** Supabase-backed schedule with Admin and assigned-Teacher CRUD, course/department/type/status filters, validation, examination statistics, and CSV export.
- **Attendance:** mark present/absent/late/excused by course and date, mark all present, update existing records, filter/search, and export date-wise or student-wise reports.
- **Results:** enter and update marks for course students, calculate percentages/grades/pass status, search and filter records, and print individual student reports.
- **Settings:** edit the admin profile and toggle notification preferences.
- **Login:** Supabase Auth sign-in and sign-out.

Student, teacher, course, attendance, examination and results records are loaded from Supabase under the signed-in user's Row Level Security policies. Local storage is used for workspace preferences and configurable result grading thresholds, not student result records.

## Validate

```bash
npm run lint
npm run build
```

## Supabase setup

The Supabase client is available at `src/lib/supabaseClient.js`. Create `.env.local` in the project root with:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
```

Use the project's **publishable** key (or legacy `anon` key), never a `service_role`/secret key in a Vite variable. The client validates these values when imported. `.env.local` is ignored by Git; restart Vite after changing it.

To create the database objects:

1. Open your project in the Supabase Dashboard and go to **SQL Editor**.
2. Open `supabase/schema.sql`, copy the full file into a new SQL query, and run it.
3. In **Authentication → Users**, create the first administrator's Auth account.
4. In SQL Editor, promote that account from the default `student` role by running the commented bootstrap `UPDATE` at the bottom of `schema.sql` with the account's email. Only a trusted project owner should run this step. Thereafter, Admins can assign roles through the RLS-protected profiles table.
5. In **Table Editor**, confirm the tables were created and RLS is enabled.

The schema creates a profile with the `student` role for each new Auth user. Users cannot change their own role; an existing Admin or a trusted project owner must assign `teacher` or `admin`.

The Students page reads and writes `public.students` directly through the publishable-key client. The app does not execute SQL or bypass RLS. Admins can add/edit/delete; other roles see only the rows permitted by the schema and have read-only controls.

The Add Student form stores `gender`, `date_of_birth`, `address`, `course_name`, and `admission_year` in additional nullable columns. For an existing database, run the applicable `supabase/migrations/*.sql` files in the Supabase SQL Editor, including `20261030_add_student_admission_year.sql` for the admission-year field. These migrations only add missing columns and do not recreate or delete tables or records. Registered courses continue to use `course_id`; manually entered course names are stored in `course_name` without creating a course row. `year` remains the student's year of study; `admission_year` stores the admission calendar year.

The Teachers page uses the existing `teacher_id`, `name`, `email`, `phone`, and `subjects` columns. For an existing database, run `supabase/migrations/20261030_add_teacher_profile_fields.sql` once in SQL Editor to add the nullable profile fields used for gender, dates, department, designation, qualification, and address. Teacher salary is not supported by the current database schema and is not included.

The Courses page uses `public.courses` and its existing foreign key from `assigned_teacher` to `teachers.id`. For an existing database, run `supabase/migrations/20261030_add_course_catalog_details.sql` in SQL Editor to add the nullable department, duration and credit fields, plus the active/inactive status field. It preserves existing course rows and does not change the existing Admin-only course RLS policies. New and edited course forms require a code, name, department, duration and positive whole-number credits; teacher assignment and description are optional. Deleting a course may cascade to enrollments, attendance, examinations and their results, so the confirmation dialog warns before deletion.

Attendance uses the existing `attendance`, `enrollments`, `students`, and `courses` tables and their declared foreign keys. Its unique `(student_id, course_id, attendance_date)` constraint is used for idempotent upserts, so saving an existing date updates that row rather than adding a duplicate. The attendance schema and RLS are already present in `supabase/schema.sql`; no additional migration is needed. Admins can manage attendance. Existing policies also allow a Teacher to mark attendance only for enrolled students in their assigned courses, with `marked_by` set to the signed-in user. Students retain read-only access to their own records.

Examinations use `public.exams.course_id` referencing `courses.id`; department is derived from the associated course rather than stored twice. The existing table already includes name, subject and exam date. For an existing database, manually apply `supabase/migrations/20261030_add_exam_details.sql` in the SQL Editor to add type, start time, duration, marks, and description. The migration is additive and preserves existing exam rows. Its new columns remain nullable for legacy records, while the app requires all scheduling and grading fields on new/edited records. Existing RLS allows Admins to manage all exams and assigned Teachers to manage exams for their courses; the UI follows these policies. Students can only view exams allowed by their enrollment.

Results use the existing `results` table and its unique `(student_id, exam_id)` constraint. The Results page loads records from Supabase, derives course information through `exams.course_id`, and finds students through both `students.course_id` and `enrollments`. Percentage and pass/fail status are calculated from each exam's `max_marks` and `passing_marks`; grade thresholds are configurable and saved in this browser. The existing table has no `remarks` column, and the original RLS also allowed assigned Teachers to write/delete results. For an existing database, manually apply `supabase/migrations/20261030_admin_only_results.sql` in the Supabase SQL Editor. It adds nullable remarks, installs a database-level maximum-marks check, and removes Teacher result write policies while preserving authorized result reads and Admin policies. New installations should use the updated `supabase/schema.sql`. No migration is run by the application.

### Test results management

1. If your live `exams` table does not yet have `max_marks` and `passing_marks`, apply `supabase/migrations/20261030_add_exam_details.sql` first. Then apply `supabase/migrations/20261030_admin_only_results.sql` manually in Supabase SQL Editor.
2. Sign in as an Admin and open **Results**. Confirm existing result rows load from Supabase. Other roles can only see rows allowed by the existing read policies and cannot enter or edit marks.
3. Choose **Enter marks**, select a course and examination, and verify students linked by `students.course_id` or `enrollments` are listed.
4. Enter marks from zero up to the exam maximum, optionally add remarks, and save one or more changed rows. Confirm percentage, grade, pass/fail status, statistics and the results table update.
5. Try negative marks, marks above the maximum, and values with more than two decimal places. Confirm validation blocks saving. The database trigger also rejects marks above the selected exam maximum.
6. Edit an existing result and verify the `(student_id, exam_id)` record is updated rather than duplicated. Use the grade filter and student-name/ID search.
7. Open **Grade rules**, configure strictly descending A/B/C/D thresholds, and verify grades and previews reflect those thresholds. Click a student's name or report action to open the individual report, then choose **Print report**.
8. Use **Export** to download the filtered result list as CSV.

### Test examination management

1. If the live `exams` table predates the new fields, run `supabase/migrations/20261030_add_exam_details.sql` manually in Supabase SQL Editor. Do not run it from the application.
2. Sign in as an Admin, or as a Teacher assigned to the course to be managed, and open **Examinations**.
3. Use search and the course, department, type, and upcoming/completed filters. Confirm upcoming exams also appear on the Dashboard schedule.
4. Choose **Add examination**. Enter its name and subject, choose an available course, then set the examination type, date, start time, duration, maximum marks and passing marks. Department comes from the selected course. Description is optional.
5. Try invalid dates, zero duration, non-positive maximum marks, or passing marks above maximum; verify validation prevents saving. Save a valid exam and confirm its row and statistics update.
6. Edit the exam and verify saved values. Delete it after reviewing the warning that existing result records may cascade-delete.
7. Sign in as a Student or a Teacher not assigned to a course and verify records/controls reflect the existing RLS visibility and write permissions.

### Test attendance

1. Sign in as an Admin, or as a Teacher assigned to a course with enrolled students.
2. Open **Attendance**, choose a date and course, and wait for the enrollment roster and saved attendance to load. Use the department filter or search field to narrow the roster.
3. Set each student's status to Present, Absent, Late, or Excused, or use **Mark all present**. Save attendance and confirm the success message, totals, and rate update.
4. Change one or more statuses for the same course and date and save again. Verify that the existing rows are updated rather than duplicated.
5. Use **By date** to inspect/export the selected date, and **By student** to review/export each enrolled student's status totals and attendance rate across the course's recorded sessions.
6. Confirm the Dashboard attendance rate reflects today's Supabase records. A student or an unassigned Teacher can only view attendance allowed by the existing RLS policies and cannot mark records.

### Test course management

1. Apply `supabase/migrations/20261030_add_course_catalog_details.sql` manually in the Supabase SQL Editor if the live courses table predates these fields.
2. Sign in with an account whose `profiles.role` is `admin`, then open **Courses**.
3. Search for a course by name or code and apply the department and duration filters.
4. Choose **Add course**, enter a unique course code, name, department, duration, and positive whole-number credits. Optionally add a description and assign a teacher from the existing teachers table; choose Active or Inactive, then save.
5. Confirm the new row and course statistics update, edit the course and verify the saved fields, then delete it and review the cascade warning before confirming.
6. Sign in with a non-Admin account to verify the page is read-only and database RLS remains authoritative.

### Test teacher management

1. Apply `supabase/migrations/20261030_add_teacher_profile_fields.sql` in Supabase SQL Editor if the live teachers table predates these fields.
2. Sign in with an Auth account whose `profiles.role` is `admin`, then open **Teachers**.
3. Use the search field to find a teacher by name, email, or teacher ID; use the department and designation filters to narrow the list.
4. Choose **Add teacher**, enter a unique teacher ID, name, valid email, department, and designation, then save. Confirm it appears in the directory.
5. Edit the new record and verify the updated details and profile view.
6. Delete the record and confirm the prompt; verify it is removed.

Other authenticated roles receive only the rows allowed by teacher RLS policies and cannot see the add/edit/delete controls. RLS remains authoritative for all database operations.

### Test student management

1. Make sure the schema is applied, `.env.local` contains the project's URL and publishable key, and the first Admin role has been assigned as described above.
2. Restart `npm run dev`, then sign in with that Admin's Supabase Auth email and password.
3. Open **Students**. Wait for the database records to load; use the search box and department filter to find records.
4. Choose **Add Student**, complete the required student details, and save. Choose a course that already exists in the `courses` table. Confirm the success message and new table row.
5. Edit that row and save; verify the updated values and dashboard student total/chart.
6. Delete the row and confirm the prompt; verify it disappears and the dashboard student total/chart updates.

If write actions are denied, check that the signed-in account has `profiles.role = 'admin'`. The application reports permission failures and leaves RLS enabled; it never elevates the user or uses a service-role key.
