import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user!.id)
    .single()

  const displayName = profile?.display_name || 'there'

  const { data: courses } = await supabase
    .from('courses')
    .select('*')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })

  const { data: events } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('user_id', user!.id)

  const totalCourses = courses?.length ?? 0
  const totalEvents = events?.length ?? 0

  const now = new Date()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay())
  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(startOfWeek.getDate() + 6)

  const eventsThisWeek = events?.filter((e) => {
    if (!e.due_date) return false
    const d = new Date(e.due_date)
    return d >= startOfWeek && d <= endOfWeek
  }).length ?? 0

  const needsReview = events?.filter((e) => e.needs_review).length ?? 0

  // Count events per course
  const eventCountByCourse: Record<string, number> = {}
  events?.forEach((e) => {
    eventCountByCourse[e.course_id] = (eventCountByCourse[e.course_id] || 0) + 1
  })

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6" style={{ fontFamily: 'var(--font-outfit)' }}>
        {getGreeting()}, {displayName}
      </h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <SummaryCard label="Total Courses" value={totalCourses} />
        <SummaryCard label="Total Events" value={totalEvents} />
        <SummaryCard label="This Week" value={eventsThisWeek} />
        <SummaryCard label="Needs Review" value={needsReview} highlight={needsReview > 0} />
      </div>

      {/* Quick action */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900" style={{ fontFamily: 'var(--font-outfit)' }}>
          Your Courses
        </h2>
        <Link
          href="/courses/new"
          className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          + Add Course
        </Link>
      </div>

      {totalCourses === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <svg className="w-20 h-20 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No courses yet</h3>
          <p className="text-gray-500 mb-6">Add your first course to get started with SyllabusSync.</p>
          <Link
            href="/courses/new"
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-6 py-2.5 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Add your first course
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {courses?.map((course) => (
            <Link
              key={course.id}
              href={`/courses`}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-4 h-4 rounded-full mt-1 shrink-0"
                  style={{ backgroundColor: course.color_hex }}
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{course.name}</h3>
                  {course.semester && (
                    <p className="text-sm text-gray-500">{course.semester}</p>
                  )}
                  <p className="text-sm text-gray-400 mt-1">
                    {eventCountByCourse[course.id] || 0} events
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function SummaryCard({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: number
  highlight?: boolean
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${highlight ? 'text-amber-500' : 'text-gray-900'}`}>
        {value}
      </p>
    </div>
  )
}
