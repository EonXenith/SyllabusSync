'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/Toast'
import { Spinner } from '@/components/Spinner'
import type { ExtractedEvent } from '@/types'

interface ReviewEvent extends ExtractedEvent {
  id: string
  needsReview: boolean
}

const EVENT_TYPES = ['assignment', 'exam', 'quiz', 'reading', 'project', 'other']

export default function ReviewPage() {
  const router = useRouter()
  const params = useParams()
  const courseId = params.id as string
  const { showToast } = useToast()

  const [events, setEvents] = useState<ReviewEvent[]>([])
  const [syllabusId, setSyllabusId] = useState('')
  const [courseName, setCourseName] = useState('')
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [warning, setWarning] = useState('')

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: course } = await supabase.from('courses').select('name').eq('id', courseId).single()
      if (course) setCourseName(course.name)

      const stored = sessionStorage.getItem(`review_${courseId}`)
      if (stored) {
        const parsed = JSON.parse(stored)
        setSyllabusId(parsed.syllabusId)
        if (parsed.warning) setWarning(parsed.warning)

        const reviewEvents: ReviewEvent[] = (parsed.events as ExtractedEvent[]).map(
          (e, i) => ({
            ...e,
            id: `temp_${i}`,
            needsReview: !e.date || e.date_confidence === 'low',
          })
        )

        // Sort: needs review at top
        reviewEvents.sort((a, b) => {
          if (a.needsReview && !b.needsReview) return -1
          if (!a.needsReview && b.needsReview) return 1
          return 0
        })

        setEvents(reviewEvents)
      }
      setLoaded(true)
    }
    load()
  }, [courseId])

  function updateEvent(id: string, field: keyof ReviewEvent, value: string | null) {
    setEvents((prev) =>
      prev.map((e) => (e.id === id ? { ...e, [field]: value } : e))
    )
  }

  function deleteEvent(id: string) {
    setEvents((prev) => prev.filter((e) => e.id !== id))
  }

  function addEvent() {
    const newEvent: ReviewEvent = {
      id: `temp_${Date.now()}`,
      title: 'New Event',
      event_type: 'assignment',
      date: null,
      date_confidence: 'low',
      raw_date_text: '',
      notes: null,
      needsReview: true,
    }
    setEvents((prev) => [...prev, newEvent])
  }

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      showToast('You must be logged in.', 'error')
      setSaving(false)
      return
    }

    const rows = events.map((e) => ({
      user_id: user.id,
      course_id: courseId,
      syllabus_id: syllabusId || null,
      title: e.title,
      event_type: e.event_type,
      due_date: e.date || null,
      notes: e.notes || null,
      date_confidence: e.date_confidence,
      needs_review: !e.date || e.date_confidence === 'low',
      ai_extracted: true,
    }))

    const { error } = await supabase.from('calendar_events').insert(rows)

    if (error) {
      showToast('Failed to save events. Please try again.', 'error')
      setSaving(false)
      return
    }

    sessionStorage.removeItem(`review_${courseId}`)
    showToast(`${events.length} events added to your calendar!`)
    router.push('/calendar')
  }

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    )
  }

  const lowConfidenceCount = events.filter((e) => !e.date || e.date_confidence === 'low').length
  const showLowConfidenceBanner = events.length > 0 && lowConfidenceCount / events.length > 0.5

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-outfit)' }}>
          Review Your Events
        </h1>
        {courseName && (
          <span className="bg-indigo-100 text-indigo-700 text-xs font-medium px-2.5 py-1 rounded-full">
            {courseName}
          </span>
        )}
      </div>

      {events.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mt-4">
          <p className="text-amber-800 font-medium mb-2">
            We didn&apos;t find any due dates.
          </p>
          <p className="text-amber-700 text-sm mb-4">
            Make sure you uploaded a class syllabus with dates and assignments listed.
          </p>
          <button
            onClick={() => router.push(`/courses/${courseId}/upload`)}
            className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-4 py-2 text-sm font-medium"
          >
            Try Again
          </button>
        </div>
      ) : (
        <>
          <p className="text-gray-500 mb-4">
            We found {events.length} events. Check them over before saving.
          </p>

          {showLowConfidenceBanner && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
              <p className="text-blue-800 text-sm">
                We couldn&apos;t find dates for most of these — you&apos;ll need to fill them in.
              </p>
            </div>
          )}

          {warning && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
              <p className="text-amber-800 text-sm">{warning}</p>
            </div>
          )}

          <div className="space-y-3 mb-6">
            {events.map((event) => (
              <div
                key={event.id}
                className="bg-white rounded-xl shadow-sm border border-gray-100 p-4"
              >
                <div className="flex items-start gap-3">
                  {event.needsReview && (
                    <span className="text-lg mt-0.5" title="Needs review">
                      ⚠️
                    </span>
                  )}
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <label htmlFor={`title-${event.id}`} className="block text-xs text-gray-400 mb-1">
                        Title
                      </label>
                      <input
                        id={`title-${event.id}`}
                        type="text"
                        value={event.title}
                        onChange={(e) => updateEvent(event.id, 'title', e.target.value)}
                        className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label htmlFor={`date-${event.id}`} className="block text-xs text-gray-400 mb-1">
                        Date
                      </label>
                      <input
                        id={`date-${event.id}`}
                        type="date"
                        value={event.date || ''}
                        onChange={(e) => updateEvent(event.id, 'date', e.target.value || null)}
                        placeholder="Date missing"
                        className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label htmlFor={`type-${event.id}`} className="block text-xs text-gray-400 mb-1">
                        Type
                      </label>
                      <select
                        id={`type-${event.id}`}
                        value={event.event_type}
                        onChange={(e) => updateEvent(event.id, 'event_type', e.target.value)}
                        className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {EVENT_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t.charAt(0).toUpperCase() + t.slice(1)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor={`notes-${event.id}`} className="block text-xs text-gray-400 mb-1">
                        Notes
                      </label>
                      <input
                        id={`notes-${event.id}`}
                        type="text"
                        value={event.notes || ''}
                        onChange={(e) => updateEvent(event.id, 'notes', e.target.value || null)}
                        className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => deleteEvent(event.id)}
                    className="text-gray-400 hover:text-red-500 p-1 shrink-0"
                    aria-label={`Delete ${event.title}`}
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={addEvent}
              className="border border-gray-200 hover:bg-gray-50 rounded-lg px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              + Add Event
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg px-6 py-2.5 font-medium flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              {saving && <Spinner size="sm" />}
              Save to Calendar
            </button>
          </div>
        </>
      )}
    </div>
  )
}
