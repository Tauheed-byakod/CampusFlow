import { supabase } from './supabaseClient'

const PAGE_SIZE = 1000
export const EXAM_COLUMNS = 'id, name, subject, course_id, exam_date, exam_type, start_time, duration_minutes, max_marks, passing_marks, description, created_at'

function formatTime(value = '') {
  return value.slice(0, 5)
}

export function toExamRecord(row, courses = []) {
  const course = courses.find((item) => item.id === row.course_id)
  return {
    id: row.id,
    name: row.name,
    subject: row.subject,
    courseId: row.course_id,
    courseCode: course?.courseCode || '',
    courseName: course?.name || '',
    department: course?.department || '',
    date: row.exam_date,
    type: row.exam_type || '',
    time: formatTime(row.start_time || ''),
    durationMinutes: row.duration_minutes == null ? '' : String(row.duration_minutes),
    maxMarks: row.max_marks == null ? '' : String(row.max_marks),
    passingMarks: row.passing_marks == null ? '' : String(row.passing_marks),
    description: row.description || '',
    createdAt: row.created_at,
  }
}

export function toExamPayload(exam) {
  return {
    name: exam.name.trim(),
    subject: exam.subject.trim(),
    course_id: exam.courseId,
    exam_date: exam.date,
    exam_type: exam.type,
    start_time: exam.time,
    duration_minutes: Number(exam.durationMinutes),
    max_marks: Number(exam.maxMarks),
    passing_marks: Number(exam.passingMarks),
    description: exam.description.trim() || null,
  }
}

export function explainExamError(error, action = 'complete this operation') {
  const message = error?.message || ''
  if (
    error?.code === '42501'
    || error?.status === 401
    || error?.status === 403
    || /row-level security|permission denied|not authorized/i.test(message)
  ) {
    return 'Supabase denied this request. Admins can manage all examinations; assigned Teachers can manage examinations for their courses. Database security policies remain enforced.'
  }
  if (error?.code === '23503') {
    return 'The selected course is no longer available. Refresh the page and select a valid course.'
  }
  if (error?.code === '23514') {
    return 'The examination details violate a database constraint. Check the examination type, duration, and marks.'
  }
  if (error?.code === '42703' || error?.code === 'PGRST204') {
    return 'The exams table is missing examination detail columns. Apply supabase/migrations/20261030_add_exam_details.sql in the Supabase SQL Editor, then retry.'
  }
  return `Could not ${action}: ${message || 'An unexpected database error occurred.'}`
}

export async function fetchExams(courses) {
  const rows = []
  for (let start = 0; ; start += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('exams')
      .select(EXAM_COLUMNS)
      .order('exam_date', { ascending: true })
      .order('id')
      .range(start, start + PAGE_SIZE - 1)
    if (error) throw error
    rows.push(...data)
    if (data.length < PAGE_SIZE) break
  }
  return rows.map((row) => toExamRecord(row, courses))
}
