import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import ical, { ICalCalendarMethod } from 'ical-generator'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: events } = await supabase
      .from('calendar_events')
      .select('*, course:courses(name)')
      .eq('user_id', user.id)

    if (!events || events.length === 0) {
      return NextResponse.json({ error: 'No events to export' }, { status: 400 })
    }

    const calendar = ical({
      name: 'SyllabusSync',
      method: ICalCalendarMethod.PUBLISH,
    })

    for (const event of events) {
      if (!event.due_date) continue

      const courseName = (event.course as { name: string } | null)?.name || 'Unknown Course'
      const startDate = event.due_time
        ? new Date(`${event.due_date}T${event.due_time}`)
        : new Date(`${event.due_date}T00:00:00`)

      calendar.createEvent({
        start: startDate,
        allDay: !event.due_time,
        summary: event.title,
        description: [
          event.event_type ? `Type: ${event.event_type}` : '',
          event.notes || '',
        ]
          .filter(Boolean)
          .join('\n'),
        categories: [{ name: courseName }],
      })
    }

    const icsContent = calendar.toString()

    return new Response(icsContent, {
      headers: {
        'Content-Type': 'text/calendar',
        'Content-Disposition': 'attachment; filename="syllabussync.ics"',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
