import { supabase } from './supabaseClient'
import { fetchCourseEnrollments } from './attendanceRecords'

const PAGE_SIZE = 1000
export const RESULT_COLUMNS = 'id, student_id, exam_id, marks, grade, remarks, created_at, updated_at'

export function toResultRecord(row, students, exams, courses) {
  const student = students.find((item) => item.id === row.student_id)
  const exam = exams.find((item) => item.id === row.exam_id)
  const course = courses.find((item) => item.id === exam?.courseId)
  return {
    id: row.id,
    studentId: row.student_id,
    studentNumber: student?.studentId || '',
    studentName: student?.name || 'Student record unavailable',
    examId: row.exam_id,
    examName: exam?.name || 'Examination record unavailable',
    courseId: exam?.courseId || '',
    courseName: course?.name || exam?.courseName || '',
    courseCode: course?.courseCode || exam?.courseCode || '',
    marks: Number(row.marks),
    grade: row.grade,
    remarks: row.remarks || '',
    maxMarks: exam?.maxMarks === '' || exam?.maxMarks == null ? null : Number(exam.maxMarks),
    passingMarks: exam?.passingMarks === '' || exam?.passingMarks == null ? null : Number(exam.passingMarks),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function fetchResults() {
  const rows = []
  for (let start = 0; ; start += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('results')
      .select(RESULT_COLUMNS)
      .order('created_at', { ascending: false })
      .order('id')
      .range(start, start + PAGE_SIZE - 1)
    if (error) throw error
    rows.push(...data)
    if (data.length < PAGE_SIZE) return rows
  }
}

export async function fetchCourseResultStudents(courseId) {
  const [directStudents, enrolledStudents] = await Promise.all([
    (async () => {
      const rows = []
      for (let start = 0; ; start += PAGE_SIZE) {
        const { data, error } = await supabase
          .from('students')
          .select('id, student_id, name, department')
          .eq('course_id', courseId)
          .order('name')
          .order('id')
          .range(start, start + PAGE_SIZE - 1)
        if (error) throw error
        rows.push(...data)
        if (data.length < PAGE_SIZE) return rows
      }
    })(),
    fetchCourseEnrollments(courseId),
  ])
  const studentsById = new Map(enrolledStudents.map((student) => [student.id, student]))
  for (const student of directStudents) {
    studentsById.set(student.id, {
      id: student.id,
      studentId: student.student_id,
      name: student.name,
      department: student.department,
    })
  }
  return [...studentsById.values()].sort((left, right) => left.name.localeCompare(right.name))
}

export function explainResultError(error, action = 'complete this operation') {
  const message = error?.message || ''
  if (
    error?.code === '42501'
    || error?.status === 401
    || error?.status === 403
    || /row-level security|permission denied|not authorized/i.test(message)
  ) {
    return 'Supabase denied this request. Only an authenticated user whose profiles.role is admin can enter or edit results. Existing database security policies remain enforced.'
  }
  if (error?.code === '23505') {
    return 'A result already exists for this student and examination. Refresh the records and retry.'
  }
  if (error?.code === '23503') {
    return 'The selected student or examination is no longer available. Refresh the page and retry.'
  }
  if (error?.code === '23514' || /maximum marks|exam_max_marks/i.test(message)) {
    return 'Marks must be between zero and the selected examination’s maximum marks.'
  }
  if (error?.code === 'PGRST200') {
    return 'Supabase could not resolve the enrollment-to-student relationship. Verify the enrollments.student_id foreign key to students.id in supabase/schema.sql.'
  }
  if (error?.code === '42703' || error?.code === 'PGRST204') {
    return 'The results table is missing the remarks column. Apply supabase/migrations/20261030_admin_only_results.sql in the Supabase SQL Editor, then retry.'
  }
  return `Could not ${action}: ${message || 'An unexpected database error occurred.'}`
}
