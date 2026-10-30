import { supabase } from './supabaseClient'

export const COURSE_COLUMNS = 'id, name, course_code, department, description, duration, credits, assigned_teacher, status, created_at, updated_at, teacher:teachers!courses_assigned_teacher_fkey(id, name, teacher_id)'
const PAGE_SIZE = 1000

export function toCourseRecord(row) {
  return {
    id: row.id,
    name: row.name,
    courseCode: row.course_code,
    department: row.department || '',
    description: row.description || '',
    duration: row.duration || '',
    credits: row.credits == null ? '' : String(row.credits),
    assignedTeacherId: row.assigned_teacher || '',
    assignedTeacherName: row.teacher?.name || (row.assigned_teacher ? 'Assigned' : ''),
    status: row.status === 'inactive' ? 'Inactive' : 'Active',
    createdAt: row.created_at,
  }
}

export function toCoursePayload(course) {
  return {
    course_code: course.courseCode.trim(),
    name: course.name.trim(),
    department: course.department.trim(),
    description: course.description.trim() || null,
    duration: course.duration.trim(),
    credits: Number(course.credits),
    assigned_teacher: course.assignedTeacherId || null,
    status: course.status.toLowerCase(),
  }
}

export function explainCourseError(error, action = 'complete this operation') {
  const message = error?.message || ''
  if (
    error?.code === '42501'
    || error?.status === 401
    || error?.status === 403
    || /row-level security|permission denied|not authorized/i.test(message)
  ) {
    return 'Supabase denied this request. Sign in with an account whose profiles.role is admin to manage course records. Database security policies are still enforced.'
  }
  if (error?.code === '23505') {
    return 'That course code is already in use.'
  }
  if (error?.code === '23503') {
    return 'The selected teacher is no longer available. Refresh the page and choose a valid teacher.'
  }
  if (error?.code === '42703' || error?.code === 'PGRST204') {
    return 'The courses table is missing catalog columns. Apply supabase/migrations/20261030_add_course_catalog_details.sql in the Supabase SQL Editor, then retry.'
  }
  if (error?.code === 'PGRST200') {
    return 'Supabase could not resolve the assigned-teacher relationship. Verify the courses.assigned_teacher foreign key to teachers.id in the existing schema.'
  }
  return `Could not ${action}: ${message || 'An unexpected database error occurred.'}`
}

export async function fetchCourses() {
  const rows = []
  for (let start = 0; ; start += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('courses')
      .select(COURSE_COLUMNS)
      .order('created_at', { ascending: false })
      .order('id')
      .range(start, start + PAGE_SIZE - 1)
    if (error) throw error
    rows.push(...data)
    if (data.length < PAGE_SIZE) return rows.map(toCourseRecord)
  }
}
