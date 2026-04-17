import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-[#F8F7F4] flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-5xl mx-auto w-full">
        <span className="text-lg font-bold text-gray-900" style={{ fontFamily: 'var(--font-outfit)' }}>
          SyllabusSync
        </span>
        <Link
          href="/login"
          className="text-sm text-gray-600 hover:text-gray-900 font-medium"
        >
          Log In
        </Link>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <h1
          className="text-4xl md:text-5xl font-bold text-gray-900 max-w-2xl leading-tight mb-6"
          style={{ fontFamily: 'var(--font-outfit)' }}
        >
          Your syllabus, turned into a calendar. In seconds.
        </h1>
        <p className="text-lg text-gray-500 max-w-lg mb-10">
          Upload your class syllabus and let AI extract every assignment, exam, and due date into a clean calendar you can actually use.
        </p>

        {/* 3-step visual */}
        <div className="flex flex-col md:flex-row items-center gap-6 md:gap-12 mb-12">
          <Step
            number="1"
            title="Upload"
            description="Drop your syllabus (PDF, Word, or image)"
            icon={
              <svg className="w-8 h-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            }
          />
          <svg className="w-6 h-6 text-gray-300 rotate-90 md:rotate-0 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <Step
            number="2"
            title="AI Extracts"
            description="Dates, assignments, and exams — found automatically"
            icon={
              <svg className="w-8 h-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            }
          />
          <svg className="w-6 h-6 text-gray-300 rotate-90 md:rotate-0 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <Step
            number="3"
            title="Calendar Ready"
            description="Review, edit, and export to Google Calendar"
            icon={
              <svg className="w-8 h-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            }
          />
        </div>

        <Link
          href="/signup"
          className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-8 py-3 text-lg font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          Get Started
        </Link>
      </main>

      <footer className="py-6 text-center text-sm text-gray-400">
        SyllabusSync
      </footer>
    </div>
  )
}

function Step({
  number,
  title,
  description,
  icon,
}: {
  number: string
  title: string
  description: string
  icon: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center max-w-[180px]">
      <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-3">
        {icon}
      </div>
      <p className="text-xs text-indigo-600 font-semibold mb-1">Step {number}</p>
      <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-500">{description}</p>
    </div>
  )
}
