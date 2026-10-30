import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import {
  BrowserRouter,
  NavLink,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import {
  Activity,
  ArrowUpRight,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Download,
  Ellipsis,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import { supabase } from './lib/supabaseClient'
import { fetchRecentNotifications } from './lib/notificationRecords'
import { COURSE_COLUMNS, explainCourseError, fetchCourses, toCoursePayload, toCourseRecord } from './lib/courseRecords'
import { EXAM_COLUMNS, explainExamError, fetchExams, toExamPayload, toExamRecord } from './lib/examRecords'
import { explainAttendanceError, fetchCourseAttendance, fetchCourseEnrollments, fetchDailyAttendance, saveAttendance } from './lib/attendanceRecords'
import { explainResultError, fetchCourseResultStudents, fetchResults, RESULT_COLUMNS, toResultRecord } from './lib/resultRecords'
import { explainStudentError, fetchStudentCourses, fetchStudentRole, fetchStudents, toStudentPayload, toStudentRecord, STUDENT_COLUMNS } from './lib/studentRecords'
import { explainTeacherError, fetchTeachers, TEACHER_COLUMNS, toTeacherPayload, toTeacherRecord } from './lib/teacherRecords'
import './App.css'

const DashboardCharts = lazy(() => import('./components/DashboardCharts.jsx'))

const PAGE_SIZE = 8
const OTHER_OPTION = '__other__'

function useStoredState(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key)
      return stored ? JSON.parse(stored) : initialValue
    } catch (error) {
      console.error(`Unable to load ${key} from local storage.`, error)
      return initialValue
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch (error) {
      console.error(`Unable to save ${key} to local storage.`, error)
    }
  }, [key, value])

  return [value, setValue]
}

const navigation = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { label: 'Students', path: '/students', icon: Users },
  { label: 'Teachers', path: '/teachers', icon: UserRound },
  { label: 'Courses', path: '/courses', icon: BookOpen },
  { label: 'Attendance', path: '/attendance', icon: ClipboardCheck },
  { label: 'Examinations', path: '/examinations', icon: FileText },
  { label: 'Results', path: '/results', icon: Activity },
]

