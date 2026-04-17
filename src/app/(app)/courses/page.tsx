'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/Toast'
import { Spinner } from '@/components/Spinner'
import type { Course } from '@/types'

export default function CoursesPage() {
  const router = useRouter()
  const { showToast } = useToast()
  const [courses, setCourses] = useState<(Course & { event_count: number })[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    loadCourses()
  }, [])

  async function loadCourses() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: coursesData } = await supabase
      .from('courses')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    const { data: events } = await supabase
      .from('calendar_events')
      .select('course_id')
      .eq('user_id', user.id)

    const countMap: Record<string, number> = {}
    events?.forEach((e) => {
      countMap[e.course_id] = (countMap[e.course_id] || 0) + 1
    })

    setCourses(
      (coursesData || []).map((c) => ({
        ...c,
        event_count: countMap[c.id] || 0,
      }))
    )
    setLoading(false)
  }

  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    const supabase = createClient()
    const { error } = await supabase.from('courses').delete().eq('id', deleteId)
    if (error) {
      showToast('Failed to delete course.', 'error')
    } else {
      showToast('Course deleted.')
      setCourses((prev) => prev.filter((c) => c.id !== deleteId))
    }
    setDeleteId(null)
    setDeleting(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-outfit)' }}>
          Courses
        </h1>
        <Link
          href="/courses/new"
          className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          + Add Course
        </Link>
      </div>

      {courses.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <svg className="w-20 h-20 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No courses yet</h3>
          <p className="text-gray-500 mb-6">Create your first course to start uploading syllabuses.</p>
          <Link
            href="/courses/new"
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-6 py-2.5 font-medium"
          >
            Add your first course
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {courses.map((course) => (
            <div
              key={course.id}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-5"
            >
              <div className="flex items-start gap-3 mb-4">
                <div
                  className="w-4 h-4 rounded-full mt-1 shrink-0"
                  style={{ backgroundColor: course.color_hex }}
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{course.name}</h3>
                  {course.semester && (
                    <p className="text-sm text-gray-500">{course.semester}</p>
                  )}
                  <p className="text-sm text-gray-400 mt-1">{course.event_count} events</p>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Link
                  href={`/courses/${course.id}/edit`}
                  className="border border-gray-200 hover:bg-gray-50 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  Edit
                </Link>
                <Link
                  href={`/courses/${course.id}/upload`}
                  className="border border-gray-200 hover:bg-gray-50 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  Upload Syllabus
                </Link>
                <button
                  onClick={() => setDeleteId(course.id)}
                  className="border border-red-200 hover:bg-red-50 rounded-lg px-3 py-1.5 text-sm text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete course?</h3>
            <p className="text-sm text-gray-500 mb-6">
              This will permanently delete this course and all its events and syllabuses.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteId(null)}
                className="border border-gray-200 hover:bg-gray-50 rounded-lg px-4 py-2 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-2"
              >
                {deleting && <Spinner size="sm" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
