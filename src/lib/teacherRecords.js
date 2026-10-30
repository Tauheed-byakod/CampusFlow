import { supabase } from './supabaseClient'

export const TEACHER_COLUMNS = 'id, profile_id, teacher_id, name, email, phone, subjects, gender, date_of_birth, department, designation, qualification, joining_date, address, created_at'
const PAGE_SIZE = 1000

export function toTeacherRecord(row) {
  return {
    id: row.id,
    teacherId: row.teacher_id,
    name: row.name,
    email: row.email,
    phone: row.phone || '',
    subjects: row.subjects || [],
    gender: row.gender || '',
    dateOfBirth: row.date_of_birth || '',
    department: row.department || '',
    designation: row.designation || '',
    qualification: row.qualification || '',
    joiningDate: row.joining_date || '',
    address: row.address || '',
    createdAt: row.created_at,
  }
}

export function toTeacherPayload(teacher) {
  return {
    teacher_id: teacher.teacherId.trim(),
    name: teacher.name.trim(),
    email: teacher.email.trim().toLowerCase(),
    phone: teacher.phone.trim() || null,
    subjects: teacher.subjects,
    gender: teacher.gender || null,
    date_of_birth: teacher.dateOfBirth || null,
    department: teacher.department.trim() || null,
    designation: teacher.designation.trim() || null,
    qualification: teacher.qualification.trim() || null,
    joining_date: teacher.joiningDate || null,
    address: teacher.address.trim() || null,
  }
}

export function explainTeacherError(error, action = 'complete this operation') {
  const message = error?.message || ''
  if (
    error?.code === '42501'
    || error?.status === 401
    || error?.status === 403
    || /row-level security|permission denied|not authorized/i.test(message)
  ) {
    return 'Supabase denied this request. Sign in with an account whose profiles.role is admin to manage teacher records. Database security policies are still enforced.'
  }
  if (error?.code === '23505') {
    return 'That teacher ID is already in use.'
  }
  if (error?.code === '42703' || error?.code === 'PGRST204') {
    return 'The teachers table is missing profile columns. Apply supabase/migrations/20261030_add_teacher_profile_fields.sql in the Supabase SQL Editor, then retry.'
  }
  return `Could not ${action}: ${message || 'An unexpected database error occurred.'}`
}

export async function fetchTeachers() {
  const rows = []
  for (let start = 0; ; start += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('teachers')
      .select(TEACHER_COLUMNS)
      .order('created_at', { ascending: false })
      .order('id')
      .range(start, start + PAGE_SIZE - 1)
    if (error) throw error
    rows.push(...data)
    if (data.length < PAGE_SIZE) return rows.map(toTeacherRecord)
  }
}