function App() {
  const [teachers, setTeachers] = useState([])
  const [teachersLoading, setTeachersLoading] = useState(false)
  const [teachersError, setTeachersError] = useState('')
  const [courses, setCourses] = useState([])
  const [coursesLoading, setCoursesLoading] = useState(false)
  const [coursesError, setCoursesError] = useState('')
  const [attendance, setAttendance] = useState([])
  const [attendanceLoading, setAttendanceLoading] = useState(false)
  const [attendanceError, setAttendanceError] = useState('')
  const [exams, setExams] = useState([])
  const [examsLoading, setExamsLoading] = useState(false)
  const [examsError, setExamsError] = useState('')
  const [notifications, setNotifications] = useState([])
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [notificationsError, setNotificationsError] = useState('')
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authError, setAuthError] = useState('')
  const [accountRole, setAccountRole] = useState(null)
  const [accountRoleLoading, setAccountRoleLoading] = useState(false)
  const [accountRoleError, setAccountRoleError] = useState('')
  const [students, setStudents] = useState([])
  const [studentsLoading, setStudentsLoading] = useState(false)
  const [studentsError, setStudentsError] = useState('')

  useEffect(() => {
    let active = true
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) {
        setSession(nextSession)
        setAuthLoading(false)
        setAuthError('')
        setAccountRole(null)
        setAccountRoleLoading(Boolean(nextSession))
        setAccountRoleError('')
        setStudentsLoading(Boolean(nextSession))
        setStudentsError('')
        setTeachersLoading(Boolean(nextSession))
        setTeachersError('')
        setCoursesLoading(Boolean(nextSession))
        setCoursesError('')
        setAttendanceLoading(Boolean(nextSession))
        setAttendanceError('')
        setExamsLoading(Boolean(nextSession))
        setExamsError('')
        setNotificationsLoading(Boolean(nextSession))
        setNotificationsError('')
        if (!nextSession) {
          setStudents([])
          setTeachers([])
          setCourses([])
          setAttendance([])
          setExams([])
          setNotifications([])
        }
      }
    })
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return
      if (error) setAuthError(`Could not restore your Supabase session: ${error.message}`)
      setSession(data.session)
      setAuthLoading(false)
      setAccountRoleLoading(Boolean(data.session))
      setStudentsLoading(Boolean(data.session))
      setTeachersLoading(Boolean(data.session))
      setCoursesLoading(Boolean(data.session))
      setAttendanceLoading(Boolean(data.session))
      setExamsLoading(Boolean(data.session))
      setNotificationsLoading(Boolean(data.session))
      if (!data.session) {
        setStudents([])
        setTeachers([])
        setCourses([])
        setAttendance([])
        setExams([])
        setNotifications([])
      }
    }).catch((error) => {
      if (!active) return
      setAuthError(`Could not restore your Supabase session: ${error.message}`)
      setAuthLoading(false)
    })
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const userId = session?.user?.id

  useEffect(() => {
    let active = true
    if (!userId) return () => { active = false }
    fetchStudentRole(userId).then((role) => {
      if (active) setAccountRole(role)
    }).catch((error) => {
      if (active) setAccountRoleError(explainStudentError(error, 'check account permissions'))
    }).finally(() => {
      if (active) setAccountRoleLoading(false)
    })
    return () => { active = false }
  }, [userId])

  useEffect(() => {
    let active = true
    if (!userId) return () => { active = false }
    fetchStudents().then((records) => {
      if (active) setStudents(records)
    }).catch((error) => {
      if (active) setStudentsError(explainStudentError(error, 'load student records'))
    }).finally(() => {
      if (active) setStudentsLoading(false)
    })
    return () => { active = false }
  }, [userId])

  useEffect(() => {
    let active = true
    if (!userId) return () => { active = false }
    fetchRecentNotifications().then((records) => {
      if (active) setNotifications(records)
    }).catch((error) => {
      if (active) setNotificationsError(`Could not load notifications: ${error.message || 'An unexpected database error occurred.'}`)
    }).finally(() => {
      if (active) setNotificationsLoading(false)
    })
    return () => { active = false }
  }, [userId])

  useEffect(() => {
    let active = true
    if (!userId || coursesLoading) return () => { active = false }
    fetchExams(courses).then((records) => {
      if (active) setExams(records)
    }).catch((error) => {
      if (active) setExamsError(explainExamError(error, 'load examination records'))
    }).finally(() => {
      if (active) setExamsLoading(false)
    })
    return () => { active = false }
  }, [userId, courses, coursesLoading])

  useEffect(() => {
    let active = true
    if (!userId) return () => { active = false }
    fetchDailyAttendance(getLocalDate()).then((records) => {
      if (active) setAttendance(records)
    }).catch((error) => {
      if (active) setAttendanceError(explainAttendanceError(error, 'load today’s attendance summary'))
    }).finally(() => {
      if (active) setAttendanceLoading(false)
    })
    return () => { active = false }
  }, [userId])

  async function refreshAttendanceSummary() {
    try {
      setAttendance(await fetchDailyAttendance(getLocalDate()))
      setAttendanceError('')
    } catch (error) {
      setAttendanceError(explainAttendanceError(error, 'refresh today’s attendance summary'))
    }
  }

  useEffect(() => {
    let active = true
    if (!userId) return () => { active = false }
    fetchCourses().then((records) => {
      if (active) setCourses(records)
    }).catch((error) => {
      if (active) setCoursesError(explainCourseError(error, 'load course records'))
    }).finally(() => {
      if (active) setCoursesLoading(false)
    })
    return () => { active = false }
  }, [userId])

  useEffect(() => {
    let active = true
    if (!userId) return () => { active = false }
    fetchTeachers().then((records) => {
      if (active) setTeachers(records)
    }).catch((error) => {
      if (active) setTeachersError(explainTeacherError(error, 'load teacher records'))
    }).finally(() => {
      if (active) setTeachersLoading(false)
    })
    return () => { active = false }
  }, [userId])

  async function logout() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={authLoading ? <AuthLoading /> : session ? <Navigate to="/" replace /> : <LoginPage initialError={authError} />} />
        <Route element={authLoading ? <AuthLoading /> : session ? <AppLayout onLogout={logout} user={session.user} notifications={notifications} notificationsLoading={notificationsLoading} notificationsError={notificationsError} /> : <Navigate to="/login" replace />}>
          <Route index element={<DashboardPage accountRole={accountRole} accountRoleLoading={accountRoleLoading} accountRoleError={accountRoleError} students={students} studentsLoading={studentsLoading} studentsError={studentsError} teachers={teachers} teachersLoading={teachersLoading} teachersError={teachersError} courses={courses} coursesLoading={coursesLoading} coursesError={coursesError} exams={exams} examsLoading={examsLoading} examsError={examsError} attendance={attendance} attendanceLoading={attendanceLoading} attendanceError={attendanceError} notifications={notifications} notificationsLoading={notificationsLoading} notificationsError={notificationsError} />} />
          <Route path="students" element={<StudentsPage key={userId} students={students} setStudents={setStudents} studentsLoading={studentsLoading} studentsError={studentsError} setStudentsError={setStudentsError} userId={userId} />} />
          <Route path="teachers" element={<TeachersPage key={userId} teachers={teachers} setTeachers={setTeachers} teachersLoading={teachersLoading} teachersError={teachersError} setTeachersError={setTeachersError} userId={userId} />} />
          <Route path="courses" element={<CoursesPage key={userId} courses={courses} setCourses={setCourses} coursesLoading={coursesLoading} coursesError={coursesError} setCoursesError={setCoursesError} teachers={teachers} teachersLoading={teachersLoading} teachersError={teachersError} userId={userId} />} />
          <Route path="attendance" element={<AttendancePage courses={courses} coursesLoading={coursesLoading} coursesError={coursesError} knownStudents={students} studentsLoading={studentsLoading} userId={userId} onAttendanceChanged={refreshAttendanceSummary} />} />
          <Route path="examinations" element={<ExaminationsPage key={userId} exams={exams} setExams={setExams} examsLoading={examsLoading} examsError={examsError} setExamsError={setExamsError} courses={courses} coursesLoading={coursesLoading} coursesError={coursesError} userId={userId} />} />
          <Route path="results" element={<ResultsPage key={userId} students={students} studentsLoading={studentsLoading} studentsError={studentsError} courses={courses} coursesLoading={coursesLoading} coursesError={coursesError} exams={exams} examsLoading={examsLoading} examsError={examsError} userId={userId} />} />
          <Route path="settings" element={<SettingsPage user={session?.user} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

function AppLayout({ onLogout, user, notifications, notificationsLoading, notificationsError }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [noticeOpen, setNoticeOpen] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const [currentYear] = useState(() => new Date().getFullYear())
  const [adminName, setAdminName] = useState(() => localStorage.getItem('campusflow-admin-name') || userDisplayName(user))
  const navigate = useNavigate()
  const unreadNotifications = notifications.filter((notification) => !notification.is_read).length

  async function handleLogout() {
    setLogoutError('')
    try {
      await onLogout()
    } catch (error) {
      setLogoutError(`Could not sign out: ${error.message}`)
    }
  }

  useEffect(() => {
    function syncAdminName(event) {
      setAdminName(event.detail?.fullName || localStorage.getItem('campusflow-admin-name') || userDisplayName(user))
    }
    window.addEventListener('campusflow-profile-updated', syncAdminName)
    return () => window.removeEventListener('campusflow-profile-updated', syncAdminName)
  }, [user])

  useEffect(() => {
    function handleSearchShortcut(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        const searchInput = document.querySelector('.page-search')
        if (searchInput) searchInput.focus()
        else {
          navigate('/students')
          window.setTimeout(() => document.querySelector('.page-search')?.focus(), 100)
        }
      }
    }
    document.addEventListener('keydown', handleSearchShortcut)
    return () => document.removeEventListener('keydown', handleSearchShortcut)
  }, [navigate])

  function openSearch() {
    const searchInput = document.querySelector('.page-search')
    if (searchInput) {
      searchInput.focus()
      return
    }
    navigate('/students')
    window.setTimeout(() => document.querySelector('.page-search')?.focus(), 100)
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><GraduationCap size={23} strokeWidth={2.2} /></div>
          <span>campus<span className="brand-light">flow</span></span>
          <button className="icon-button mobile-close" onClick={() => setSidebarOpen(false)} aria-label="Close navigation"><X size={19} /></button>
        </div>
        <div className="school-switcher">
          <div className="school-avatar">N</div>
          <div className="school-copy"><strong>Northfield College</strong><span>Campus workspace</span></div>
        </div>
        <div className="nav-caption">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          {navigation.map(({ label, path, icon: Icon }) => (
            <NavLink key={path} to={path} end={path === '/'} onClick={() => setSidebarOpen(false)} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Icon size={18} strokeWidth={1.8} /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="nav-caption tools-caption">PREFERENCES</div>
        <nav className="side-nav" aria-label="Preferences">
          <NavLink to="/settings" onClick={() => setSidebarOpen(false)} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><Settings size={18} strokeWidth={1.8} /><span>Settings</span></NavLink>
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-icon"><Sparkles size={16} /></div>
            <strong>Need a hand?</strong>
            <p>Our support team is here to help you.</p>
            <a href="mailto:support@northfield.edu">Get support <ChevronRight size={14} /></a>
          </div>
          {logoutError && <div className="form-error" role="alert">{logoutError}</div>}
          <button className="profile-menu" onClick={handleLogout}>
            <div className="avatar avatar-admin">{initials(adminName)}</div>
            <span className="profile-copy"><strong>{adminName}</strong><small>Signed in</small></span>
            <LogOut size={16} className="logout-icon" />
          </button>
        </div>
      </aside>
      {sidebarOpen && <button className="mobile-backdrop" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}
      <div className="main-column">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><Menu size={21} /></button>
          <Breadcrumb />
          <div className="topbar-actions">
            <button className="search-shortcut" onClick={openSearch}><Search size={16} /><span>Search anything...</span><kbd>⌘ K</kbd></button>
            <div className="notice-wrap">
              <button className="icon-button notification-button" aria-label={`Notifications${unreadNotifications ? `, ${unreadNotifications} unread` : ''}`} onClick={() => setNoticeOpen(!noticeOpen)}><Bell size={19} />{unreadNotifications > 0 && <i />}</button>
              {noticeOpen && <div className="notification-popover"><strong>Notifications</strong>
                {notificationsLoading ? <p role="status">Loading notifications…</p>
                  : notificationsError ? <p role="alert">{notificationsError}</p>
                    : notifications.length ? notifications.slice(0, 5).map((notification) => <p key={notification.id}><span className={`notification-dot ${notification.is_read ? 'pale' : ''}`} />{notification.title}<time>{formatRelativeTime(notification.created_at)}</time></p>)
                      : <p>No notifications yet.</p>}
              </div>}
            </div>
            <div className="topbar-avatar">{initials(adminName)}</div>
          </div>
        </header>
        <main className="page-content"><Outlet /></main>
        <footer className="app-footer"><span>© {currentYear} CampusFlow Education Suite</span><span>Made for better learning <span className="footer-heart">♥</span></span></footer>
      </div>
    </div>
  )
}

function Breadcrumb() {
  const location = useLocation()
  const label = navigation.find((item) => item.path === location.pathname)?.label ?? (location.pathname === '/settings' ? 'Settings' : 'Dashboard')
  return <div className="breadcrumb"><span>Workspace</span><ChevronRight size={14} /><strong>{label}</strong></div>
}

function AuthLoading() {
  return <main className="auth-loading" role="status">Checking Supabase session…</main>
}

function LoginPage({ initialError = '' }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()

  async function submit(event) {
    event.preventDefault()
    if (!email.trim() || !password.trim()) {
      setError('Enter your email and password to continue.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (signInError) throw signInError
      navigate('/', { replace: true })
    } catch (signInError) {
      setError(`Supabase sign-in failed: ${signInError.message || 'Check your connection and try again.'}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-brand"><div className="brand-mark"><GraduationCap size={23} /></div><span>campus<span className="brand-light">flow</span></span></div>
      <div className="login-visual">
        <div className="login-orbit orbit-one" /><div className="login-orbit orbit-two" />
        <div className="login-message">
          <div className="login-pill"><Sparkles size={14} /> YOUR CAMPUS, CONNECTED</div>
          <h1>Make every day<br />a little more <em>brilliant.</em></h1>
          <p>One thoughtful space for the people, progress, and possibilities that make your college special.</p>
          <div className="login-people"><div className="avatar-stack"><span>JD</span><span>LM</span><span>AK</span><span>+</span></div><div><strong>Good things happen here</strong><small>Welcome to a more connected campus.</small></div></div>
        </div>
        <div className="login-art-card"><div className="art-card-top"><span>THIS WEEK</span><span className="art-trend"><ArrowUpRight size={14} /> 8.4%</span></div><div className="art-chart"><span style={{ height: '32%' }} /><span style={{ height: '45%' }} /><span style={{ height: '39%' }} /><span style={{ height: '59%' }} /><span style={{ height: '51%' }} /><span style={{ height: '78%' }} /><span style={{ height: '93%' }} /></div><div className="art-card-bottom"><strong>Student engagement</strong><span>Looking great</span></div></div>
      </div>
      <div className="login-form-wrap">
        <form className="login-form" onSubmit={submit}>
          <div className="form-eyebrow">WELCOME BACK</div><h2>Sign in to your account</h2><p className="login-subtitle">Use your college Supabase Auth account to continue.</p>
          <label>Email address<input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@college.edu" /></label>
          <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" /></label>
          <div className="login-options"><span className="secure-signin">Secure administrator sign-in</span><a className="text-button" href="mailto:support@northfield.edu?subject=Password%20reset">Forgot password?</a></div>
          {(error || initialError) && <div className="form-error" role="alert">{error || initialError}</div>}
          <button className="button button-primary login-submit" type="submit" disabled={submitting}>{submitting ? 'Signing in…' : 'Sign in'} {!submitting && <ChevronRight size={17} />}</button>
          <div className="demo-hint">Student record changes require an account with the Admin role.</div>
        </form>
        <div className="login-legal">© 2025 Northfield College <span>·</span> Privacy <span>·</span> Help center</div>
      </div>
    </div>
  )
}

function DashboardPage({ accountRole, accountRoleLoading, accountRoleError, students, studentsLoading, studentsError, teachers, teachersLoading, teachersError, courses, coursesLoading, coursesError, exams, examsLoading, examsError, attendance, attendanceLoading, attendanceError, notifications, notificationsLoading, notificationsError }) {
  const navigate = useNavigate()
  const [showAllActivities, setShowAllActivities] = useState(false)
  const [today] = useState(() => new Date())
  const attendanceDenominator = attendance.filter((record) => record.status !== 'excused').length
  const attendedCount = attendance.filter((record) => record.status === 'present' || record.status === 'late').length
  const attendancePercent = attendanceDenominator ? Math.round((attendedCount / attendanceDenominator) * 100) : null
  const activityIcon = (notification) => {
    const type = notification.notification_type?.toLowerCase()
    if (type === 'student') return Users
    if (type === 'course') return BookOpen
    if (type === 'exam' || type === 'examination') return FileText
    if (type === 'attendance') return ClipboardCheck
    return Bell
  }
  const activityTone = (notification) => {
    const type = notification.notification_type?.toLowerCase()
    if (type === 'student') return 'activity-blue'
    if (type === 'course') return 'activity-violet'
    if (type === 'exam' || type === 'examination') return 'activity-amber'
    return 'activity-green'
  }
  const upcomingExams = exams.filter(isExamUpcoming).sort((left, right) => (
    examTimestamp(left) - examTimestamp(right)
  )).slice(0, 3)
  const dateLabel = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()
  const isAdmin = accountRole === 'admin'
  const accountReady = !accountRoleLoading && !accountRoleError && Boolean(accountRole)
  const stats = [
    { title: isAdmin ? 'Total students' : 'Students visible', value: accountRoleLoading ? '…' : !accountReady ? '—' : studentsLoading ? '…' : studentsError ? '—' : students.length.toLocaleString(), note: studentsError ? 'Unavailable' : isAdmin ? 'Supabase records' : 'Visible under your access', icon: Users, tone: 'blue', path: '/students' },
    { title: isAdmin ? 'Total teachers' : 'Teachers visible', value: accountRoleLoading ? '…' : !accountReady ? '—' : teachersLoading ? '…' : teachersError ? '—' : teachers.length.toLocaleString(), note: teachersError ? 'Unavailable' : isAdmin ? 'Supabase records' : 'Visible under your access', icon: UserRound, tone: 'violet', path: '/teachers' },
    { title: isAdmin ? 'Total courses' : 'Courses visible', value: accountRoleLoading ? '…' : !accountReady ? '—' : coursesLoading ? '…' : coursesError ? '—' : courses.length.toLocaleString(), note: coursesError ? 'Unavailable' : isAdmin ? 'Supabase records' : 'Visible under your access', icon: BookOpen, tone: 'amber', path: '/courses' },
    { title: 'Attendance rate', value: accountRoleLoading ? '…' : !accountReady ? '—' : attendanceLoading ? '…' : attendanceError || attendancePercent == null ? '—' : `${attendancePercent}%`, note: attendanceError ? 'Unavailable' : attendancePercent == null ? 'No records today' : isAdmin ? 'Today · campus records' : 'Today · visible records', icon: ClipboardCheck, tone: 'green', path: '/attendance' },
  ]
  return (
    <>
      <PageHeading eyebrow={dateLabel} title="Campus overview" subtitle="Here’s what’s happening across your campus today." action={<button className="button button-secondary" onClick={() => window.print()}><Download size={16} /> Export report</button>} />
      <section className="stats-grid">
        {stats.map(({ title, value, note, icon: Icon, tone, path }) => <article className="stat-card" key={title}>
          <div className="stat-top"><div className={`stat-icon ${tone}`}><Icon size={19} /></div><button className="icon-button subtle-menu" aria-label={`View ${title}`} onClick={() => navigate(path)}><Ellipsis size={19} /></button></div>
          <div className="stat-title">{title}</div><div className="stat-value">{value}</div>
          <div className="stat-footer"><span>{note}</span></div>
        </article>)}
      </section>
      {studentsError && <div className="database-error" role="alert">{studentsError}</div>}
      {teachersError && <div className="database-error" role="alert">{teachersError}</div>}
      {coursesError && <div className="database-error" role="alert">{coursesError}</div>}
      {examsError && <div className="database-error" role="alert">{examsError}</div>}
      {attendanceError && <div className="database-error" role="alert">{attendanceError}</div>}
      {notificationsError && <div className="database-error" role="alert">{notificationsError}</div>}
      {accountRoleError && <div className="database-error" role="alert">{accountRoleError}</div>}
      {!accountRoleLoading && !accountRoleError && accountRole !== 'admin' && <div className="database-info" role="status">Dashboard figures reflect records visible to your account under Row Level Security; campus-wide totals require the Admin role.</div>}
      <Suspense fallback={<div className="dashboard-main-grid"><article className="panel chart-loading">Loading student statistics…</article><article className="panel chart-loading">Loading department statistics…</article></div>}>
        <DashboardCharts students={students} teachers={teachers} studentsLoading={studentsLoading} teachersLoading={teachersLoading} studentsError={studentsError} teachersError={teachersError} isAdmin={isAdmin} onViewDepartments={() => navigate('/courses')} />
      </Suspense>
      <section className="dashboard-lower-grid">
        <article className="panel activities-panel">
          <PanelHeading title="Recent notifications" subtitle="Updates available to your account" action={<button className="text-button" onClick={() => setShowAllActivities(true)}>View all <ChevronRight size={15} /></button>} />
          {notificationsLoading ? <div className="student-loading" role="status">Loading recent notifications…</div>
            : notificationsError ? <div className="empty-state" role="status">Notifications are unavailable.</div>
              : notifications.length ? <div className="activity-list">{notifications.slice(0, 4).map((notification) => {
                const Icon = activityIcon(notification)
                return <div className="activity-row" key={notification.id}><div className={`activity-icon ${activityTone(notification)}`}><Icon size={16} /></div><div className="activity-content"><strong>{notification.title}</strong><p>{notification.message}</p></div><time dateTime={notification.created_at}>{formatRelativeTime(notification.created_at)}</time></div>
              })}</div>
                : <div className="empty-state">No recent notifications.</div>}
        </article>
        <article className="panel schedule-panel">
          <PanelHeading title="Upcoming examinations" subtitle={examsLoading ? 'Loading examination schedule…' : `${exams.length} examinations · ${upcomingExams.length} upcoming`} action={<button className="icon-button subtle-menu" aria-label="View examinations" onClick={() => navigate('/examinations')}><Ellipsis size={19} /></button>} />
          <div className="schedule-list">{upcomingExams.map((exam, index) => {
            const examDate = new Date(`${exam.date}T00:00:00`)
            return <div className="schedule-item" key={exam.id}>
              <div className={`schedule-date ${index === 1 ? 'purple-date' : index === 2 ? 'green-date' : ''}`}><strong>{examDate.toLocaleDateString('en-US', { day: '2-digit' })}</strong><span>{examDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}</span></div>
              <div><strong>{exam.name}</strong><p><Clock3 size={13} /> {formatDisplayTime(exam.time)} · {exam.courseCode || 'Course'}</p></div>
              <span className="schedule-tag">{exam.type || 'Exam'}</span>
            </div>
          })}{!examsLoading && !upcomingExams.length && <div className="empty-state">No upcoming examinations are scheduled.</div>}</div>
        </article>
      </section>
      {showAllActivities && <Modal title="Recent notifications" subtitle="Updates available to your account." onClose={() => setShowAllActivities(false)}>{notificationsLoading ? <div className="student-loading" role="status">Loading notifications…</div> : notificationsError ? <div className="database-error" role="alert">{notificationsError}</div> : notifications.length ? <div className="activity-list modal-activity-list">{notifications.map((notification) => {
        const Icon = activityIcon(notification)
        return <div className="activity-row" key={notification.id}><div className={`activity-icon ${activityTone(notification)}`}><Icon size={16} /></div><div className="activity-content"><strong>{notification.title}</strong><p>{notification.message}</p></div><time dateTime={notification.created_at}>{formatRelativeTime(notification.created_at)}</time></div>
      })}</div> : <div className="empty-state">No notifications are available.</div>}</Modal>}
    </>
  )
}

const studentColumns = [
  { key: 'name', label: 'Student', kind: 'person' },
  { key: 'studentId', label: 'Student ID' },
  { key: 'department', label: 'Department' },
  { key: 'yearOfStudyLabel', label: 'Year of Study' },
  { key: 'admissionYear', label: 'Admission Year' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
]
const courseColumns = [
  { key: 'courseCode', label: 'Course code' }, { key: 'name', label: 'Course name' },
  { key: 'department', label: 'Department' }, { key: 'duration', label: 'Duration' },
  { key: 'credits', label: 'Credits' }, { key: 'assignedTeacherName', label: 'Assigned teacher' },
  { key: 'status', label: 'Status', kind: 'status' },
]
function StudentsPage({ students, setStudents, studentsLoading, studentsError, setStudentsError, userId }) {
  const [search, setSearch] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('All departments')
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState(null)
  const [profile, setProfile] = useState(null)
  const [courses, setCourses] = useState([])
  const [roleLoading, setRoleLoading] = useState(true)
  const [canManage, setCanManage] = useState(false)
  const [roleError, setRoleError] = useState('')
  const [courseError, setCourseError] = useState('')
  const [notice, setNotice] = useState('')
  const [deletingId, setDeletingId] = useState(null)
  const [monthStart] = useState(() => {
    const date = new Date()
    date.setDate(1)
    date.setHours(0, 0, 0, 0)
    return date
  })
  const departments = useMemo(() => [...new Set(students.map((student) => student.department).filter(Boolean))].sort(), [students])

  useEffect(() => {
    let active = true
    fetchStudentRole(userId).then((role) => {
      if (active) setCanManage(role === 'admin')
    }).catch((error) => {
      if (active) {
        setCanManage(false)
        setRoleError(explainStudentError(error, 'check student-management permissions'))
      }
    }).finally(() => {
      if (active) setRoleLoading(false)
    })
    fetchStudentCourses().then((items) => {
      if (active) setCourses(items)
    }).catch((error) => {
      if (active) setCourseError(explainStudentError(error, 'load course choices'))
    })
    return () => { active = false }
  }, [userId])

  useEffect(() => {
    if (!notice) return undefined
    const timeout = window.setTimeout(() => setNotice(''), 4500)
    return () => window.clearTimeout(timeout)
  }, [notice])

  const filtered = useMemo(() => students.filter((student) => {
    const query = search.toLowerCase()
    return (!query || `${student.name} ${student.studentId} ${student.department} ${student.email} ${student.phone} ${student.courseName} ${student.yearOfStudyLabel} ${student.admissionYear}`.toLowerCase().includes(query))
      && (departmentFilter === 'All departments' || student.department === departmentFilter)
  }), [students, search, departmentFilter])
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const visibleStudents = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const newThisMonth = useMemo(() => {
    return students.filter((student) => student.createdAt && new Date(student.createdAt) >= monthStart).length
  }, [students, monthStart])

  async function saveStudent(student) {
    const payload = toStudentPayload(student)
    const request = student.id
      ? supabase.from('students').update(payload).eq('id', student.id).select(STUDENT_COLUMNS).maybeSingle()
      : supabase.from('students').insert(payload).select(STUDENT_COLUMNS).single()
    const { data, error } = await request
    if (error) throw new Error(explainStudentError(error, student.id ? 'update student' : 'add student'))
    if (!data) throw new Error(explainStudentError({ code: '42501' }, student.id ? 'update student' : 'add student'))
    const savedStudent = toStudentRecord(data)
    if (student.id) {
      setStudents((current) => current.map((item) => item.id === savedStudent.id ? savedStudent : item))
      setStudentsError('')
    } else {
      let refreshErrorMessage = ''
      try {
        setStudents(await fetchStudents())
      } catch (refreshError) {
        setStudents((current) => [savedStudent, ...current.filter((item) => item.id !== savedStudent.id)])
        refreshErrorMessage = `Student was saved, but the list could not be refreshed: ${explainStudentError(refreshError, 'refresh student records')}`
      }
      setStudentsError(refreshErrorMessage)
      setSearch('')
      setDepartmentFilter('All departments')
      setPage(1)
    }
    setNotice(student.id ? 'Student details updated successfully.' : 'Student added successfully.')
    setModal(null)
  }

  async function deleteStudent(student) {
    if (deletingId || !window.confirm(`Delete ${student.name} from the student directory? This also permanently deletes linked enrollments, attendance, and examination results.`)) return
    setDeletingId(student.id)
    setStudentsError('')
    try {
      const { data, error } = await supabase
        .from('students')
        .delete()
        .eq('id', student.id)
        .select('id')
        .maybeSingle()
      if (error) throw error
      if (!data) {
        throw new Error('No student row was deleted. The record may no longer exist, or your account may not have permission to delete it.')
      }
      setStudents((current) => current.filter((item) => item.id !== student.id))
      setNotice('Student deleted successfully.')
      setProfile(null)
    } catch (error) {
      setStudentsError(error.message === 'No student row was deleted. The record may no longer exist, or your account may not have permission to delete it.'
        ? error.message
        : explainStudentError(error, 'delete student'))
    } finally {
      setDeletingId(null)
    }
  }

  return <>
    <PageHeading eyebrow="CAMPUS DIRECTORY" title="Student management" subtitle="Keep your student records organized and up to date." />
    <div className="student-summary"><div className="summary-intro"><div className="summary-icon"><Users size={20} /></div><div><strong>{studentsLoading ? 'Loading students…' : `${students.length.toLocaleString()} students`}</strong><span>Your college community at a glance</span></div></div><div className="summary-divider" /><div className="summary-metric"><span>With course</span><strong>{students.filter((student) => student.courseId || student.courseName).length}</strong></div><div className="summary-metric"><span>New this month</span><strong className="new-count">{newThisMonth}</strong></div><div className="summary-metric"><span>Departments</span><strong>{departments.length}</strong></div></div>
    {notice && <div className="database-success" role="status">{notice}</div>}
    {roleError && <div className="database-error" role="alert">{roleError}</div>}
    {studentsError && <div className="database-error" role="alert">{studentsError}</div>}
    {courseError && <div className="database-error" role="alert">{courseError}</div>}
    {!roleLoading && !canManage && !roleError && <div className="database-info" role="status">Read-only access. Only an authenticated user with the Admin role can add, edit, or delete student records.</div>}
    <div className="panel directory-panel">
      <div className="directory-toolbar"><div><h2>All students <span className="count-pill">{filtered.length}</span></h2><p>Browse and manage your student directory.</p></div><div className="toolbar-actions"><label className="table-search"><Search size={16} /><input className="page-search" placeholder="Search students..." value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} /><kbd>⌘ F</kbd></label><div className="filter-select student-filter-select"><SlidersHorizontal size={15} /><select aria-label="Filter students by department" value={departmentFilter} onChange={(event) => { setDepartmentFilter(event.target.value); setPage(1) }}><option>All departments</option>{departments.map((department) => <option key={department}>{department}</option>)}</select></div>{canManage && <button className="button button-primary add-student-toolbar" onClick={() => setModal({})}><Plus size={16} /><span>Add Student</span></button>}<button className="button button-secondary export-button" onClick={() => downloadCsv(filtered, studentColumns, 'students.csv')}><Download size={15} /><span>Export</span></button></div></div>
      {studentsLoading ? <div className="student-loading" role="status">Loading student records from Supabase…</div> : studentsError ? <div className="student-loading">Student records could not be loaded.</div> : <DataTable columns={studentColumns} rows={visibleStudents} onView={setProfile} onEdit={canManage ? (row) => setModal(row) : undefined} onDelete={canManage ? deleteStudent : undefined} emptyMessage="No students match your search." />}
      {!studentsLoading && !studentsError && <Pagination page={currentPage} pageCount={pageCount} total={filtered.length} onPageChange={setPage} noun="students" />}
    </div>
    {modal && <StudentModal student={modal.id ? modal : null} students={students} departments={departments} courses={courses} onClose={() => setModal(null)} onSave={saveStudent} />}
    {profile && <StudentProfile student={profile} courses={courses} canEdit={canManage} onClose={() => setProfile(null)} onEdit={() => { setModal(profile); setProfile(null) }} />}
  </>
}

const teacherColumns = [
  { key: 'name', label: 'Teacher', kind: 'person' },
  { key: 'teacherId', label: 'Teacher ID' },
  { key: 'department', label: 'Department' },
  { key: 'designation', label: 'Designation' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
]

function TeachersPage({ teachers, setTeachers, teachersLoading, teachersError, setTeachersError, userId }) {
  const [search, setSearch] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('All departments')
  const [designationFilter, setDesignationFilter] = useState('All designations')
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState(null)
  const [profile, setProfile] = useState(null)
  const [roleLoading, setRoleLoading] = useState(true)
  const [canManage, setCanManage] = useState(false)
  const [roleError, setRoleError] = useState('')
  const [notice, setNotice] = useState('')
  const [deletingId, setDeletingId] = useState(null)
  const departments = useMemo(() => [...new Set(teachers.map((teacher) => teacher.department).filter(Boolean))].sort(), [teachers])
  const designations = useMemo(() => [...new Set(teachers.map((teacher) => teacher.designation).filter(Boolean))].sort(), [teachers])

  useEffect(() => {
    let active = true
    fetchStudentRole(userId).then((role) => {
      if (active) setCanManage(role === 'admin')
    }).catch((error) => {
      if (active) {
        setCanManage(false)
        setRoleError(explainTeacherError(error, 'check teacher-management permissions'))
      }
    }).finally(() => {
      if (active) setRoleLoading(false)
    })
    return () => { active = false }
  }, [userId])

  useEffect(() => {
    if (!notice) return undefined
    const timeout = window.setTimeout(() => setNotice(''), 4500)
    return () => window.clearTimeout(timeout)
  }, [notice])

  const filtered = useMemo(() => teachers.filter((teacher) => {
    const query = search.trim().toLowerCase()
    return (!query || `${teacher.name} ${teacher.email} ${teacher.teacherId}`.toLowerCase().includes(query))
      && (departmentFilter === 'All departments' || teacher.department === departmentFilter)
      && (designationFilter === 'All designations' || teacher.designation === designationFilter)
  }), [teachers, search, departmentFilter, designationFilter])
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const visibleTeachers = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const withSubjects = teachers.filter((teacher) => teacher.subjects.length > 0).length

  async function saveTeacher(teacher) {
    const payload = toTeacherPayload(teacher)
    const request = teacher.id
      ? supabase.from('teachers').update(payload).eq('id', teacher.id).select(TEACHER_COLUMNS).maybeSingle()
      : supabase.from('teachers').insert(payload).select(TEACHER_COLUMNS).single()
    const { data, error } = await request
    if (error) throw new Error(explainTeacherError(error, teacher.id ? 'update teacher' : 'add teacher'))
    if (!data) throw new Error(explainTeacherError({ code: '42501' }, teacher.id ? 'update teacher' : 'add teacher'))
    const savedTeacher = toTeacherRecord(data)
    if (teacher.id) {
      setTeachers((current) => current.map((item) => item.id === savedTeacher.id ? savedTeacher : item))
    } else {
      try {
        setTeachers(await fetchTeachers())
      } catch (refreshError) {
        setTeachers((current) => [savedTeacher, ...current.filter((item) => item.id !== savedTeacher.id)])
        setTeachersError(`Teacher saved, but the list could not be refreshed: ${explainTeacherError(refreshError, 'refresh teacher records')}`)
      }
      setSearch('')
      setDepartmentFilter('All departments')
      setDesignationFilter('All designations')
      setPage(1)
    }
    setNotice(teacher.id ? 'Teacher details updated successfully.' : 'Teacher added successfully.')
    setModal(null)
  }

  async function deleteTeacher(teacher) {
    if (deletingId || !window.confirm(`Delete ${teacher.name} from the teacher directory? Courses assigned to this teacher will become unassigned.`)) return
    setDeletingId(teacher.id)
    setTeachersError('')
    try {
      const { data, error } = await supabase
        .from('teachers')
        .delete()
        .eq('id', teacher.id)
        .select('id')
        .maybeSingle()
      if (error) throw error
      if (!data) throw new Error('No teacher row was deleted. It may no longer exist, or your account may not have permission.')
      setTeachers((current) => current.filter((item) => item.id !== teacher.id))
      setNotice('Teacher deleted successfully.')
      setProfile(null)
    } catch (error) {
      setTeachersError(error.message.startsWith('No teacher row was deleted.')
        ? error.message
        : explainTeacherError(error, 'delete teacher'))
    } finally {
      setDeletingId(null)
    }
  }

  return <>
    <PageHeading eyebrow="CAMPUS DIRECTORY" title="Teacher management" subtitle="Manage faculty profiles and teaching assignments." action={canManage && <button className="button button-primary" onClick={() => setModal({})}><Plus size={17} /> Add teacher</button>} />
    <div className="student-summary teacher-summary">
      <div className="summary-intro"><div className="summary-icon"><UserRound size={20} /></div><div><strong>{teachersLoading ? 'Loading teachers…' : `${teachers.length.toLocaleString()} teachers`}</strong><span>Your faculty at a glance</span></div></div>
      <div className="summary-divider" />
      <div className="summary-metric"><span>Departments</span><strong>{departments.length}</strong></div>
      <div className="summary-metric"><span>Designations</span><strong>{designations.length}</strong></div>
      <div className="summary-metric"><span>With subjects</span><strong>{withSubjects}</strong></div>
    </div>
    {notice && <div className="database-success" role="status">{notice}</div>}
    {roleError && <div className="database-error" role="alert">{roleError}</div>}
    {teachersError && <div className="database-error" role="alert">{teachersError}</div>}
    {!roleLoading && !canManage && !roleError && <div className="database-info" role="status">Read-only access. Only an authenticated user with the Admin role can add, edit, or delete teacher records.</div>}
    <div className="panel directory-panel">
      <div className="directory-toolbar">
        <div><h2>All teachers <span className="count-pill">{filtered.length}</span></h2><p>Search, filter and manage faculty records.</p></div>
        <div className="toolbar-actions teacher-toolbar-actions">
          <label className="table-search"><Search size={16} /><input className="page-search" placeholder="Search name, email or teacher ID..." value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} /></label>
          <div className="filter-select teacher-filter-select"><SlidersHorizontal size={15} /><select aria-label="Filter teachers by department" value={departmentFilter} onChange={(event) => { setDepartmentFilter(event.target.value); setPage(1) }}><option>All departments</option>{departments.map((department) => <option key={department}>{department}</option>)}</select></div>
          <div className="filter-select teacher-filter-select"><SlidersHorizontal size={15} /><select aria-label="Filter teachers by designation" value={designationFilter} onChange={(event) => { setDesignationFilter(event.target.value); setPage(1) }}><option>All designations</option>{designations.map((designation) => <option key={designation}>{designation}</option>)}</select></div>
          <button className="button button-secondary export-button" onClick={() => downloadCsv(filtered, teacherColumns, 'teachers.csv')}><Download size={15} /><span>Export</span></button>
        </div>
      </div>
      {teachersLoading ? <div className="student-loading" role="status">Loading teacher records from Supabase…</div> : teachersError ? <div className="student-loading">Teacher records could not be loaded.</div> : <DataTable columns={teacherColumns} rows={visibleTeachers} onView={setProfile} onEdit={canManage ? setModal : undefined} onDelete={canManage ? deleteTeacher : undefined} emptyMessage="No teachers match your search or filters." />}
      {!teachersLoading && !teachersError && <Pagination page={currentPage} pageCount={pageCount} total={filtered.length} onPageChange={setPage} noun="teachers" />}
    </div>
    {modal && <TeacherModal teacher={modal.id ? modal : null} teachers={teachers} onClose={() => setModal(null)} onSave={saveTeacher} />}
    {profile && <TeacherProfile teacher={profile} canEdit={canManage} onClose={() => setProfile(null)} onEdit={() => { setModal(profile); setProfile(null) }} />}
  </>
}

function CoursesPage({ courses, setCourses, coursesLoading, coursesError, setCoursesError, teachers, teachersLoading, teachersError, userId }) {
  const [search, setSearch] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('All departments')
  const [durationFilter, setDurationFilter] = useState('All durations')
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState(null)
  const [roleLoading, setRoleLoading] = useState(true)
  const [canManage, setCanManage] = useState(false)
  const [roleError, setRoleError] = useState('')
  const [notice, setNotice] = useState('')
  const [deletingId, setDeletingId] = useState(null)
  const departments = useMemo(() => [...new Set(courses.map((course) => course.department).filter(Boolean))].sort(), [courses])
  const durations = useMemo(() => [...new Set(courses.map((course) => course.duration).filter(Boolean))].sort(), [courses])

  useEffect(() => {
    let active = true
    fetchStudentRole(userId).then((role) => {
      if (active) setCanManage(role === 'admin')
    }).catch((error) => {
      if (active) {
        setCanManage(false)
        setRoleError(explainCourseError(error, 'check course-management permissions'))
      }
    }).finally(() => {
      if (active) setRoleLoading(false)
    })
    return () => { active = false }
  }, [userId])

  useEffect(() => {
    if (!notice) return undefined
    const timeout = window.setTimeout(() => setNotice(''), 4500)
    return () => window.clearTimeout(timeout)
  }, [notice])

  const filtered = useMemo(() => courses.filter((course) => {
    const query = search.trim().toLowerCase()
    return (!query || `${course.name} ${course.courseCode}`.toLowerCase().includes(query))
      && (departmentFilter === 'All departments' || course.department === departmentFilter)
      && (durationFilter === 'All durations' || course.duration === durationFilter)
  }), [courses, search, departmentFilter, durationFilter])
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const visibleCourses = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const activeCount = courses.filter((course) => course.status === 'Active').length
  const assignedCount = courses.filter((course) => course.assignedTeacherId).length
  const totalCredits = courses.reduce((sum, course) => sum + (Number(course.credits) || 0), 0)

  async function saveCourse(course) {
    const payload = toCoursePayload(course)
    const request = course.id
      ? supabase.from('courses').update(payload).eq('id', course.id).select(COURSE_COLUMNS).maybeSingle()
      : supabase.from('courses').insert(payload).select(COURSE_COLUMNS).single()
    const { data, error } = await request
    if (error) throw new Error(explainCourseError(error, course.id ? 'update course' : 'add course'))
    if (!data) throw new Error(explainCourseError({ code: '42501' }, course.id ? 'update course' : 'add course'))
    const savedCourse = toCourseRecord(data)
    setCoursesError('')
    if (course.id) {
      setCourses((current) => current.map((item) => item.id === savedCourse.id ? savedCourse : item))
    } else {
      try {
        setCourses(await fetchCourses())
      } catch (refreshError) {
        setCourses((current) => [savedCourse, ...current.filter((item) => item.id !== savedCourse.id)])
        setCoursesError(`Course saved, but the list could not be refreshed: ${explainCourseError(refreshError, 'refresh course records')}`)
      }
      setSearch('')
      setDepartmentFilter('All departments')
      setDurationFilter('All durations')
      setPage(1)
    }
    setNotice(course.id ? 'Course details updated successfully.' : 'Course added successfully.')
    setModal(null)
  }

  async function deleteCourse(course) {
    const warning = `Delete ${course.courseCode} · ${course.name}? Depending on linked records, this may permanently delete enrollments, attendance, examinations and their results. Student course selections may be cleared.`
    if (deletingId || !window.confirm(warning)) return
    setDeletingId(course.id)
    setCoursesError('')
    try {
      const { data, error } = await supabase
        .from('courses')
        .delete()
        .eq('id', course.id)
        .select('id')
        .maybeSingle()
      if (error) throw error
      if (!data) throw new Error('No course row was deleted. It may no longer exist, or your account may not have permission.')
      setCourses((current) => current.filter((item) => item.id !== course.id))
      setNotice('Course deleted successfully.')
    } catch (error) {
      setCoursesError(error.message.startsWith('No course row was deleted.')
        ? error.message
        : explainCourseError(error, 'delete course'))
    } finally {
      setDeletingId(null)
    }
  }

  return <>
    <PageHeading eyebrow="ACADEMIC CATALOG" title="Course management" subtitle="Manage course details, credit values and faculty assignments." action={canManage && <button className="button button-primary" onClick={() => setModal({})}><Plus size={17} /> Add course</button>} />
    <div className="student-summary course-summary">
      <div className="summary-intro"><div className="summary-icon"><BookOpen size={20} /></div><div><strong>{coursesLoading ? 'Loading courses…' : `${courses.length.toLocaleString()} courses`}</strong><span>Your academic catalog at a glance</span></div></div>
      <div className="summary-divider" />
      <div className="summary-metric"><span>Active</span><strong>{activeCount}</strong></div>
      <div className="summary-metric"><span>Departments</span><strong>{departments.length}</strong></div>
      <div className="summary-metric"><span>Credits</span><strong>{totalCredits}</strong></div>
      <div className="summary-metric"><span>Assigned</span><strong>{assignedCount}</strong></div>
    </div>
    {notice && <div className="database-success" role="status">{notice}</div>}
    {roleError && <div className="database-error" role="alert">{roleError}</div>}
    {coursesError && <div className="database-error" role="alert">{coursesError}</div>}
    {teachersError && <div className="database-error" role="alert">{teachersError}</div>}
    {!roleLoading && !canManage && !roleError && <div className="database-info" role="status">Read-only access. Only an authenticated user with the Admin role can add, edit, or delete courses.</div>}
    <div className="panel directory-panel">
      <div className="directory-toolbar">
        <div><h2>All courses <span className="count-pill">{filtered.length}</span></h2><p>Search the catalog and filter by department or duration.</p></div>
        <div className="toolbar-actions course-toolbar-actions">
          <label className="table-search"><Search size={16} /><input className="page-search" placeholder="Search course name or code..." value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} /></label>
          <div className="filter-select course-filter-select"><SlidersHorizontal size={15} /><select aria-label="Filter courses by department" value={departmentFilter} onChange={(event) => { setDepartmentFilter(event.target.value); setPage(1) }}><option>All departments</option>{departments.map((department) => <option key={department}>{department}</option>)}</select></div>
          <div className="filter-select course-filter-select"><SlidersHorizontal size={15} /><select aria-label="Filter courses by duration" value={durationFilter} onChange={(event) => { setDurationFilter(event.target.value); setPage(1) }}><option>All durations</option>{durations.map((duration) => <option key={duration}>{duration}</option>)}</select></div>
          <button className="button button-secondary export-button" onClick={() => downloadCsv(filtered, courseColumns, 'courses.csv')}><Download size={15} /><span>Export</span></button>
        </div>
      </div>
      {coursesLoading ? <div className="student-loading" role="status">Loading course records from Supabase…</div> : coursesError && !courses.length ? <div className="student-loading">Course records could not be loaded.</div> : <DataTable className="course-table" columns={courseColumns} rows={visibleCourses} onEdit={canManage ? setModal : undefined} onDelete={canManage ? deleteCourse : undefined} emptyMessage="No courses match your search or filters." />}
      {!coursesLoading && !(coursesError && !courses.length) && <Pagination page={currentPage} pageCount={pageCount} total={filtered.length} onPageChange={setPage} noun="courses" />}
    </div>
    {modal && <CourseModal course={modal.id ? modal : null} courses={courses} teachers={teachers} teachersLoading={teachersLoading} onClose={() => setModal(null)} onSave={saveCourse} />}
  </>
}

function ExaminationsPage({ exams, setExams, examsLoading, examsError, setExamsError, courses, coursesLoading, coursesError, userId }) {
  const [search, setSearch] = useState('')
  const [courseFilter, setCourseFilter] = useState('All courses')
  const [departmentFilter, setDepartmentFilter] = useState('All departments')
  const [typeFilter, setTypeFilter] = useState('All types')
  const [statusFilter, setStatusFilter] = useState('All examinations')
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState(null)
  const [roleLoading, setRoleLoading] = useState(true)
  const [canManage, setCanManage] = useState(false)
  const [roleError, setRoleError] = useState('')
  const [notice, setNotice] = useState('')
  const [deletingId, setDeletingId] = useState(null)
  const departments = useMemo(() => [...new Set(courses.map((course) => course.department).filter(Boolean))].sort(), [courses])
  const upcomingCount = exams.filter(isExamUpcoming).length
  const completedCount = exams.length - upcomingCount
  useEffect(() => {
    let active = true
    fetchStudentRole(userId).then((role) => {
      if (active) setCanManage(role === 'admin' || role === 'teacher')
    }).catch((error) => {
      if (active) {
        setCanManage(false)
        setRoleError(explainExamError(error, 'check examination-management permissions'))
      }
    }).finally(() => {
      if (active) setRoleLoading(false)
    })
    return () => { active = false }
  }, [userId])

  useEffect(() => {
    if (!notice) return undefined
    const timeout = window.setTimeout(() => setNotice(''), 4500)
    return () => window.clearTimeout(timeout)
  }, [notice])

  const filtered = useMemo(() => exams.filter((exam) => {
    const query = search.trim().toLowerCase()
    const searchText = `${exam.name} ${exam.subject} ${exam.courseCode} ${exam.courseName} ${exam.description}`.toLowerCase()
    const matchesStatus = statusFilter === 'All examinations'
      || (statusFilter === 'Upcoming' && isExamUpcoming(exam))
      || (statusFilter === 'Completed' && !isExamUpcoming(exam))
    return (!query || searchText.includes(query))
      && (courseFilter === 'All courses' || exam.courseId === courseFilter)
      && (departmentFilter === 'All departments' || exam.department === departmentFilter)
      && (typeFilter === 'All types' || exam.type === typeFilter)
      && matchesStatus
  }), [exams, search, courseFilter, departmentFilter, typeFilter, statusFilter])
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const visibleExams = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  async function saveExam(exam) {
    const payload = toExamPayload(exam)
    const request = exam.id
      ? supabase.from('exams').update(payload).eq('id', exam.id).select(EXAM_COLUMNS).maybeSingle()
      : supabase.from('exams').insert(payload).select(EXAM_COLUMNS).single()
    const { data, error } = await request
    if (error) throw new Error(explainExamError(error, exam.id ? 'update examination' : 'add examination'))
    if (!data) throw new Error(explainExamError({ code: '42501' }, exam.id ? 'update examination' : 'add examination'))
    const savedExam = toExamRecord(data, courses)
    setExamsError('')
    if (exam.id) {
      setExams((current) => current.map((item) => item.id === savedExam.id ? savedExam : item))
    } else {
      try {
        setExams(await fetchExams(courses))
      } catch (refreshError) {
        setExams((current) => [savedExam, ...current.filter((item) => item.id !== savedExam.id)])
        setExamsError(`Examination saved, but the list could not be refreshed: ${explainExamError(refreshError, 'refresh examination records')}`)
      }
      setSearch('')
      setCourseFilter('All courses')
      setDepartmentFilter('All departments')
      setTypeFilter('All types')
      setStatusFilter('All examinations')
      setPage(1)
    }
    setNotice(exam.id ? 'Examination details updated successfully.' : 'Examination added successfully.')
    setModal(null)
  }

  async function deleteExam(exam) {
    if (deletingId || !window.confirm(`Delete "${exam.name}"? Any associated result records may also be deleted due to the existing exams → results cascade relationship.`)) return
    setDeletingId(exam.id)
    setExamsError('')
    try {
      const { data, error } = await supabase
        .from('exams')
        .delete()
        .eq('id', exam.id)
        .select('id')
        .maybeSingle()
      if (error) throw error
      if (!data) throw new Error('No examination row was deleted. It may no longer exist, or your account may not have permission.')
      setExams((current) => current.filter((item) => item.id !== exam.id))
      setNotice('Examination deleted successfully.')
    } catch (error) {
      setExamsError(error.message.startsWith('No examination row was deleted.')
        ? error.message
        : explainExamError(error, 'delete examination'))
    } finally {
      setDeletingId(null)
    }
  }

  const columns = [
    { key: 'name', label: 'Examination' },
    { key: 'subject', label: 'Subject' },
    { key: 'type', label: 'Type' },
    { key: 'courseLabel', label: 'Course' },
    { key: 'department', label: 'Department' },
    { key: 'date', label: 'Date' },
    { key: 'timeLabel', label: 'Time' },
    { key: 'durationLabel', label: 'Duration' },
    { key: 'marksLabel', label: 'Marks' },
    { key: 'status', label: 'Status', kind: 'status' },
  ]
  const displayRows = visibleExams.map((exam) => ({
    ...exam,
    courseLabel: exam.courseCode ? `${exam.courseCode} · ${exam.courseName}` : exam.courseName || '—',
    timeLabel: formatDisplayTime(exam.time),
    durationLabel: exam.durationMinutes ? `${exam.durationMinutes} min` : '—',
    marksLabel: exam.maxMarks ? `${exam.passingMarks} / ${exam.maxMarks}` : '—',
    status: isExamUpcoming(exam) ? 'Upcoming' : 'Completed',
  }))

  return <>
    <PageHeading eyebrow="ACADEMIC RECORDS" title="Examination management" subtitle="Schedule examinations, manage course details and review completed exams." action={canManage && <button className="button button-primary" onClick={() => setModal({})}><Plus size={17} /> Add examination</button>} />
    <div className="student-summary examination-summary">
      <div className="summary-intro"><div className="summary-icon"><FileText size={20} /></div><div><strong>{examsLoading ? 'Loading examinations…' : `${exams.length.toLocaleString()} examinations`}</strong><span>Your examination schedule at a glance</span></div></div>
      <div className="summary-divider" />
      <div className="summary-metric"><span>Upcoming</span><strong>{upcomingCount}</strong></div>
      <div className="summary-metric"><span>Completed</span><strong>{completedCount}</strong></div>
      <div className="summary-metric"><span>Courses</span><strong>{new Set(exams.map((exam) => exam.courseId)).size}</strong></div>
    </div>
    {notice && <div className="database-success" role="status">{notice}</div>}
    {roleError && <div className="database-error" role="alert">{roleError}</div>}
    {examsError && <div className="database-error" role="alert">{examsError}</div>}
    {!roleLoading && !canManage && !roleError && <div className="database-info" role="status">Read-only access. Admins can manage all examinations; assigned Teachers can manage examinations for their courses, as permitted by the existing database policies.</div>}
    <div className="panel directory-panel">
      <div className="directory-toolbar">
        <div><h2>All examinations <span className="count-pill">{filtered.length}</span></h2><p>Search, filter and manage your examination schedule.</p></div>
        <div className="toolbar-actions examination-toolbar-actions">
          <label className="table-search"><Search size={16} /><input className="page-search" placeholder="Search exams, subject or course..." value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} /></label>
          <div className="filter-select examination-filter-select"><SlidersHorizontal size={15} /><select aria-label="Filter examinations by course" value={courseFilter} onChange={(event) => { setCourseFilter(event.target.value); setPage(1) }}><option>All courses</option>{courses.map((course) => <option value={course.id} key={course.id}>{course.courseCode}</option>)}</select></div>
          <div className="filter-select examination-filter-select"><SlidersHorizontal size={15} /><select aria-label="Filter examinations by department" value={departmentFilter} onChange={(event) => { setDepartmentFilter(event.target.value); setPage(1) }}><option>All departments</option>{departments.map((department) => <option key={department}>{department}</option>)}</select></div>
          <div className="filter-select examination-filter-select"><SlidersHorizontal size={15} /><select aria-label="Filter examinations by type" value={typeFilter} onChange={(event) => { setTypeFilter(event.target.value); setPage(1) }}><option>All types</option>{examinationTypes.map((type) => <option key={type}>{type}</option>)}</select></div>
          <div className="filter-select examination-filter-select"><SlidersHorizontal size={15} /><select aria-label="Filter examinations by status" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }}><option>All examinations</option><option>Upcoming</option><option>Completed</option></select></div>
          <button className="button button-secondary export-button" onClick={() => downloadCsv(displayRows, columns, 'examinations.csv')}><Download size={15} /><span>Export</span></button>
        </div>
      </div>
      {coursesError && <div className="database-error" role="alert">{coursesError}</div>}
      {examsLoading || coursesLoading ? <div className="student-loading" role="status">Loading examinations and courses from Supabase…</div>
        : examsError && !exams.length ? <div className="student-loading">Examinations could not be loaded.</div>
          : <DataTable className="examination-table" columns={columns} rows={displayRows} onEdit={canManage ? (row) => setModal(exams.find((item) => item.id === row.id)) : undefined} onDelete={canManage ? (row) => deleteExam(exams.find((item) => item.id === row.id)) : undefined} emptyMessage="No examinations match your search or filters." />}
      {!examsLoading && !coursesLoading && !(examsError && !exams.length) && <Pagination page={currentPage} pageCount={pageCount} total={filtered.length} onPageChange={setPage} noun="examinations" />}
    </div>
    {modal && <ExamModal exam={modal.id ? modal : null} courses={courses} exams={exams} onClose={() => setModal(null)} onSave={saveExam} />}
  </>
}

function AttendancePage({ courses, coursesLoading, coursesError, knownStudents = [], studentsLoading, userId, onAttendanceChanged }) {
  const [selectedDate, setSelectedDate] = useState(getLocalDate)
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('All departments')
  const [search, setSearch] = useState('')
  const [reportMode, setReportMode] = useState('date')
  const [students, setStudents] = useState([])
  const [history, setHistory] = useState([])
  const [draftStatuses, setDraftStatuses] = useState({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dataError, setDataError] = useState('')
  const [roleError, setRoleError] = useState('')
  const [roleLoading, setRoleLoading] = useState(true)
  const [canManage, setCanManage] = useState(false)
  const [notice, setNotice] = useState('')

  const departments = useMemo(() => [...new Set([
    ...knownStudents.map((student) => student.department),
    ...students.map((student) => student.department),
  ].filter(Boolean))].sort(), [knownStudents, students])
  const selectedCourse = courses.find((course) => course.id === selectedCourseId)

  useEffect(() => {
    let active = true
    fetchStudentRole(userId).then((role) => {
      if (active) setCanManage(role === 'admin' || role === 'teacher')
    }).catch((error) => {
      if (active) {
        setCanManage(false)
        setRoleError(explainAttendanceError(error, 'check attendance-management permissions'))
      }
    }).finally(() => {
      if (active) setRoleLoading(false)
    })
    return () => { active = false }
  }, [userId])

  useEffect(() => {
    if (!notice) return undefined
    const timeout = window.setTimeout(() => setNotice(''), 4500)
    return () => window.clearTimeout(timeout)
  }, [notice])

  useEffect(() => {
    let active = true
    if (!selectedCourseId) return () => { active = false }
    Promise.all([fetchCourseEnrollments(selectedCourseId), fetchCourseAttendance(selectedCourseId)])
      .then(([enrolledStudents, attendanceRows]) => {
        if (!active) return
        setStudents(enrolledStudents)
        setHistory(attendanceRows)
      })
      .catch((error) => {
        if (active) setDataError(explainAttendanceError(error, 'load course enrollment and attendance records'))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [selectedCourseId])

  const visibleStudents = useMemo(() => students.filter((student) => {
    const query = search.trim().toLowerCase()
    return (!query || `${student.name} ${student.studentId} ${student.department}`.toLowerCase().includes(query))
      && (departmentFilter === 'All departments' || student.department === departmentFilter)
  }), [students, search, departmentFilter])
  const statusesByStudent = useMemo(() => {
    const savedStatuses = Object.fromEntries(
      history
        .filter((record) => record.date === selectedDate)
        .map((record) => [record.studentId, record.status]),
    )
    return Object.fromEntries(students.map((student) => {
      const key = `${selectedDate}:${student.id}`
      return [student.id, draftStatuses[key] ?? savedStatuses[student.id] ?? '']
    }))
  }, [students, history, selectedDate, draftStatuses])
  const statusCounts = useMemo(() => {
    const counts = { present: 0, absent: 0, late: 0, excused: 0 }
    for (const student of students) {
      const status = statusesByStudent[student.id]
      if (status in counts) counts[status] += 1
    }
    return counts
  }, [students, statusesByStudent])
  const recordedCount = statusCounts.present + statusCounts.absent + statusCounts.late + statusCounts.excused
  const rateDenominator = statusCounts.present + statusCounts.absent + statusCounts.late
  const attendancePercent = rateDenominator
    ? Math.round(((statusCounts.present + statusCounts.late) / rateDenominator) * 100)
    : 0

  function setStudentStatus(studentId, status) {
    setDraftStatuses((current) => ({ ...current, [`${selectedDate}:${studentId}`]: status }))
    setDataError('')
  }

  function markAllPresent() {
    setDraftStatuses((current) => ({
      ...current,
      ...Object.fromEntries(students.map((student) => [`${selectedDate}:${student.id}`, 'present'])),
    }))
    setDataError('')
  }

  async function submitAttendance() {
    if (!canManage || !selectedCourseId || !students.length || saving) return
    if (!selectedDate) {
      setDataError('Choose an attendance date before saving.')
      return
    }
    const missingStatus = students.some((student) => !statusesByStudent[student.id])
    if (missingStatus) {
      setDataError('Choose an attendance status for every enrolled student, or use Mark all present before saving.')
      return
    }
    setSaving(true)
    setDataError('')
    try {
      const savedRecords = await saveAttendance(students.map((student) => ({
        studentId: student.id,
        courseId: selectedCourseId,
        date: selectedDate,
        status: statusesByStudent[student.id],
        markedBy: userId,
      })))
      setHistory((current) => [
        ...current.filter((record) => record.date !== selectedDate),
        ...savedRecords,
      ])
      setDraftStatuses((current) => Object.fromEntries(
        Object.entries(current).filter(([key]) => !key.startsWith(`${selectedDate}:`)),
      ))
      setNotice(`Attendance saved for ${savedRecords.length} enrolled students.`)
      await onAttendanceChanged()
    } catch (error) {
      setDataError(explainAttendanceError(error, 'save attendance'))
    } finally {
      setSaving(false)
    }
  }

  const historyByStudent = useMemo(() => {
    const grouped = new Map()
    for (const record of history) {
      const counts = grouped.get(record.studentId) || { sessions: 0, present: 0, absent: 0, late: 0, excused: 0 }
      if (record.status in counts && record.status !== 'sessions') {
        counts[record.status] += 1
        counts.sessions += 1
      }
      grouped.set(record.studentId, counts)
    }
    return grouped
  }, [history])

  const studentReportRows = visibleStudents.map((student) => {
    const counts = historyByStudent.get(student.id) || { sessions: 0, present: 0, absent: 0, late: 0, excused: 0 }
    const denominator = counts.sessions - counts.excused
    return {
      name: student.name,
      studentId: student.studentId,
      department: student.department,
      sessions: counts.sessions,
      present: counts.present,
      absent: counts.absent,
      late: counts.late,
      excused: counts.excused,
      attendanceRate: denominator ? `${Math.round(((counts.present + counts.late) / denominator) * 100)}%` : '—',
    }
  })
  const dateReportRows = visibleStudents.map((student) => ({
    id: student.id,
    name: student.name,
    studentId: student.studentId,
    department: student.department,
    date: selectedDate,
    status: statusesByStudent[student.id],
  }))

  function exportReport() {
    const columns = reportMode === 'date'
      ? attendanceDateColumns
      : attendanceStudentColumns
    const rows = reportMode === 'date' ? dateReportRows : studentReportRows
    downloadCsv(rows, columns, reportMode === 'date' ? 'attendance-by-date.csv' : 'attendance-by-student.csv')
  }

  return <>
    <PageHeading
      eyebrow="ACADEMIC OPERATIONS"
      title="Attendance management"
      subtitle="Mark class attendance and review date-wise or student-wise reports."
      action={canManage && <div className="attendance-heading-actions"><button className="button button-secondary" onClick={markAllPresent} disabled={!students.length || loading || saving}><Check size={15} /> Mark all present</button><button className="button button-primary" onClick={submitAttendance} disabled={!students.length || loading || saving || !selectedCourseId}>{saving ? 'Saving…' : 'Save attendance'}</button></div>}
    />
    {notice && <div className="database-success" role="status">{notice}</div>}
    {roleError && <div className="database-error" role="alert">{roleError}</div>}
    {dataError && <div className="database-error" role="alert">{dataError}</div>}
    {coursesError && <div className="database-error" role="alert">{coursesError}</div>}
    {!roleLoading && !canManage && !roleError && <div className="database-info" role="status">Read-only attendance access. Admins can manage attendance; assigned Teachers can mark their enrolled students. Other users can view only records permitted by database policies.</div>}
    <div className="attendance-metrics attendance-live-metrics">
      <div className="metric-card"><span>Attendance rate</span><strong>{attendancePercent}%</strong><small>Present + late; excused excluded</small></div>
      <div className="metric-card"><span>Present</span><strong>{statusCounts.present}<small> / {students.length}</small></strong><small>Selected course and date</small></div>
      <div className="metric-card"><span>Absent</span><strong>{statusCounts.absent}<small> / {students.length}</small></strong><small>Selected course and date</small></div>
      <div className="metric-card"><span>Late</span><strong>{statusCounts.late}<small> / {students.length}</small></strong><small>Selected course and date</small></div>
      <div className="attendance-progress-card"><div><span>Records marked</span><strong>{recordedCount} <small>of {students.length}</small></strong></div><div className="progress-track"><span style={{ width: `${students.length ? Math.min(recordedCount / students.length * 100, 100) : 0}%` }} /></div><small>{statusCounts.excused} excused · {students.length - recordedCount} remaining</small></div>
    </div>
    <div className="panel directory-panel attendance-panel">
      <div className="directory-toolbar attendance-toolbar">
        <div><h2>{reportMode === 'date' ? 'Date-wise attendance' : 'Student-wise report'} <span className="count-pill">{reportMode === 'date' ? dateReportRows.length : studentReportRows.length}</span></h2><p><CalendarDays size={14} /> {selectedCourse ? `${selectedCourse.courseCode} · ${selectedCourse.name}` : 'Select a course to view its enrolled students'}</p></div>
        <div className="toolbar-actions attendance-toolbar-actions">
          <label className="attendance-filter"><span>Date</span><input type="date" value={selectedDate} onChange={(event) => { setSelectedDate(event.target.value); setDataError('') }} aria-label="Attendance date" /></label>
          <label className="attendance-filter"><span>Course</span><select value={selectedCourseId} onChange={(event) => { setSelectedCourseId(event.target.value); setStudents([]); setHistory([]); setDraftStatuses({}); setDataError(''); setLoading(Boolean(event.target.value)) }} disabled={coursesLoading}><option value="">{coursesLoading ? 'Loading courses…' : 'Select course'}</option>{courses.map((course) => <option value={course.id} key={course.id}>{course.courseCode} · {course.name}</option>)}</select></label>
          <label className="attendance-filter"><span>Department</span><select value={departmentFilter} onChange={(event) => { setDepartmentFilter(event.target.value); setSearch('') }}><option>All departments</option>{departments.map((department) => <option key={department}>{department}</option>)}</select>{studentsLoading && !departments.length && <span className="attendance-filter-loading">Loading…</span>}</label>
          <label className="table-search"><Search size={16} /><input className="page-search" placeholder="Search students..." value={search} onChange={(event) => setSearch(event.target.value)} /></label>
          <button className="button button-secondary export-button" onClick={exportReport}><Download size={15} /><span>Export</span></button>
        </div>
      </div>
      <div className="attendance-report-tabs" role="tablist" aria-label="Attendance report type">
        <button className={reportMode === 'date' ? 'attendance-report-tab active' : 'attendance-report-tab'} role="tab" aria-selected={reportMode === 'date'} onClick={() => setReportMode('date')}>By date</button>
        <button className={reportMode === 'student' ? 'attendance-report-tab active' : 'attendance-report-tab'} role="tab" aria-selected={reportMode === 'student'} onClick={() => setReportMode('student')}>By student</button>
        {reportMode === 'student' && <span className="attendance-report-note">Rate = (present + late) ÷ non-excused sessions</span>}
      </div>
      {loading ? <div className="student-loading" role="status">Loading enrolled students and attendance from Supabase…</div>
        : !selectedCourseId ? <div className="empty-state">Select a course to load its enrollment and attendance report.</div>
          : dataError && !students.length ? <div className="student-loading">Attendance records could not be loaded.</div>
            : reportMode === 'date' ? <div className="table-scroll attendance-table-scroll"><table className="data-table attendance-data-table"><thead><tr>{attendanceDateColumns.map((column) => <th key={column.key}>{column.label}</th>)}{canManage && <th className="actions-heading">Mark status</th>}</tr></thead><tbody>{dateReportRows.map((row) => <tr key={row.studentId}><td><div className="person-cell"><div className={`avatar ${avatarTone(row.name)}`}>{initials(row.name)}</div><strong>{row.name}</strong></div></td><td>{row.studentId}</td><td>{row.department || '—'}</td><td>{row.date}</td><td>{row.status ? <StatusBadge status={formatAttendanceStatus(row.status)} /> : <span className="attendance-unmarked">Not marked</span>}</td>{canManage && <td><div className="attendance-status-options" role="group" aria-label={`Attendance status for ${row.name}`}>{attendanceStatuses.map((status) => <button type="button" className={`attendance-status-option ${row.status === status ? `selected ${status}` : ''}`} aria-pressed={row.status === status} key={status} onClick={() => setStudentStatus(row.id, status)}>{formatAttendanceStatus(status)}</button>)}</div></td>}</tr>)}</tbody></table>{!dateReportRows.length && <div className="empty-state">{students.length ? 'No students match the current search or department filter.' : 'No students are enrolled in this course.'}</div>}</div>
              : <DataTable className="attendance-table-scroll" columns={attendanceStudentColumns} rows={studentReportRows} emptyMessage="No students match the current search or department filter." />}
      {!loading && selectedCourseId && <div className="table-pagination"><span>Showing <strong>{reportMode === 'date' ? dateReportRows.length : studentReportRows.length}</strong> of <strong>{students.length}</strong> enrolled students</span><span className="attendance-live"><i /> {reportMode === 'date' ? `${selectedDate} · ${recordedCount} marked` : `${history.length} historical records`}</span></div>}
    </div>
  </>
}

const attendanceStatuses = ['present', 'absent', 'late', 'excused']
const attendanceDateColumns = [
  { key: 'name', label: 'Student' },
  { key: 'studentId', label: 'Student ID' },
  { key: 'department', label: 'Department' },
  { key: 'date', label: 'Date' },
  { key: 'status', label: 'Status' },
]
const attendanceStudentColumns = [
  { key: 'name', label: 'Student' },
  { key: 'studentId', label: 'Student ID' },
  { key: 'department', label: 'Department' },
  { key: 'sessions', label: 'Sessions' },
  { key: 'present', label: 'Present' },
  { key: 'absent', label: 'Absent' },
  { key: 'late', label: 'Late' },
  { key: 'excused', label: 'Excused' },
  { key: 'attendanceRate', label: 'Attendance rate' },
]

function formatAttendanceStatus(status) {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function getLocalDate() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function examTimestamp(exam) {
  const time = exam.time || '23:59'
  return new Date(`${exam.date}T${time}:00`).getTime()
}

function isExamUpcoming(exam) {
  return Number.isFinite(examTimestamp(exam)) && examTimestamp(exam) >= Date.now()
}

function formatDisplayTime(time) {
  if (!time) return 'Time TBD'
  const [hours, minutes] = time.split(':').map(Number)
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return time
  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHour = hours % 12 || 12
  return `${displayHour}:${String(minutes).padStart(2, '0')} ${period}`
}

const DEFAULT_GRADING_RULES = { a: 90, b: 80, c: 70, d: 60 }

function ResultsPage({ students, studentsLoading, studentsError, courses, coursesLoading, coursesError, exams, examsLoading, examsError, userId }) {
  const [resultRows, setResultRows] = useState([])
  const [resultsLoading, setResultsLoading] = useState(true)
  const [resultsError, setResultsError] = useState('')
  const [roleLoading, setRoleLoading] = useState(true)
  const [canManage, setCanManage] = useState(false)
  const [roleError, setRoleError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [courseFilter, setCourseFilter] = useState('All courses')
  const [examFilter, setExamFilter] = useState('All examinations')
  const [gradeFilter, setGradeFilter] = useState('All grades')
  const [page, setPage] = useState(1)
  const [entryTarget, setEntryTarget] = useState(null)
  const [reportStudentId, setReportStudentId] = useState('')
  const [showGradeRules, setShowGradeRules] = useState(false)
  const [storedGradeRules, setStoredGradeRules] = useStoredState('campusflow-grade-rules', DEFAULT_GRADING_RULES)
  const gradeRules = useMemo(() => normalizeGradeRules(storedGradeRules), [storedGradeRules])

  useEffect(() => {
    let active = true
    if (!userId) return () => { active = false }
    fetchResults().then((rows) => {
      if (active) {
        setResultRows(rows)
        setResultsError('')
      }
    }).catch((error) => {
      if (active) setResultsError(explainResultError(error, 'load examination results'))
    }).finally(() => {
      if (active) setResultsLoading(false)
    })
    return () => { active = false }
  }, [userId])

  useEffect(() => {
    let active = true
    fetchStudentRole(userId).then((role) => {
      if (active) setCanManage(role === 'admin')
    }).catch((error) => {
      if (active) {
        setCanManage(false)
        setRoleError(explainResultError(error, 'check result-management permissions'))
      }
    }).finally(() => {
      if (active) setRoleLoading(false)
    })
    return () => { active = false }
  }, [userId])

  useEffect(() => {
    if (!notice) return undefined
    const timeout = window.setTimeout(() => setNotice(''), 4500)
    return () => window.clearTimeout(timeout)
  }, [notice])

  const results = useMemo(() => resultRows.map((row) => {
    const result = toResultRecord(row, students, exams, courses)
    const percentage = result.maxMarks ? result.marks / result.maxMarks * 100 : null
    return {
      ...result,
      percentage,
      percentageLabel: percentage == null ? '—' : `${percentage.toFixed(1)}%`,
      marksLabel: result.maxMarks == null ? String(result.marks) : `${result.marks} / ${result.maxMarks}`,
      grade: percentage == null ? row.grade : gradeForPercentage(percentage, gradeRules),
      status: result.passingMarks == null ? 'Unknown' : result.marks >= result.passingMarks ? 'Pass' : 'Fail',
      courseLabel: result.courseCode ? `${result.courseCode} · ${result.courseName}` : result.courseName || '—',
    }
  }), [resultRows, students, exams, courses, gradeRules])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return results.filter((result) => (
      (!query || `${result.studentName} ${result.studentNumber}`.toLowerCase().includes(query))
      && (courseFilter === 'All courses' || result.courseId === courseFilter)
      && (examFilter === 'All examinations' || result.examId === examFilter)
      && (gradeFilter === 'All grades' || result.grade === gradeFilter)
    ))
  }, [results, search, courseFilter, examFilter, gradeFilter])
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const visibleResults = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const averagePercentage = filtered.filter((result) => result.percentage != null)
  const average = averagePercentage.length
    ? (averagePercentage.reduce((total, result) => total + result.percentage, 0) / averagePercentage.length).toFixed(1)
    : '0.0'
  const gradedPasses = filtered.filter((result) => result.status === 'Pass' || result.status === 'Fail')
  const passPercent = gradedPasses.length
    ? Math.round(gradedPasses.filter((result) => result.status === 'Pass').length / gradedPasses.length * 100)
    : 0
  const resultColumns = [
    { key: 'studentName', label: 'Student', kind: 'person' },
    { key: 'studentNumber', label: 'Student ID' },
    { key: 'courseLabel', label: 'Course' },
    { key: 'examName', label: 'Examination' },
    { key: 'marksLabel', label: 'Marks' },
    { key: 'percentageLabel', label: 'Percentage' },
    { key: 'grade', label: 'Grade', kind: 'status' },
    { key: 'status', label: 'Result', kind: 'status' },
    { key: 'remarks', label: 'Remarks' },
  ]
  const gradeOptions = [...new Set(results.map((result) => result.grade).filter(Boolean))].sort()

  async function saveResults(entries) {
    if (!canManage) throw new Error(explainResultError({ code: '42501' }, 'save examination results'))
    const payload = entries.map((entry) => ({
      student_id: entry.studentId,
      exam_id: entry.examId,
      marks: entry.marks,
      grade: entry.grade,
      remarks: entry.remarks.trim() || null,
    }))
    const { data, error } = await supabase
      .from('results')
      .upsert(payload, { onConflict: 'student_id,exam_id' })
      .select(RESULT_COLUMNS)
    if (error) throw new Error(explainResultError(error, 'save examination results'))
    if (!data || data.length !== entries.length) {
      throw new Error('Supabase did not confirm every result row. Refresh the page to verify saved records.')
    }
    const keys = new Set(data.map((row) => `${row.student_id}:${row.exam_id}`))
    setResultRows((current) => [
      ...data,
      ...current.filter((row) => !keys.has(`${row.student_id}:${row.exam_id}`)),
    ])
    setResultsError('')
    setNotice(`${data.length} result${data.length === 1 ? '' : 's'} saved successfully.`)
  }

  const reportStudent = students.find((student) => student.id === reportStudentId)
  const reportResults = results.filter((result) => result.studentId === reportStudentId)
  const exportRows = filtered

  return <>
    <PageHeading
      eyebrow="ACADEMIC RECORDS"
      title="Results management"
      subtitle="Enter examination marks, review student performance and generate result reports."
      action={<div className="result-heading-actions">{canManage && <button className="button button-primary" onClick={() => setEntryTarget({})}><Plus size={16} /> Enter marks</button>}{canManage && <button className="button button-secondary" onClick={() => setShowGradeRules(true)}><SlidersHorizontal size={15} /> Grade rules</button>}</div>}
    />
    <div className="attendance-metrics results-metrics">
      <div className="metric-card"><span>Results published</span><strong>{resultsLoading ? '…' : filtered.length}</strong><small>Matching current filters</small></div>
      <div className="metric-card"><span>Average percentage</span><strong>{resultsLoading ? '…' : average}<small>%</small></strong><small>Mean of records with maximum marks</small></div>
      <div className="metric-card"><span>Pass percentage</span><strong>{resultsLoading ? '…' : passPercent}<small>%</small></strong><small>Based on each exam’s pass mark</small></div>
      <div className="metric-card"><span>Top grades</span><strong>{filtered.filter((result) => result.grade === 'A').length}</strong><small>Grade A under current rules</small></div>
    </div>
    {notice && <div className="database-success" role="status">{notice}</div>}
    {roleError && <div className="database-error" role="alert">{roleError}</div>}
    {resultsError && <div className="database-error" role="alert">{resultsError}</div>}
    {studentsError && <div className="database-error" role="alert">{studentsError}</div>}
    {coursesError && <div className="database-error" role="alert">{coursesError}</div>}
    {examsError && <div className="database-error" role="alert">{examsError}</div>}
    {!roleLoading && !canManage && !roleError && <div className="database-info" role="status">Read-only results access. Only Admin users can enter or edit marks; database Row Level Security remains enabled.</div>}
    <div className="panel directory-panel">
      <div className="directory-toolbar results-toolbar">
        <div><h2>Student results <span className="count-pill">{filtered.length}</span></h2><p>Search by student name or ID, then filter the result records.</p></div>
        <div className="toolbar-actions">
          <label className="table-search"><Search size={16} /><input className="page-search" placeholder="Search student name or ID..." value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} /></label>
          <div className="filter-select results-filter-select"><SlidersHorizontal size={15} /><select aria-label="Filter results by course" value={courseFilter} onChange={(event) => { setCourseFilter(event.target.value); setPage(1) }}><option>All courses</option>{courses.map((course) => <option value={course.id} key={course.id}>{course.courseCode}</option>)}</select></div>
          <div className="filter-select results-filter-select"><SlidersHorizontal size={15} /><select aria-label="Filter results by examination" value={examFilter} onChange={(event) => { setExamFilter(event.target.value); setPage(1) }}><option>All examinations</option>{exams.map((exam) => <option value={exam.id} key={exam.id}>{exam.name}</option>)}</select></div>
          <div className="filter-select results-filter-select"><SlidersHorizontal size={15} /><select aria-label="Filter results by grade" value={gradeFilter} onChange={(event) => { setGradeFilter(event.target.value); setPage(1) }}><option>All grades</option>{gradeOptions.map((grade) => <option key={grade}>{grade}</option>)}</select></div>
          <button className="button button-secondary export-button" onClick={() => downloadCsv(exportRows, resultColumns, 'results.csv')}><Download size={15} /><span>Export</span></button>
        </div>
      </div>
      {resultsLoading || studentsLoading || coursesLoading || examsLoading
        ? <div className="student-loading" role="status">Loading students, examinations and results from Supabase…</div>
        : resultsError && !results.length
          ? <div className="student-loading">Result records could not be loaded.</div>
          : <DataTable
            className="results-table"
            columns={resultColumns}
            rows={visibleResults}
            onView={(row) => setReportStudentId(row.studentId)}
            viewLabel="View report"
            onEdit={canManage ? (row) => setEntryTarget(row) : undefined}
            emptyMessage={results.length ? 'No results match your search or filters.' : 'No examination results have been entered yet.'}
          />}
      {!resultsLoading && <Pagination page={currentPage} pageCount={pageCount} total={filtered.length} onPageChange={setPage} noun="results" />}
    </div>
    {entryTarget && <ResultEntryModal
      courses={courses}
      coursesLoading={coursesLoading}
      exams={exams}
      results={results}
      gradeRules={gradeRules}
      initialResult={entryTarget.id ? entryTarget : null}
      onClose={() => setEntryTarget(null)}
      onSave={saveResults}
    />}
    {showGradeRules && <GradeRulesModal
      gradeRules={gradeRules}
      onClose={() => setShowGradeRules(false)}
      onSave={(rules) => { setStoredGradeRules(rules); setShowGradeRules(false); setNotice('Grading rules updated. Result grades and previews now use the new thresholds.') }}
    />}
    {reportStudent && <StudentResultReport
      student={reportStudent}
      results={reportResults}
      onClose={() => setReportStudentId('')}
    />}
  </>
}

function ResultEntryModal({ courses, coursesLoading, exams, results, gradeRules, initialResult, onClose, onSave }) {
  const [courseId, setCourseId] = useState(initialResult?.courseId || '')
  const [examId, setExamId] = useState(initialResult?.examId || '')
  const [enrolledStudents, setEnrolledStudents] = useState([])
  const [studentsLoading, setStudentsLoading] = useState(Boolean(initialResult?.courseId))
  const [studentsError, setStudentsError] = useState('')
  const [drafts, setDrafts] = useState({})
  const [dirty, setDirty] = useState({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const selectedExam = exams.find((exam) => exam.id === examId)
  const examOptions = exams.filter((exam) => exam.courseId === courseId)
  const maximum = selectedExam?.maxMarks === '' || selectedExam?.maxMarks == null
    ? null
    : Number(selectedExam.maxMarks)
  const passing = selectedExam?.passingMarks === '' || selectedExam?.passingMarks == null
    ? null
    : Number(selectedExam.passingMarks)
  const hasMarkLimits = Number.isFinite(maximum) && maximum > 0
    && Number.isFinite(passing) && passing >= 0 && passing <= maximum

  useEffect(() => {
    let active = true
    if (!courseId) {
      return () => { active = false }
    }
    fetchCourseResultStudents(courseId).then((records) => {
      if (active) setEnrolledStudents(records)
    }).catch((loadError) => {
      if (active) setStudentsError(explainResultError(loadError, 'load course students'))
    }).finally(() => {
      if (active) setStudentsLoading(false)
    })
    return () => { active = false }
  }, [courseId])

  function updateDraft(studentId, key, value) {
    setDrafts((current) => ({
      ...current,
      [studentId]: { ...current[studentId], [key]: value },
    }))
    setDirty((current) => ({ ...current, [studentId]: true }))
    setError('')
  }

  async function persist(studentIds) {
    if (!selectedExam || !hasMarkLimits) {
      setError('Choose an examination with valid maximum and passing marks before entering results.')
      return
    }
    const entries = []
    for (const studentId of studentIds) {
      const draft = drafts[studentId]
      const marks = Number(draft?.marks)
      if (!draft || draft.marks.trim() === '' || !Number.isFinite(marks) || marks < 0 || marks > maximum
        || !hasTwoDecimalPlaces(marks)) {
        setError(`Enter marks between 0 and ${maximum} with at most two decimal places for every changed student.`)
        return
      }
      if (draft.remarks.length > 1000) {
        setError('Remarks must be 1,000 characters or fewer.')
        return
      }
      const percentage = marks / maximum * 100
      entries.push({
        studentId,
        examId: selectedExam.id,
        marks,
        grade: gradeForPercentage(percentage, gradeRules),
        remarks: draft.remarks,
      })
    }
    if (!entries.length) {
      setError('Enter or update marks for at least one student before saving.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSave(entries)
      setDirty((current) => Object.fromEntries(Object.entries(current).filter(([id]) => !studentIds.includes(id))))
    } catch (saveError) {
      setError(saveError.message || 'The result records could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  function saveAll() {
    return persist(Object.keys(dirty).filter((studentId) => dirty[studentId]))
  }

  return <Modal className="result-entry-modal" title="Enter examination results" subtitle="Select a course and examination, then enter or update marks for its students." onClose={onClose}>
    <div className="result-entry-content">
      <div className="modal-fields result-entry-selectors">
        <label>Course<select value={courseId} disabled={coursesLoading || saving} onChange={(event) => { setCourseId(event.target.value); setExamId(''); setEnrolledStudents([]); setStudentsLoading(Boolean(event.target.value)); setStudentsError(''); setDrafts({}); setDirty({}); setError('') }}><option value="">{coursesLoading ? 'Loading courses…' : 'Select course'}</option>{courses.map((course) => <option value={course.id} key={course.id}>{course.courseCode} · {course.name}</option>)}</select></label>
        <label>Examination<select value={examId} disabled={!courseId || saving} onChange={(event) => { setExamId(event.target.value); setDrafts({}); setDirty({}); setError('') }}><option value="">Select examination</option>{examOptions.map((exam) => <option value={exam.id} key={exam.id}>{exam.name} · {exam.date}</option>)}</select></label>
      </div>
      {selectedExam && !hasMarkLimits && <div className="database-info" role="status">This examination has no valid maximum and passing marks. Update its examination details before entering results.</div>}
      {studentsError && <div className="database-error" role="alert">{studentsError}</div>}
      {error && <div className="form-error" role="alert">{error}</div>}
      {studentsLoading ? <div className="student-loading" role="status">Loading students associated with this course…</div>
        : !courseId ? <div className="empty-state">Choose a course to load its students.</div>
          : !examId ? <div className="empty-state">Choose an examination to enter student marks.</div>
            : studentsError ? null
              : !enrolledStudents.length ? <div className="empty-state">No students are assigned or enrolled in this course.</div>
                : <div className="table-scroll result-entry-table-scroll"><table className="data-table result-entry-table"><thead><tr><th>Student</th><th>Student ID</th><th>Marks</th><th>Maximum</th><th>Percentage</th><th>Grade</th><th>Result</th><th>Remarks</th><th>Action</th></tr></thead><tbody>{enrolledStudents.map((student) => {
                  const saved = results.find((result) => result.studentId === student.id && result.examId === examId)
                  const draft = drafts[student.id] || { marks: saved ? String(saved.marks) : '', remarks: saved?.remarks || '' }
                  const parsedValue = draft.marks.trim() === '' ? null : Number(draft.marks)
                  const value = Number.isFinite(parsedValue) ? parsedValue : null
                  const percentage = value != null && maximum ? value / maximum * 100 : null
                  const grade = percentage == null ? '—' : gradeForPercentage(percentage, gradeRules)
                  const status = value == null || passing == null ? '—' : value >= passing ? 'Pass' : 'Fail'
                  return <tr key={student.id}>
                    <td><div className="person-cell"><div className={`avatar ${avatarTone(student.name)}`}>{initials(student.name)}</div><strong>{student.name}</strong></div></td>
                    <td>{student.studentId}</td>
                    <td><input className="result-marks-input" type="number" min="0" max={maximum || undefined} step="0.01" value={draft.marks} disabled={!hasMarkLimits || saving} onChange={(event) => updateDraft(student.id, 'marks', event.target.value)} aria-label={`Marks for ${student.name}`} /></td>
                    <td>{maximum ?? '—'}</td>
                    <td>{percentage == null ? '—' : `${percentage.toFixed(1)}%`}</td>
                    <td><StatusBadge status={grade} /></td>
                    <td>{status === '—' ? '—' : <StatusBadge status={status} />}</td>
                    <td><input className="result-remarks-input" maxLength="1000" value={draft.remarks} disabled={!hasMarkLimits || saving} onChange={(event) => updateDraft(student.id, 'remarks', event.target.value)} aria-label={`Remarks for ${student.name}`} placeholder="Optional" /></td>
                    <td><button className="button button-secondary result-row-save" disabled={!dirty[student.id] || !hasMarkLimits || saving} onClick={() => persist([student.id])}>{saving && dirty[student.id] ? 'Saving…' : 'Save'}</button></td>
                  </tr>
                })}</tbody></table></div>}
      <div className="modal-actions"><button className="button button-secondary" type="button" onClick={onClose} disabled={saving}>Close</button><button className="button button-primary" type="button" onClick={saveAll} disabled={saving || !Object.values(dirty).some(Boolean) || !hasMarkLimits}>{saving ? 'Saving…' : 'Save changed results'}</button></div>
    </div>
  </Modal>
}

function GradeRulesModal({ gradeRules, onClose, onSave }) {
  const [form, setForm] = useState(Object.fromEntries(Object.entries(gradeRules).map(([grade, value]) => [grade, String(value)])))
  const [error, setError] = useState('')
  function submit(event) {
    event.preventDefault()
    const rules = Object.fromEntries(Object.entries(form).map(([grade, value]) => [grade, Number(value)]))
    if (Object.values(form).some((value) => value.trim() === '')
      || Object.values(rules).some((value) => !Number.isInteger(value) || value < 0 || value > 100)
      || !(rules.a > rules.b && rules.b > rules.c && rules.c > rules.d)) {
      setError('Enter whole-number percentage thresholds from 0 to 100 in descending order (A > B > C > D).')
      return
    }
    onSave(rules)
  }
  return <Modal title="Configure grading rules" subtitle="Set the minimum percentage for each grade. Students below D receive an F." onClose={onClose}>
    <form className="modal-form" onSubmit={submit} noValidate>
      <div className="modal-fields grade-rule-fields">{Object.entries(form).map(([grade, value]) => <label key={grade}>Minimum percentage for grade {grade.toUpperCase()}<input type="number" min="0" max="100" step="1" value={value} onChange={(event) => { setForm((current) => ({ ...current, [grade]: event.target.value })); setError('') }} /></label>)}</div>
      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="modal-actions"><button className="button button-secondary" type="button" onClick={onClose}>Cancel</button><button className="button button-primary" type="submit">Save grading rules</button></div>
    </form>
  </Modal>
}

function StudentResultReport({ student, results, onClose }) {
  const scoredResults = results.filter((result) => result.percentage != null)
  const average = scoredResults.length
    ? scoredResults.reduce((total, result) => total + result.percentage, 0) / scoredResults.length
    : null
  const reportColumns = [
    { key: 'examName', label: 'Examination' },
    { key: 'courseLabel', label: 'Course' },
    { key: 'marksLabel', label: 'Marks' },
    { key: 'percentageLabel', label: 'Percentage' },
    { key: 'grade', label: 'Grade' },
    { key: 'status', label: 'Result' },
    { key: 'remarks', label: 'Remarks' },
  ]
  return <Modal className="results-report-modal" title="Student result report" subtitle="Academic examination performance summary." onClose={onClose}>
    <div className="result-printable">
      <div className="result-report-header"><div className={`profile-large-avatar ${avatarTone(student.name)}`}>{initials(student.name)}</div><div><h3>{student.name}</h3><span>{student.studentId}</span><p>{student.department || 'Department not listed'}</p></div></div>
      <div className="result-report-summary"><div><span>Examinations</span><strong>{results.length}</strong></div><div><span>Average percentage</span><strong>{average == null ? '—' : `${average.toFixed(1)}%`}</strong></div><div><span>Pass</span><strong>{results.filter((result) => result.status === 'Pass').length}</strong></div><div><span>Fail</span><strong>{results.filter((result) => result.status === 'Fail').length}</strong></div></div>
      <DataTable columns={reportColumns} rows={results} emptyMessage="No examination results are available for this student." />
    </div>
    <div className="modal-actions"><button className="button button-secondary" onClick={onClose}>Close</button><button className="button button-primary" onClick={() => window.print()}><Download size={15} /> Print report</button></div>
  </Modal>
}

function normalizeGradeRules(value) {
  const rules = Object.fromEntries(Object.keys(DEFAULT_GRADING_RULES).map((grade) => [grade, Number(value?.[grade])]))
  const thresholds = Object.values(rules)
  return thresholds.every((threshold) => Number.isInteger(threshold) && threshold >= 0 && threshold <= 100)
    && rules.a > rules.b && rules.b > rules.c && rules.c > rules.d
    ? rules
    : DEFAULT_GRADING_RULES
}

function gradeForPercentage(percentage, rules) {
  if (percentage >= rules.a) return 'A'
  if (percentage >= rules.b) return 'B'
  if (percentage >= rules.c) return 'C'
  if (percentage >= rules.d) return 'D'
  return 'F'
}

function hasTwoDecimalPlaces(value) {
  return Math.abs(value * 100 - Math.round(value * 100)) < 0.000001
}

function SettingsPage({ user }) {
  const [name, setName] = useState(() => localStorage.getItem('campusflow-admin-name') || userDisplayName(user))
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileError, setProfileError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [preferences, setPreferences] = useStoredState('campusflow-notifications', { emailUpdates: true, attendanceAlerts: true, weeklyDigest: false })
  const [profilePhoto, setProfilePhoto] = useStoredState('campusflow-profile-photo', '')
  const [photoError, setPhotoError] = useState('')
  const photoInput = useRef(null)
  const roleLabel = profile?.role
    ? ({ admin: 'Administrator', teacher: 'Teacher', student: 'Student' }[profile.role] || profile.role)
    : profileLoading ? 'Loading…' : 'Unavailable'

  useEffect(() => {
    let active = true
    supabase.from('profiles')
      .select('full_name, role')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return
        if (error) {
          setProfileError(`Could not load your account profile: ${error.message}`)
          return
        }
        if (!data) {
          setProfileError('Your account profile is not available. Ask a project administrator to check the Supabase profiles table.')
          return
        }
        setProfile(data)
        setName(data.full_name || userDisplayName(user))
      })
      .catch((error) => {
        if (active) setProfileError(`Could not load your account profile: ${error.message || 'An unexpected database error occurred.'}`)
      })
      .finally(() => {
        if (active) setProfileLoading(false)
      })
    return () => { active = false }
  }, [user])

  async function save(event) {
    event.preventDefault()
    if (!name.trim() || !profile || saving) return
    setSaving(true)
    setProfileError('')
    setSaved(false)
    const savedName = name.trim()
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({ full_name: savedName })
        .eq('id', user.id)
        .select('full_name, role')
        .maybeSingle()
      if (error) throw error
      if (!data) throw new Error('Supabase did not confirm the profile update. Check your account permissions and retry.')
      setProfile(data)
      setName(data.full_name)
      let storageWarning = ''
      try {
        localStorage.setItem('campusflow-admin-name', data.full_name)
      } catch (storageError) {
        storageWarning = `Your profile was saved to Supabase, but the display name could not be cached locally: ${storageError.message}`
      }
      window.dispatchEvent(new CustomEvent('campusflow-profile-updated', { detail: { fullName: data.full_name } }))
      setSaved(true)
      if (storageWarning) setProfileError(storageWarning)
      window.setTimeout(() => setSaved(false), 2500)
    } catch (error) {
      setProfileError(`Could not save your profile: ${error.message || 'An unexpected database error occurred.'}`)
    } finally {
      setSaving(false)
    }
  }
  function selectPhoto(event) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setPhotoError('Choose an image file to update your photo.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setPhotoError('Choose an image smaller than 2 MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setProfilePhoto(reader.result)
        setPhotoError('')
      }
    }
    reader.onerror = () => setPhotoError('The selected image could not be read.')
    reader.readAsDataURL(file)
  }
  return <>
    <PageHeading eyebrow="YOUR WORKSPACE" title="Settings" subtitle="Manage your profile, notifications and workspace preferences." />
    {profileError && <div className="database-error" role="alert">{profileError}</div>}
    <div className="settings-layout">
      <nav className="settings-nav"><a className="settings-nav-active" href="#profile"><UserRound size={17} /> Profile</a><a href="#notifications"><Bell size={17} /> Notifications</a><a href="#preferences"><SlidersHorizontal size={17} /> Preferences</a></nav>
      <div className="settings-content">
        <form className="panel settings-card" id="profile" onSubmit={save}><div className="settings-card-heading"><div><h2>Profile information</h2><p>Update your display name and review your account details.</p></div></div><div className="profile-edit-row"><div className="profile-large-avatar">{profilePhoto ? <img src={profilePhoto} alt="Profile" /> : initials(name)}</div><div><strong>Profile photo</strong><p>Shown across your CampusFlow workspace.</p><button type="button" className="text-button" onClick={() => photoInput.current?.click()}>Change photo</button><input ref={photoInput} className="visually-hidden" type="file" accept="image/*" aria-label="Upload profile photo" onChange={selectPhoto} />{photoError && <small className="form-error" role="alert">{photoError}</small>}</div></div><div className="settings-fields"><label>Full name<input required value={name} onChange={(event) => setName(event.target.value)} disabled={profileLoading || !profile || saving} /></label><label>Email address<input type="email" value={user.email || ''} readOnly /></label><label>Role<input value={roleLabel} readOnly /></label><label>Workspace<input value="CampusFlow" readOnly /></label></div><div className="settings-save-row"><span>{saved && <span className="save-confirmation"><Check size={14} /> Changes saved</span>}</span><button className="button button-primary" type="submit" disabled={profileLoading || !profile || saving}>{saving ? 'Saving…' : 'Save changes'}</button></div></form>
        <section className="panel settings-card" id="notifications"><div className="settings-card-heading"><div><h2>Notifications</h2><p>Choose the updates you’d like to receive.</p></div></div><div className="preference-list" id="preferences">{[['emailUpdates', 'Email updates', 'Receive important college updates by email.'], ['attendanceAlerts', 'Attendance alerts', 'Get notified when attendance needs attention.'], ['weeklyDigest', 'Weekly digest', 'A weekly summary of your campus activity.']].map(([key, title, caption]) => <label className="preference-item" key={key}><span><strong>{title}</strong><small>{caption}</small></span><input type="checkbox" checked={preferences[key]} onChange={(event) => setPreferences((current) => ({ ...current, [key]: event.target.checked }))} /></label>)}</div></section>
      </div>
    </div>
  </>
}

function Pagination({ page, pageCount, total, onPageChange, noun }) {
  const start = total ? (page - 1) * PAGE_SIZE + 1 : 0
  const end = Math.min(page * PAGE_SIZE, total)
  return <div className="table-pagination"><span>Showing <strong>{start}–{end}</strong> of <strong>{total}</strong> {noun}</span><div><button className="page-button" disabled={page === 1} aria-label="Previous page" onClick={() => onPageChange(page - 1)}><ChevronLeft size={16} /></button><span className="page-number current-page" aria-current="page">{page}</span><button className="page-button" disabled={page >= pageCount} aria-label="Next page" onClick={() => onPageChange(page + 1)}><ChevronRight size={16} /></button></div></div>
}

function DataTable({ columns, rows, onEdit, onDelete, onView, viewLabel = 'View profile', emptyMessage, className = '' }) {
  const hasActions = onView || onEdit || onDelete
  return <div className={`table-scroll ${className}`}><table className="data-table"><thead><tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}{hasActions && <th className="actions-heading">Actions</th>}</tr></thead><tbody>{rows.map((row) => <tr key={row.id}>{columns.map((column) => <td key={column.key}>{column.kind === 'person' ? <button className="person-cell person-link" onClick={() => onView ? onView(row) : onEdit?.(row)}><div className={`avatar ${avatarTone(row.name || row.studentName)}`}>{initials(row.name || row.studentName)}</div><strong>{row.name || row.studentName}</strong></button> : column.kind === 'status' ? <StatusBadge status={row[column.key]} /> : row[column.key] || '—'}</td>)}{hasActions && <td><div className="row-actions">{onView && <button title={viewLabel} aria-label={`${viewLabel} for ${row.name || row.studentName || ''}`} onClick={() => onView(row)}><UserRound size={15} /></button>}{onEdit && <button title="Edit record" onClick={() => onEdit(row)}><FileText size={15} /></button>}{onDelete && <button title="Delete record" className="delete-action" onClick={() => onDelete(row)}><Trash2 size={15} /></button>}</div></td>}</tr>)}</tbody></table>{!rows.length && <div className="empty-state">{emptyMessage}</div>}</div>
}

function StudentModal({ student, students, departments, courses, onClose, onSave }) {
  const [form, setForm] = useState(student ? {
    ...student,
    phone: student.phone || '',
    gender: student.gender || '',
    dateOfBirth: student.dateOfBirth || '',
    courseId: student.courseId || '',
    address: student.address || '',
  } : {
    name: '',
    studentId: '',
    email: '',
    phone: '',
    gender: '',
    dateOfBirth: '',
    department: '',
    courseId: '',
    yearOfStudy: '',
    admissionYear: '',
    address: '',
  })
  const [departmentChoice, setDepartmentChoice] = useState(() => (
    student?.department && departments.includes(student.department) ? student.department : student?.department ? OTHER_OPTION : ''
  ))
  const [manualDepartment, setManualDepartment] = useState(() => (
    student?.department && !departments.includes(student.department) ? student.department : ''
  ))
  const [courseChoice, setCourseChoice] = useState(() => (
    student?.courseId && courses.some((course) => course.id === student.courseId)
      ? student.courseId
      : student?.courseName || student?.courseId
        ? OTHER_OPTION
        : ''
  ))
  const [manualCourseName, setManualCourseName] = useState(student?.courseName || '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [today] = useState(() => {
    const date = new Date()
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  })
  function update(key, value) { setForm((current) => ({ ...current, [key]: value })) }
  async function submit(event) {
    event.preventDefault()
    const normalized = {
      ...form,
      name: form.name.trim(),
      studentId: form.studentId.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim(),
      department: (departmentChoice === OTHER_OPTION ? manualDepartment : departmentChoice).trim(),
      courseId: courseChoice && courseChoice !== OTHER_OPTION ? courseChoice : '',
      courseName: courseChoice === OTHER_OPTION ? manualCourseName.trim() : '',
      address: form.address.trim(),
    }
    const year = Number(normalized.yearOfStudy)
    const admissionYear = Number(normalized.admissionYear)
    if (!normalized.name || !normalized.studentId || !normalized.email || !normalized.phone
      || !normalized.gender || !normalized.dateOfBirth || !normalized.department
      || !courseChoice || (!normalized.courseId && !normalized.courseName)
      || !normalized.yearOfStudy || !normalized.admissionYear || !normalized.address) {
      setError('Complete all required student details, including department and course.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.email)) {
      setError('Enter a valid email address.')
      return
    }
    if (normalized.dateOfBirth > today) {
      setError('Date of birth cannot be in the future.')
      return
    }
    if (!Number.isInteger(year) || year < 1 || year > 12) { setError('Choose a valid year of study.'); return }
    if (!Number.isInteger(admissionYear) || admissionYear < 2020 || admissionYear > 2030) { setError('Choose an admission year between 2020 and 2030.'); return }
    const duplicate = students.some((item) => item.id !== student?.id
      && (item.studentId.toLowerCase() === normalized.studentId.toLowerCase()
        || item.email.toLowerCase() === normalized.email.toLowerCase()))
    if (duplicate) { setError('A student with this ID or email already exists.'); return }
    setSaving(true)
    setError('')
    try {
      await onSave(normalized)
    } catch (saveError) {
      setError(saveError.message || 'The student record could not be saved.')
      setSaving(false)
    }
  }
  return <Modal className="student-form-modal" title={student ? 'Edit student' : 'Add a student'} subtitle={student ? 'Update this student’s details.' : 'Add a new student to your college directory.'} onClose={onClose}><form className="modal-form" onSubmit={submit} noValidate><div className="modal-fields student-modal-fields">
    <label>Student ID<input autoFocus required maxLength={80} value={form.studentId} onChange={(event) => update('studentId', event.target.value)} placeholder="e.g. STU-2025-009" /></label>
    <label>Full name<input required maxLength={150} value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="e.g. Jamie Parker" /></label>
    <label>Email<input type="email" required maxLength={254} value={form.email} onChange={(event) => update('email', event.target.value)} placeholder="student@college.edu" /></label>
    <label>Phone number<input type="tel" required maxLength={40} value={form.phone} onChange={(event) => update('phone', event.target.value)} placeholder="+1 555 0100" /></label>
    <label>Gender<select required value={form.gender} onChange={(event) => update('gender', event.target.value)}><option value="">Select gender</option>{['Female', 'Male', 'Non-binary', 'Other', 'Prefer not to say'].map((gender) => <option key={gender}>{gender}</option>)}</select></label>
    <label>Date of birth<input type="date" required max={today} value={form.dateOfBirth} onChange={(event) => update('dateOfBirth', event.target.value)} /></label>
    <label>Department<select required value={departmentChoice} onChange={(event) => setDepartmentChoice(event.target.value)}><option value="">Select department</option>{departments.map((department) => <option value={department} key={department}>{department}</option>)}<option value={OTHER_OPTION}>Other / Add New Department</option></select></label>
    {departmentChoice === OTHER_OPTION && <label>New department<input required maxLength={100} value={manualDepartment} onChange={(event) => setManualDepartment(event.target.value)} placeholder="Enter department name" /></label>}
    <label>Course<select required value={courseChoice} onChange={(event) => setCourseChoice(event.target.value)}><option value="">Select course</option>{courses.map((course) => <option value={course.id} key={course.id}>{course.course_code} · {course.name}</option>)}<option value={OTHER_OPTION}>Other / Add New Course</option></select></label>
    {courseChoice === OTHER_OPTION && <label>New course name<input required maxLength={150} value={manualCourseName} onChange={(event) => setManualCourseName(event.target.value)} placeholder="Enter course name" /></label>}
    <label>Year of study<select required value={form.yearOfStudy} onChange={(event) => update('yearOfStudy', event.target.value)}><option value="">Select year of study</option>{['1st Year', '2nd Year', '3rd Year', '4th Year'].map((year, index) => <option value={String(index + 1)} key={year}>{year}</option>)}{Number(form.yearOfStudy) > 4 && <option value={String(form.yearOfStudy)}>{form.yearOfStudyLabel || `${form.yearOfStudy}th Year`} (existing)</option>}</select></label>
    <label>Admission year<select required value={form.admissionYear} onChange={(event) => update('admissionYear', event.target.value)}><option value="">Select admission year</option>{Array.from({ length: 11 }, (_, index) => String(2020 + index)).map((year) => <option key={year}>{year}</option>)}</select></label>
    <label className="student-address-field">Address<textarea required maxLength={500} rows={2} value={form.address} onChange={(event) => update('address', event.target.value)} placeholder="Enter the student's mailing address" /></label>
  </div>{error && <div className="form-error" role="alert">{error}</div>}<div className="modal-actions"><button className="button button-secondary" type="button" onClick={onClose} disabled={saving}>Cancel</button><button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : student ? 'Save changes' : 'Save Student'}</button></div></form></Modal>
}

function TeacherModal({ teacher, teachers, onClose, onSave }) {
  const [form, setForm] = useState(teacher ? {
    ...teacher,
    phone: teacher.phone || '',
    gender: teacher.gender || '',
    dateOfBirth: teacher.dateOfBirth || '',
    department: teacher.department || '',
    designation: teacher.designation || '',
    qualification: teacher.qualification || '',
    joiningDate: teacher.joiningDate || '',
    address: teacher.address || '',
    subjects: teacher.subjects || [],
  } : {
    teacherId: '',
    name: '',
    email: '',
    phone: '',
    gender: '',
    dateOfBirth: '',
    department: '',
    designation: '',
    qualification: '',
    joiningDate: '',
    address: '',
    subjects: [],
  })
  const [subjectsInput, setSubjectsInput] = useState(() => (teacher?.subjects || []).join(', '))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [today] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  })

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function submit(event) {
    event.preventDefault()
    const normalized = {
      ...form,
      teacherId: form.teacherId.trim(),
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim(),
      department: form.department.trim(),
      designation: form.designation.trim(),
      qualification: form.qualification.trim(),
      address: form.address.trim(),
      subjects: [...new Set(subjectsInput.split(',').map((subject) => subject.trim()).filter(Boolean))],
    }
    if (!normalized.teacherId || !normalized.name || !normalized.email || !normalized.department || !normalized.designation) {
      setError('Teacher ID, full name, email, department and designation are required.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.email)) {
      setError('Enter a valid email address.')
      return
    }
    if (normalized.dateOfBirth && normalized.dateOfBirth > today) {
      setError('Date of birth cannot be in the future.')
      return
    }
    if (normalized.joiningDate && normalized.joiningDate > today) {
      setError('Joining date cannot be in the future.')
      return
    }
    const duplicate = teachers.some((item) => item.id !== teacher?.id
      && item.teacherId.toLowerCase() === normalized.teacherId.toLowerCase())
    if (duplicate) {
      setError('A teacher with this ID already exists.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSave(normalized)
    } catch (saveError) {
      setError(saveError.message || 'The teacher record could not be saved.')
      setSaving(false)
    }
  }

  return <Modal className="teacher-form-modal" title={teacher ? 'Edit teacher' : 'Add a teacher'} subtitle={teacher ? 'Update this teacher’s profile.' : 'Add a faculty member to your college directory.'} onClose={onClose}>
    <form className="modal-form" onSubmit={submit} noValidate>
      <div className="modal-fields teacher-modal-fields">
        <label>Teacher ID<input autoFocus required maxLength={80} value={form.teacherId} onChange={(event) => update('teacherId', event.target.value)} placeholder="e.g. TCH-0046" /></label>
        <label>Full name<input required maxLength={150} value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="e.g. Dr. Taylor Morgan" /></label>
        <label>Email<input type="email" required maxLength={254} value={form.email} onChange={(event) => update('email', event.target.value)} placeholder="teacher@college.edu" /></label>
        <label>Phone number<input type="tel" maxLength={40} value={form.phone} onChange={(event) => update('phone', event.target.value)} placeholder="+1 555 0100" /></label>
        <label>Gender<select value={form.gender} onChange={(event) => update('gender', event.target.value)}><option value="">Select gender (optional)</option>{['Female', 'Male', 'Non-binary', 'Other', 'Prefer not to say'].map((gender) => <option key={gender}>{gender}</option>)}</select></label>
        <label>Date of birth<input type="date" max={today} value={form.dateOfBirth} onChange={(event) => update('dateOfBirth', event.target.value)} /></label>
        <label>Department<input required maxLength={100} value={form.department} onChange={(event) => update('department', event.target.value)} placeholder="e.g. Engineering" /></label>
        <label>Designation<input required maxLength={120} value={form.designation} onChange={(event) => update('designation', event.target.value)} placeholder="e.g. Associate Professor" /></label>
        <label>Qualification<input maxLength={200} value={form.qualification} onChange={(event) => update('qualification', event.target.value)} placeholder="e.g. Ph.D. Computer Science" /></label>
        <label>Joining date<input type="date" max={today} value={form.joiningDate} onChange={(event) => update('joiningDate', event.target.value)} /></label>
        <label className="teacher-subjects-field">Subjects<input maxLength={500} value={subjectsInput} onChange={(event) => setSubjectsInput(event.target.value)} placeholder="Comma-separated subjects" /></label>
        <label className="teacher-address-field">Address<textarea maxLength={500} rows={2} value={form.address} onChange={(event) => update('address', event.target.value)} placeholder="Optional mailing address" /></label>
      </div>
      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="modal-actions"><button className="button button-secondary" type="button" onClick={onClose} disabled={saving}>Cancel</button><button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : teacher ? 'Save changes' : 'Save teacher'}</button></div>
    </form>
  </Modal>
}

function TeacherProfile({ teacher, canEdit, onClose, onEdit }) {
  return <Modal title="Teacher profile" subtitle="Faculty record and professional details." onClose={onClose}>
    <div className="student-profile">
      <div className="profile-identity"><div className={`profile-large-avatar ${avatarTone(teacher.name)}`}>{initials(teacher.name)}</div><div><h3>{teacher.name}</h3><span>{teacher.teacherId}</span></div></div>
      <div className="profile-details">
        <div><span>Email address</span><strong>{teacher.email}</strong></div>
        <div><span>Phone</span><strong>{teacher.phone || '—'}</strong></div>
        <div><span>Gender</span><strong>{teacher.gender || '—'}</strong></div>
        <div><span>Date of birth</span><strong>{teacher.dateOfBirth || '—'}</strong></div>
        <div><span>Department</span><strong>{teacher.department || '—'}</strong></div>
        <div><span>Designation</span><strong>{teacher.designation || '—'}</strong></div>
        <div><span>Qualification</span><strong>{teacher.qualification || '—'}</strong></div>
        <div><span>Joining date</span><strong>{teacher.joiningDate || '—'}</strong></div>
        <div><span>Subjects</span><strong>{teacher.subjects.length ? teacher.subjects.join(', ') : '—'}</strong></div>
        <div><span>Address</span><strong>{teacher.address || '—'}</strong></div>
      </div>
      <div className="modal-actions"><button className="button button-secondary" onClick={onClose}>Close</button>{canEdit && <button className="button button-primary" onClick={onEdit}><FileText size={15} /> Edit teacher</button>}</div>
    </div>
  </Modal>
}

function ExamModal({ exam, courses, exams, onClose, onSave }) {
  const [form, setForm] = useState(exam ? {
    ...exam,
    type: exam.type || 'Internal',
    time: exam.time || '',
    durationMinutes: exam.durationMinutes || '',
    maxMarks: exam.maxMarks || '',
    passingMarks: exam.passingMarks || '',
    description: exam.description || '',
  } : {
    name: '',
    subject: '',
    courseId: '',
    date: '',
    type: 'Internal',
    time: '',
    durationMinutes: '',
    maxMarks: '',
    passingMarks: '',
    description: '',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const selectedCourse = courses.find((course) => course.id === form.courseId)

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
    setError('')
  }

  async function submit(event) {
    event.preventDefault()
    const normalized = {
      ...form,
      name: form.name.trim(),
      subject: form.subject.trim(),
      date: form.date.trim(),
      time: form.time.trim(),
      description: form.description.trim(),
    }
    const duration = Number(form.durationMinutes)
    const maximum = Number(form.maxMarks)
    const passing = Number(form.passingMarks)
    if (!normalized.name || !normalized.subject || !normalized.courseId || !normalized.date
      || !normalized.time || !form.durationMinutes || !form.maxMarks || !form.passingMarks) {
      setError('Complete the examination name, subject, course, date, time, duration and marks.')
      return
    }
    if (!isValidExamDate(normalized.date)) {
      setError('Enter a valid examination date.')
      return
    }
    if (!examinationTypes.includes(form.type)) {
      setError('Choose a valid examination type.')
      return
    }
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(normalized.time)) {
      setError('Enter a valid examination start time.')
      return
    }
    if (!Number.isInteger(duration) || duration < 1 || duration > 1440) {
      setError('Duration must be a whole number between 1 and 1440 minutes.')
      return
    }
    const hasTwoDecimalPlaces = (value) => Math.abs(value * 100 - Math.round(value * 100)) < 0.000001
    if (!Number.isFinite(maximum) || maximum <= 0 || maximum > 99999.99
      || !hasTwoDecimalPlaces(maximum)
      || !Number.isFinite(passing) || passing < 0
      || !hasTwoDecimalPlaces(passing) || passing > maximum) {
      setError('Maximum marks must be positive (up to 99999.99), and passing marks must be between zero and the maximum with at most two decimals.')
      return
    }
    if (!courses.some((course) => course.id === normalized.courseId)) {
      setError('Select a course that is available to your account.')
      return
    }
    const duplicate = exams.some((item) => item.id !== exam?.id
      && item.courseId === normalized.courseId
      && item.date === normalized.date
      && item.time === normalized.time
      && item.name.toLowerCase() === normalized.name.toLowerCase())
    if (duplicate) {
      setError('An examination with this name is already scheduled for this course at that date and time.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSave(normalized)
    } catch (saveError) {
      setError(saveError.message || 'The examination could not be saved.')
      setSaving(false)
    }
  }

  return <Modal className="exam-form-modal" title={exam ? 'Edit examination' : 'Schedule an examination'} subtitle={exam ? 'Update this examination schedule and grading details.' : 'Add an examination to a course schedule.'} onClose={onClose}>
    <form className="modal-form" onSubmit={submit} noValidate>
      <div className="modal-fields exam-modal-fields">
        <label>Examination name<input autoFocus required maxLength={200} value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="e.g. Midterm Examination" /></label>
        <label>Subject<input required maxLength={160} value={form.subject} onChange={(event) => update('subject', event.target.value)} placeholder="e.g. Data Structures" /></label>
        <label>Course<select required value={form.courseId} onChange={(event) => update('courseId', event.target.value)} disabled={!courses.length}><option value="">{courses.length ? 'Select course' : 'No courses available'}</option>{courses.map((course) => <option value={course.id} key={course.id}>{course.courseCode} · {course.name}</option>)}</select></label>
        <label>Department<input value={selectedCourse?.department || ''} readOnly placeholder="Set on the selected course" /></label>
        <label>Examination type<select required value={form.type} onChange={(event) => update('type', event.target.value)}>{examinationTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
        <label>Examination date<input type="date" required value={form.date} onChange={(event) => update('date', event.target.value)} /></label>
        <label>Start time<input type="time" required value={form.time} onChange={(event) => update('time', event.target.value)} /></label>
        <label>Duration (minutes)<input type="number" required min="1" max="1440" step="1" value={form.durationMinutes} onChange={(event) => update('durationMinutes', event.target.value)} placeholder="e.g. 120" /></label>
        <label>Maximum marks<input type="number" required min="0.01" step="0.01" value={form.maxMarks} onChange={(event) => update('maxMarks', event.target.value)} placeholder="e.g. 100" /></label>
        <label>Passing marks<input type="number" required min="0" step="0.01" value={form.passingMarks} onChange={(event) => update('passingMarks', event.target.value)} placeholder="e.g. 40" /></label>
        <label className="exam-description-field">Description<textarea maxLength={2000} rows={3} value={form.description} onChange={(event) => update('description', event.target.value)} placeholder="Additional examination instructions (optional)" /></label>
      </div>
      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="modal-actions"><button className="button button-secondary" type="button" onClick={onClose} disabled={saving}>Cancel</button><button className="button button-primary" type="submit" disabled={saving || !courses.length}>{saving ? 'Saving…' : exam ? 'Save changes' : 'Save examination'}</button></div>
    </form>
  </Modal>
}

const examinationTypes = ['Internal', 'Midterm', 'Practical', 'Final']

function isValidExamDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

function CourseModal({ course, courses, teachers, teachersLoading, onClose, onSave }) {
  const [form, setForm] = useState(course ? {
    ...course,
    department: course.department || '',
    description: course.description || '',
    duration: course.duration || '',
    credits: course.credits || '',
    assignedTeacherId: course.assignedTeacherId || '',
    status: course.status || 'Active',
  } : {
    courseCode: '',
    name: '',
    department: '',
    description: '',
    duration: '',
    credits: '',
    assignedTeacherId: '',
    status: 'Active',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function submit(event) {
    event.preventDefault()
    const normalized = {
      ...form,
      courseCode: form.courseCode.trim().toUpperCase(),
      name: form.name.trim(),
      department: form.department.trim(),
      description: form.description.trim(),
      duration: form.duration.trim(),
      credits: String(form.credits).trim(),
    }
    if (!normalized.courseCode || !normalized.name || !normalized.department || !normalized.duration) {
      setError('Course code, course name, department and duration are required.')
      return
    }
    const credits = Number(normalized.credits)
    if (!Number.isSafeInteger(credits) || credits < 1 || credits > 32767) {
      setError('Enter a whole number of credits between 1 and 32767.')
      return
    }
    if (!['Active', 'Inactive'].includes(normalized.status)) {
      setError('Choose Active or Inactive for the course status.')
      return
    }
    const duplicate = courses.some((item) => item.id !== course?.id
      && item.courseCode.toLowerCase() === normalized.courseCode.toLowerCase())
    if (duplicate) {
      setError('A course with this code already exists.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSave(normalized)
    } catch (saveError) {
      setError(saveError.message || 'The course record could not be saved.')
      setSaving(false)
    }
  }

  return <Modal className="course-form-modal" title={course ? 'Edit course' : 'Add a course'} subtitle={course ? 'Update this course catalog entry.' : 'Add a course to your college catalog.'} onClose={onClose}>
    <form className="modal-form" onSubmit={submit} noValidate>
      <div className="modal-fields course-modal-fields">
        <label>Course code<input autoFocus required maxLength={40} value={form.courseCode} onChange={(event) => update('courseCode', event.target.value)} placeholder="e.g. CS-204" /></label>
        <label>Course name<input required maxLength={200} value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="e.g. Introduction to Computer Science" /></label>
        <label>Department<input required maxLength={120} value={form.department} onChange={(event) => update('department', event.target.value)} placeholder="e.g. Engineering" /></label>
        <label>Course duration<input required maxLength={80} value={form.duration} onChange={(event) => update('duration', event.target.value)} placeholder="e.g. 4 years or 2 semesters" /></label>
        <label>Number of credits<input type="number" required min="1" max="32767" step="1" value={form.credits} onChange={(event) => update('credits', event.target.value)} placeholder="e.g. 3" /></label>
        <label>Assigned teacher<select value={form.assignedTeacherId} onChange={(event) => update('assignedTeacherId', event.target.value)} disabled={teachersLoading}><option value="">{teachersLoading ? 'Loading teachers…' : 'Unassigned'}</option>{course?.assignedTeacherId && !teachers.some((teacher) => teacher.id === course.assignedTeacherId) && <option value={course.assignedTeacherId}>{course.assignedTeacherName || 'Previously assigned teacher'}</option>}{teachers.map((teacher) => <option value={teacher.id} key={teacher.id}>{teacher.name} · {teacher.teacherId}</option>)}</select></label>
        <label>Course status<select value={form.status} onChange={(event) => update('status', event.target.value)}><option>Active</option><option>Inactive</option></select></label>
        <label className="course-description-field">Course description<textarea maxLength={2000} rows={3} value={form.description} onChange={(event) => update('description', event.target.value)} placeholder="Describe the course (optional)" /></label>
      </div>
      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="modal-actions"><button className="button button-secondary" type="button" onClick={onClose} disabled={saving}>Cancel</button><button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : course ? 'Save changes' : 'Save course'}</button></div>
    </form>
  </Modal>
}

function StudentProfile({ student, courses, canEdit, onClose, onEdit }) {
  const course = courses.find((item) => item.id === student.courseId)
  return <Modal title="Student profile" subtitle="Student record and enrollment details." onClose={onClose}><div className="student-profile"><div className="profile-identity"><div className={`profile-large-avatar ${avatarTone(student.name)}`}>{initials(student.name)}</div><div><h3>{student.name}</h3><span>{student.studentId}</span></div></div><div className="profile-details"><div><span>Email address</span><strong>{student.email}</strong></div><div><span>Phone</span><strong>{student.phone || '—'}</strong></div><div><span>Gender</span><strong>{student.gender || '—'}</strong></div><div><span>Date of birth</span><strong>{student.dateOfBirth || '—'}</strong></div><div><span>Department</span><strong>{student.department}</strong></div><div><span>Year of study</span><strong>{student.yearOfStudyLabel}</strong></div><div><span>Admission year</span><strong>{student.admissionYear || '—'}</strong></div><div><span>Course</span><strong>{course ? `${course.course_code} · ${course.name}` : student.courseName || (student.courseId ? 'Assigned course' : 'Not assigned')}</strong></div><div><span>Address</span><strong>{student.address || '—'}</strong></div></div><div className="modal-actions"><button className="button button-secondary" onClick={onClose}>Close</button>{canEdit && <button className="button button-primary" onClick={onEdit}><FileText size={15} /> Edit student</button>}</div></div></Modal>
}

function Modal({ title, subtitle, onClose, children, className = '' }) {
  useEffect(() => {
    function onKeyDown(event) { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className={`modal-card ${className}`} role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-heading"><div><h2 id="modal-title">{title}</h2><p>{subtitle}</p></div><button className="icon-button modal-close" onClick={onClose} aria-label="Close dialog"><X size={19} /></button></div>{children}</section></div>
}

function PageHeading({ eyebrow, title, subtitle, action }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{subtitle}</p></div>{action && <div className="heading-action">{action}</div>}</div>
}
function PanelHeading({ title, subtitle, action }) {
  return <div className="panel-heading"><div><h2>{title}</h2><p>{subtitle}</p></div>{action}</div>
}
function StatusBadge({ status }) {
  const tone = ['Active', 'Present', 'A', 'Pass', 'Completed', 'Published'].includes(status) ? 'status-green' : ['Inactive', 'Absent', 'F', 'Fail', 'Cancelled'].includes(status) ? 'status-red' : ['Scheduled', 'Upcoming', 'B', 'C', 'Excused'].includes(status) ? 'status-blue' : 'status-amber'
  return <span className={`status-badge ${tone}`}><i />{status}</span>
}
function initials(name = '') { return name.split(/\s+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase() }
function userDisplayName(user) {
  const metadataName = user?.user_metadata?.full_name
  if (typeof metadataName === 'string' && metadataName.trim()) return metadataName.trim()
  return user?.email?.split('@')[0] || 'CampusFlow user'
}
function formatRelativeTime(value) {
  const timestamp = new Date(value).getTime()
  if (!Number.isFinite(timestamp)) return 'Recently'
  const minutes = Math.floor(Math.max(0, Date.now() - timestamp) / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(value).toLocaleDateString()
}
function avatarTone(name = '') {
  const tones = ['avatar-blue', 'avatar-violet', 'avatar-amber', 'avatar-green', 'avatar-rose']
  return tones[(name.charCodeAt(0) || 0) % tones.length]
}
function downloadCsv(rows, columns, filename) {
  if (!rows.length) { window.alert('There are no records to export.'); return }
  const csv = [columns.map((column) => `"${column.label.replaceAll('"', '""')}"`).join(','), ...rows.map((row) => columns.map((column) => `"${String(row[column.key] ?? '').replaceAll('"', '""')}"`).join(','))].join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export default App
