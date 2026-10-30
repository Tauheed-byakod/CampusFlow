import { supabase } from './supabaseClient'

const PAGE_SIZE = 1000
const ATTENDANCE_COLUMNS = 'id, student_id, course_id, attendance_date, status, marked_by, created_at'

function toAttendanceRecord(row) {
  return {
    id: row.id,
    studentId: row.student_id,
    courseId: row.course_id,
    date: row.attendance_date,
    status: row.status,
    markedBy: row.marked_by,
    createdAt: row.created_at,
  }
}

async function fetchAll(query) {
  const rows = []
  for (let start = 0; ; start += PAGE_SIZE) {
    const { data, error } = await query.range(start, start + PAGE_SIZE - 1)
    if (error) throw error
    rows.push(...data)
    if (data.length < PAGE_SIZE) return rows
  }
}

export async function fetchCourseEnrollments(courseId) {
  const rows = await fetchAll(
    supabase
      .from('enrollments')
      .select('student_id, student:students!enrollments_student_id_fkey(id, student_id, name, department)')
      .eq('course_id', courseId)
      .order('student_id'),
  )
  return rows
    .filter((row) => row.student)
    .map((row) => ({
      id: row.student.id,
      studentId: row.student.student_id,
      name: row.student.name,
      department: row.student.department,
    }))
    .sort((left, right) => left.name.localeCompare(right.name))
}

export async function fetchCourseAttendance(courseId) {
  const rows = await fetchAll(
    supabase
      .from('attendance')
      .select(ATTENDANCE_COLUMNS)
      .eq('course_id', courseId)
      .order('attendance_date', { ascending: false })
      .order('id'),
  )
  return rows.map(toAttendanceRecord)
}

export async function fetchDailyAttendance(date) {
  const rows = await fetchAll(
    supabase
      .from('attendance')
      .select('id, student_id, course_id, attendance_date, status')
      .eq('attendance_date', date)
      .order('id'),
  )
  return rows.map(toAttendanceRecord)
}

export async function saveAttendance(records) {
  const rows = records.map((record) => ({
    student_id: record.studentId,
    course_id: record.courseId,
    attendance_date: record.date,
    status: record.status,
    marked_by: record.markedBy,
  }))
  const { data, error } = await supabase
    .from('attendance')
    .upsert(rows, { onConflict: 'student_id,course_id,attendance_date' })
    .select(ATTENDANCE_COLUMNS)
  if (error) throw error
  return data.map(toAttendanceRecord)
}

export function explainAttendanceError(error, action = 'complete this operation') {
  const message = error?.message || ''
  if (
    error?.code === '42501'
    || error?.status === 401
    || error?.status === 403
    || /row-level security|permission denied|not authorized/i.test(message)
  ) {
    return 'Supabase denied this request. Admins can manage attendance; Teachers can mark attendance only for enrolled students in their assigned courses. Existing database security policies remain enforced.'
  }
  if (error?.code === '23505') {
    return 'An attendance record already exists for a student, course, and date. Refresh the records and retry.'
  }
  if (error?.code === '23503') {
    return 'The selected course or student is no longer available. Refresh the page and retry.'
  }
  if (error?.code === 'PGRST200') {
    return 'Supabase could not resolve the enrollment-to-student relationship. Verify the enrollments.student_id foreign key to students.id in the existing schema.'
  }
  return `Could not ${action}: ${message || 'An unexpected database error occurred.'}`
}
