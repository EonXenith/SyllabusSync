'use client'

import { useEffect, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/Toast'
import { Spinner } from '@/components/Spinner'
import type { CalendarEvent, Course } from '@/types'
import Link from 'next/link'

// Dynamic import to avoid SSR issues with FullCalendar
const CalendarView = dynamic(() => import('@/components/CalendarView'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-20">
      <Spinner size="lg" />
    </div>
  ),
})

const EVENT_TYPES = ['assignment', 'exam', 'quiz', 'reading', 'project', 'other']

export default function CalendarPage() {
  const { showToast } = useToast()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [visibleCourses, setVisibleCourses] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  // New event form state
  const [newTitle, setNewTitle] = useState('')
  const [newCourseId, setNewCourseId] = useState('')
  const [newDate, setNewDate] = useState('')
  const [newTime, setNewTime] = useState('')
  const [newType, setNewType] = useState('assignment')
  const [newNotes, setNewNotes] = useState('')

  const loadData = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [coursesRes, eventsRes] = await Promise.all([
      supabase.from('courses').select('*').eq('user_id', user.id).order('name'),
      supabase.from('calendar_events').select('*, course:courses(*)').eq('user_id', user.id),
    ])

    const coursesData = coursesRes.data || []
    setCourses(coursesData)
    setVisibleCourses(new Set(coursesData.map((c) => c.id)))
    setEvents(eventsRes.data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  function toggleCourse(courseId: string) {
    setVisibleCourses((prev) => {
      const next = new Set(prev)
      if (next.has(courseId)) {
        next.delete(courseId)
      } else {
        next.add(courseId)
      }
      return next
    })
  }

  function handleEventClick(eventId: string) {
    const event = events.find((e) => e.id === eventId)
    if (event) setSelectedEvent(event)
  }

  async function handleDelete() {
    if (!selectedEvent) return
    setActionLoading(true)
    const supabase = createClient()
    const { error } = await supabase.from('calendar_events').delete().eq('id', selectedEvent.id)
    if (error) {
      showToast('Failed to delete event.', 'error')
    } else {
      setEvents((prev) => prev.filter((e) => e.id !== selectedEvent.id))
      showToast('Event deleted.')
    }
    setSelectedEvent(null)
    setDeleteConfirm(false)
    setActionLoading(false)
  }

  async function handleEditSave() {
    if (!editingEvent) return
    setActionLoading(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('calendar_events')
      .update({
        title: editingEvent.title,
        due_date: editingEvent.due_date,
        due_time: editingEvent.due_time,
        event_type: editingEvent.event_type,
        notes: editingEvent.notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', editingEvent.id)

    if (error) {
      showToast('Failed to save changes.', 'error')
    } else {
      setEvents((prev) =>
        prev.map((e) => (e.id === editingEvent.id ? { ...e, ...editingEvent } : e))
      )
      showToast('Event updated.')
    }
    setEditingEvent(null)
    setSelectedEvent(null)
    setActionLoading(false)
  }

  async function handleAddEvent(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim() || !newCourseId || !newDate) return
    setActionLoading(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('calendar_events')
      .insert({
        user_id: user.id,
        course_id: newCourseId,
        title: newTitle.trim(),
        due_date: newDate,
        due_time: newTime || null,
        event_type: newType,
        notes: newNotes.trim() || null,
        ai_extracted: false,
        needs_review: false,
      })
      .select('*, course:courses(*)')
      .single()

    if (error) {
      showToast('Failed to add event.', 'error')
    } else if (data) {
      setEvents((prev) => [...prev, data])
      showToast('Event added.')
      setShowAddModal(false)
      setNewTitle('')
      setNewCourseId('')
      setNewDate('')
      setNewTime('')
      setNewType('assignment')
      setNewNotes('')
    }
    setActionLoading(false)
  }

  const filteredEvents = events.filter((e) => visibleCourses.has(e.course_id))

  const calendarEvents = filteredEvents
    .filter((e) => e.due_date)
    .map((e) => {
      const course = courses.find((c) => c.id === e.course_id)
      return {
        id: e.id,
        title: e.title,
        start: e.due_time ? `${e.due_date}T${e.due_time}` : e.due_date!,
        backgroundColor: course?.color_hex || '#6366F1',
        borderColor: course?.color_hex || '#6366F1',
        extendedProps: {
          courseName: course?.name || '',
          eventType: e.event_type,
        },
      }
    })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    )
  }

  if (courses.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center max-w-md">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Your calendar is empty</h2>
          <p className="text-gray-500 mb-6">Add a course to get started.</p>
          <Link
            href="/courses/new"
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-6 py-2.5 font-medium"
          >
            Add a Course
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-outfit)' }}>
          Calendar
        </h1>
        <button
          onClick={() => {
            setShowAddModal(true)
            if (courses.length > 0 && !newCourseId) setNewCourseId(courses[0].id)
          }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          + Add Event
        </button>
      </div>

      {/* Course filter */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <p className="text-sm font-medium text-gray-700 mb-2">Filter by course</p>
        <div className="flex flex-wrap gap-3">
          {courses.map((course) => (
            <label
              key={course.id}
              className="flex items-center gap-2 cursor-pointer text-sm"
            >
              <input
                type="checkbox"
                checked={visibleCourses.has(course.id)}
                onChange={() => toggleCourse(course.id)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: course.color_hex }}
              />
              <span className="text-gray-700">{course.name}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Calendar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <CalendarView events={calendarEvents} onEventClick={handleEventClick} />
      </div>

      {/* Event detail modal */}
      {selectedEvent && !editingEvent && !deleteConfirm && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">{selectedEvent.title}</h3>
            <div className="space-y-2 mb-6">
              <p className="text-sm text-gray-600">
                <span className="text-gray-400">Date:</span>{' '}
                {selectedEvent.due_date || 'No date set'}
                {selectedEvent.due_time && ` at ${selectedEvent.due_time}`}
              </p>
              <p className="text-sm text-gray-600">
                <span className="text-gray-400">Course:</span>{' '}
                <span
                  className="inline-flex items-center gap-1.5 bg-gray-100 rounded-full px-2 py-0.5 text-xs"
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{
                      backgroundColor:
                        courses.find((c) => c.id === selectedEvent.course_id)?.color_hex || '#6366F1',
                    }}
                  />
                  {courses.find((c) => c.id === selectedEvent.course_id)?.name || 'Unknown'}
                </span>
              </p>
              <p className="text-sm text-gray-600">
                <span className="text-gray-400">Type:</span>{' '}
                {selectedEvent.event_type}
              </p>
              {selectedEvent.notes && (
                <p className="text-sm text-gray-600">
                  <span className="text-gray-400">Notes:</span>{' '}
                  {selectedEvent.notes}
                </p>
              )}
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setSelectedEvent(null)}
                className="border border-gray-200 hover:bg-gray-50 rounded-lg px-4 py-2 text-sm font-medium"
              >
                Close
              </button>
              <button
                onClick={() => setDeleteConfirm(true)}
                className="border border-red-200 hover:bg-red-50 text-red-600 rounded-lg px-4 py-2 text-sm font-medium"
              >
                Delete
              </button>
              <button
                onClick={() => setEditingEvent({ ...selectedEvent })}
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-2 text-sm font-medium"
              >
                Edit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteConfirm && selectedEvent && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete event?</h3>
            <p className="text-sm text-gray-500 mb-6">
              &quot;{selectedEvent.title}&quot; will be permanently deleted.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(false)}
                className="border border-gray-200 hover:bg-gray-50 rounded-lg px-4 py-2 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={actionLoading}
                className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-2"
              >
                {actionLoading && <Spinner size="sm" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editingEvent && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit Event</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="editTitle" className="block text-sm font-medium text-gray-700 mb-1">
                  Title
                </label>
                <input
                  id="editTitle"
                  type="text"
                  value={editingEvent.title}
                  onChange={(e) => setEditingEvent({ ...editingEvent, title: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label htmlFor="editDate" className="block text-sm font-medium text-gray-700 mb-1">
                  Date
                </label>
                <input
                  id="editDate"
                  type="date"
                  value={editingEvent.due_date || ''}
                  onChange={(e) => setEditingEvent({ ...editingEvent, due_date: e.target.value || null })}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label htmlFor="editTime" className="block text-sm font-medium text-gray-700 mb-1">
                  Time (optional)
                </label>
                <input
                  id="editTime"
                  type="time"
                  value={editingEvent.due_time || ''}
                  onChange={(e) => setEditingEvent({ ...editingEvent, due_time: e.target.value || null })}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label htmlFor="editType" className="block text-sm font-medium text-gray-700 mb-1">
                  Type
                </label>
                <select
                  id="editType"
                  value={editingEvent.event_type}
                  onChange={(e) => setEditingEvent({ ...editingEvent, event_type: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {EVENT_TYPES.map((t) => (
                    <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="editNotes" className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <input
                  id="editNotes"
                  type="text"
                  value={editingEvent.notes || ''}
                  onChange={(e) => setEditingEvent({ ...editingEvent, notes: e.target.value || null })}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => { setEditingEvent(null); setSelectedEvent(null) }}
                className="border border-gray-200 hover:bg-gray-50 rounded-lg px-4 py-2 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSave}
                disabled={actionLoading}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-2"
              >
                {actionLoading && <Spinner size="sm" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add event modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Event</h3>
            <form onSubmit={handleAddEvent} className="space-y-4">
              <div>
                <label htmlFor="addTitle" className="block text-sm font-medium text-gray-700 mb-1">
                  Title
                </label>
                <input
                  id="addTitle"
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label htmlFor="addCourse" className="block text-sm font-medium text-gray-700 mb-1">
                  Course
                </label>
                <select
                  id="addCourse"
                  required
                  value={newCourseId}
                  onChange={(e) => setNewCourseId(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="addDate" className="block text-sm font-medium text-gray-700 mb-1">
                  Date
                </label>
                <input
                  id="addDate"
                  type="date"
                  required
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label htmlFor="addTime" className="block text-sm font-medium text-gray-700 mb-1">
                  Time (optional)
                </label>
                <input
                  id="addTime"
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label htmlFor="addType" className="block text-sm font-medium text-gray-700 mb-1">
                  Type
                </label>
                <select
                  id="addType"
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {EVENT_TYPES.map((t) => (
                    <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="addNotes" className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (optional)
                </label>
                <input
                  id="addNotes"
                  type="text"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="border border-gray-200 hover:bg-gray-50 rounded-lg px-4 py-2 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-2"
                >
                  {actionLoading && <Spinner size="sm" />}
                  Add Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
