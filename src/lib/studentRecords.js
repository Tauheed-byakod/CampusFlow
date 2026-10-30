import { supabase } from './supabaseClient'

export const STUDENT_COLUMNS = 'id, student_id, name, email, phone, gender, date_of_birth, department, course_id, course_name, year, admission_year, address, created_at'
const PAGE_SIZE = 1000

function formatYearOfStudy(year) {
  const suffix = year % 100 >= 11 && year % 100 <= 13
    ? 'th'
    : ({ 1: 'st', 2: 'nd', 3: 'rd' }[year % 10] || 'th')
  return `${year}${suffix} Year`
}

export function toStudentRecord(row) {
  return {
    id: row.id,
    studentId: row.student_id,
    name: row.name,
    email: row.email,
    phone: row.phone || '',
    gender: row.gender || '',
    dateOfBirth: row.date_of_birth || '',
    department: row.department,
    courseId: row.course_id || '',
    courseName: row.course_name || '',
    yearOfStudy: row.year,
    yearOfStudyLabel: formatYearOfStudy(row.year),
    admissionYear: row.admission_year ? String(row.admission_year) : '',
    address: row.address || '',
    createdAt: row.created_at,
  }
}

export function toStudentPayload(student) {
  return {
    student_id: student.studentId.trim(),
    name: student.name.trim(),
    email: student.email.trim(),
    phone: student.phone.trim() || null,
    gender: student.gender || null,
    date_of_birth: student.dateOfBirth || null,
    department: student.department.trim(),
    course_id: student.courseId || null,
    course_name: student.courseId ? null : student.courseName.trim() || null,
    year: Number(student.yearOfStudy),
    admission_year: student.admissionYear ? Number(student.admissionYear) : null,
    address: student.address.trim() || null,
  }
}

export function explainStudentError(error, action = 'complete this operation') {
  const message = error?.message || ''
  if (
    error?.code === '42501'
    || error?.status === 401
    || error?.status === 403
    || /row-level security|permission denied|not authorized/i.test(message)
  ) {
    return 'Supabase denied this request. Sign in with an account whose profiles.role is admin to manage student records. Database security policies are still enforced.'
  }
  if (error?.code === '23505') {
    return 'That student ID or email address is already in use.'
  }
  if (error?.code === '23503') {
    return 'The selected course is no longer available. Refresh the page and choose a valid course.'
  }
  if (error?.code === '42703' || error?.code === 'PGRST204') {
    return 'The students table is missing a required column. Apply the required migrations in supabase/migrations through the Supabase SQL Editor, then retry.'
  }
  return `Could not ${action}: ${message || 'An unexpected database error occurred.'}`
}

export async function fetchStudents() {
  const rows = []
  for (let start = 0; ; start += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('students')
      .select(STUDENT_COLUMNS)
      .order('created_at', { ascending: false })
      .order('id')
      .range(start, start + PAGE_SIZE - 1)
    if (error) throw error
    rows.push(...data)
    if (data.length < PAGE_SIZE) return rows.map(toStudentRecord)
  }
}

export async function fetchStudentRole(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  return data?.role || null
}

export async function fetchStudentCourses() {
  const rows = []
  for (let start = 0; ; start += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('courses')
      .select('id, name, course_code')
      .order('name')
      .order('id')
      .range(start, start + PAGE_SIZE - 1)
    if (error) throw error
    rows.push(...data)
    if (data.length < PAGE_SIZE) return rows
  }
}
