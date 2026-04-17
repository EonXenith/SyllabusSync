export interface Profile {
  id: string
  display_name: string | null
  timezone: string
  created_at: string
}

export interface Course {
  id: string
  user_id: string
  name: string
  color_hex: string
  semester: string | null
  created_at: string
}

export interface Syllabus {
  id: string
  course_id: string
  user_id: string
  file_url: string | null
  file_type: string | null
  parse_status: string
  uploaded_at: string
}

export interface CalendarEvent {
  id: string
  user_id: string
  course_id: string
  syllabus_id: string | null
  title: string
  event_type: string
  due_date: string | null
  due_time: string | null
  notes: string | null
  date_confidence: string | null
  needs_review: boolean
  ai_extracted: boolean
  created_at: string
  updated_at: string
  course?: Course
}

export interface ExtractedEvent {
  title: string
  event_type: string
  date: string | null
  date_confidence: 'high' | 'medium' | 'low'
  raw_date_text: string
  notes: string | null
}
