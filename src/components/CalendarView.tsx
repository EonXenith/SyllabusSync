'use client'

import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import interactionPlugin from '@fullcalendar/interaction'
import type { EventClickArg } from '@fullcalendar/core'

interface CalendarEvent {
  id: string
  title: string
  start: string
  backgroundColor: string
  borderColor: string
  extendedProps: {
    courseName: string
    eventType: string
  }
}

interface CalendarViewProps {
  events: CalendarEvent[]
  onEventClick: (eventId: string) => void
}

export default function CalendarView({ events, onEventClick }: CalendarViewProps) {
  function handleEventClick(info: EventClickArg) {
    onEventClick(info.event.id)
  }

  return (
    <FullCalendar
      plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
      initialView="dayGridMonth"
      headerToolbar={{
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,listWeek',
      }}
      events={events}
      eventClick={handleEventClick}
      height="auto"
      eventContent={(arg) => (
        <div className="p-0.5 overflow-hidden">
          <div className="font-medium text-xs truncate">{arg.event.title}</div>
          <div className="text-[10px] opacity-75 truncate">
            {arg.event.extendedProps.courseName}
          </div>
        </div>
      )}
    />
  )
}
