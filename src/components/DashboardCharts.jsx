import { useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const departmentColors = {
  Engineering: '#3978e8',
  Business: '#8663e8',
  'Arts & Humanities': '#f5ae4e',
  Sciences: '#53b99b',
  Education: '#e78291',
}

function PanelHeading({ title, subtitle, action }) {
  return <div className="panel-heading"><div><h2>{title}</h2><p>{subtitle}</p></div>{action}</div>
}

export default function DashboardCharts({ students, teachers, studentsLoading, teachersLoading, studentsError, teachersError, isAdmin, onViewDepartments }) {
  const [range, setRange] = useState('This year')
  const [chartDate] = useState(() => new Date())
  const thisYear = chartDate.getFullYear()
  const chartYear = range === 'Last year' ? thisYear - 1 : thisYear
  const studentsWithDates = students
    .map((student) => ({ ...student, createdDate: new Date(student.createdAt) }))
    .filter((student) => Number.isFinite(student.createdDate.getTime()))
  const teachersWithDates = teachers
    .map((teacher) => ({ ...teacher, createdDate: new Date(teacher.createdAt) }))
    .filter((teacher) => Number.isFinite(teacher.createdDate.getTime()))
  const yearStart = new Date(chartYear, 0, 1)
  const previousEnrollment = studentsWithDates.filter((student) => student.createdDate < yearStart).length
  const previousTeachers = teachersWithDates.filter((teacher) => teacher.createdDate < yearStart).length
  const chartData = monthLabels.map((month, monthIndex) => {
    const monthEnd = new Date(chartYear, monthIndex + 1, 0, 23, 59, 59, 999)
    const enrolledByMonthEnd = studentsWithDates.filter((student) => (
      student.createdDate >= yearStart && student.createdDate <= monthEnd
    )).length
    const teachersByMonthEnd = teachersWithDates.filter((teacher) => (
      teacher.createdDate >= yearStart && teacher.createdDate <= monthEnd
    )).length
    return {
      month,
      students: previousEnrollment + enrolledByMonthEnd,
      teachers: previousTeachers + teachersByMonthEnd,
    }
  })
  const departmentCounts = students.reduce((counts, student) => {
    counts[student.department] = (counts[student.department] || 0) + 1
    return counts
  }, {})
  const departmentShares = Object.entries(departmentCounts).map(([name, count]) => ({
    name,
    exactShare: students.length ? (count / students.length) * 100 : 0,
    value: students.length ? Math.floor((count / students.length) * 100) : 0,
    color: departmentColors[name] || '#53b99b',
  }))
  const remainingPercent = students.length
    ? 100 - departmentShares.reduce((sum, department) => sum + department.value, 0)
    : 0
  const bonusDepartments = new Set([...departmentShares]
    .sort((a, b) => (b.exactShare - b.value) - (a.exactShare - a.value))
    .slice(0, remainingPercent)
    .map((department) => department.name))
  const departments = departmentShares.map(({ name, value, color }) => ({
    name,
    value: value + Number(bonusDepartments.has(name)),
    color,
  }))
  const currentMonth = chartDate.getMonth()
  const semesterStart = currentMonth < 6 ? 0 : 6
  const visibleData = range === 'This semester' ? chartData.slice(semesterStart, currentMonth + 1) : chartData

  return <section className="dashboard-main-grid">
    <article className="panel enrollment-panel">
      <PanelHeading title="Student statistics" subtitle={isAdmin ? 'Enrollment overview for this academic year' : 'Enrollment history visible to your account'} action={<select className="select-small" aria-label="Chart range" value={range} onChange={(event) => setRange(event.target.value)}><option>This year</option><option>Last year</option><option>This semester</option></select>} />
      {studentsLoading || teachersLoading
        ? <div className="chart-loading" role="status">Loading enrollment history…</div>
        : studentsError || teachersError
          ? <div className="chart-loading" role="status">Enrollment history is unavailable.</div>
          : <><div className="chart-legend"><span><i className="legend-dot blue-dot" /> Students</span><span><i className="legend-dot violet-dot" /> Teachers</span><span className="chart-total"><strong>{students.length.toLocaleString()}</strong> students enrolled</span></div>
            <div className="enrollment-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={visibleData} margin={{ top: 8, right: 7, left: -22, bottom: 0 }}><defs><linearGradient id="studentFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3978e8" stopOpacity={0.15} /><stop offset="95%" stopColor="#3978e8" stopOpacity={0} /></linearGradient><linearGradient id="teacherFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8663e8" stopOpacity={0.11} /><stop offset="95%" stopColor="#8663e8" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#edf0f5" strokeDasharray="3 5" /><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#9299a8', fontSize: 11 }} dy={10} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#9299a8', fontSize: 11 }} domain={[0, 'auto']} tickCount={5} /><Tooltip contentStyle={{ border: '1px solid #e8ebf1', borderRadius: 10, fontSize: 12, boxShadow: '0 8px 24px #172b4d12' }} /><Area type="monotone" dataKey="students" stroke="#3978e8" strokeWidth={2.5} fill="url(#studentFill)" /><Area type="monotone" dataKey="teachers" stroke="#8663e8" strokeWidth={2} fill="url(#teacherFill)" /></AreaChart></ResponsiveContainer></div></>}
    </article>
    <article className="panel department-panel">
      <PanelHeading title="Students by department" subtitle={isAdmin ? 'Distribution across faculties' : 'Records visible to your account'} action={<button className="icon-button subtle-menu" aria-label="View courses" onClick={onViewDepartments}><span aria-hidden="true">···</span></button>} />
      {studentsLoading ? <div className="chart-loading" role="status">Loading department data…</div>
        : studentsError ? <div className="chart-loading" role="status">Department data is unavailable.</div>
          : !students.length ? <div className="chart-loading">No student records are available.</div>
            : <><div className="department-chart"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={departments} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={66} outerRadius={88} paddingAngle={4} stroke="none"><>{departments.map((entry) => <Cell key={entry.name} fill={entry.color} />)}</></Pie><Tooltip formatter={(value) => [`${value}%`, 'Students']} contentStyle={{ border: '1px solid #e8ebf1', borderRadius: 10, fontSize: 12 }} /></PieChart></ResponsiveContainer><div className="donut-label"><strong>{students.length.toLocaleString()}</strong><span>Students</span></div></div>
              <div className="department-legend">{departments.map((department) => <div key={department.name}><span><i className="legend-dot" style={{ background: department.color }} />{department.name}</span><strong>{department.value}%</strong></div>)}</div></>}
    </article>
  </section>
}
