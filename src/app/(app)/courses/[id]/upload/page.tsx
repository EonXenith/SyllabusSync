'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { v4 as uuidv4 } from 'uuid'
import { Spinner } from '@/components/Spinner'

const ALLOWED_TYPES = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png', 'image/jpg']
const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.jpg', '.jpeg', '.png']
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

const LOADING_MESSAGES = [
  'Reading your syllabus…',
  'Finding your due dates…',
  'Organizing events…',
]

function getFileType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop()
  if (ext === 'pdf') return 'pdf'
  if (ext === 'docx') return 'docx'
  if (ext === 'jpg' || ext === 'jpeg') return 'jpg'
  if (ext === 'png') return 'png'
  return 'unknown'
}

export default function UploadPage() {
  const router = useRouter()
  const params = useParams()
  const courseId = params.id as string

  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0)
  const [timedOut, setTimedOut] = useState(false)
  const [courseName, setCourseName] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function loadCourse() {
      const supabase = createClient()
      const { data } = await supabase.from('courses').select('name').eq('id', courseId).single()
      if (data) setCourseName(data.name)
    }
    loadCourse()
  }, [courseId])

  useEffect(() => {
    if (!uploading) return
    const interval = setInterval(() => {
      setLoadingMsgIndex((prev) => (prev + 1) % LOADING_MESSAGES.length)
    }, 3000)
    const timeout = setTimeout(() => setTimedOut(true), 30000)
    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [uploading])

  const validateFile = useCallback((file: File): string | null => {
    const ext = '.' + file.name.toLowerCase().split('.').pop()
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return 'We support PDF, Word (.docx), JPG, and PNG. For Google Docs, download as PDF first.'
    }
    if (!ALLOWED_TYPES.includes(file.type) && !ALLOWED_EXTENSIONS.includes(ext)) {
      return 'We support PDF, Word (.docx), JPG, and PNG. For Google Docs, download as PDF first.'
    }
    if (file.size > MAX_SIZE) {
      return 'This file is too large (max 10MB). Try a compressed version.'
    }
    return null
  }, [])

  const processFile = useCallback(async (file: File) => {
    const validationError = validateFile(file)
    if (validationError) {
      setError(validationError)
      return
    }

    setError('')
    setUploading(true)
    setTimedOut(false)
    setLoadingMsgIndex(0)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const syllabusId = uuidv4()
      const fileType = getFileType(file.name)
      const filePath = `${user.id}/${syllabusId}/${file.name}`

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('syllabuses')
        .upload(filePath, file)

      if (uploadError) throw new Error('File upload failed: ' + uploadError.message)

      // Create syllabus record
      const { error: dbError } = await supabase.from('syllabuses').insert({
        id: syllabusId,
        course_id: courseId,
        user_id: user.id,
        file_url: filePath,
        file_type: fileType,
        parse_status: 'processing',
      })

      if (dbError) throw new Error('Database error: ' + dbError.message)

      // Call parse API
      const response = await fetch('/api/parse-syllabus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          syllabusId,
          courseId,
          fileUrl: filePath,
          fileType,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Parsing failed')
      }

      // Store events in session storage for review page
      sessionStorage.setItem(
        `review_${courseId}`,
        JSON.stringify({
          events: result.events,
          syllabusId,
          warning: result.warning,
        })
      )

      router.push(`/courses/${courseId}/review`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setUploading(false)
    }
  }, [courseId, router, validateFile])

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  if (uploading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-4 text-lg font-medium text-gray-700">
            {LOADING_MESSAGES[loadingMsgIndex]}
          </p>
          {timedOut && (
            <div className="mt-6">
              <p className="text-sm text-gray-500 mb-3">
                This is taking longer than usual. Check your connection and try again.
              </p>
              <button
                onClick={() => {
                  setUploading(false)
                  setTimedOut(false)
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-2 text-sm font-medium"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2" style={{ fontFamily: 'var(--font-outfit)' }}>
        Upload Syllabus
      </h1>
      {courseName && (
        <p className="text-gray-500 mb-6">for {courseName}</p>
      )}

      <div
        className={`bg-white rounded-xl shadow-sm border-2 border-dashed p-12 text-center transition-colors ${
          dragOver ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200'
        }`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <p className="text-gray-700 font-medium mb-2">Drag and drop your syllabus here</p>
        <p className="text-sm text-gray-500 mb-4">or</p>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          Browse files
        </button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".pdf,.docx,.jpg,.jpeg,.png"
          onChange={handleFileChange}
          aria-label="Choose a syllabus file to upload"
        />
        <p className="text-xs text-gray-400 mt-4">
          PDF, Word (.docx), JPG, PNG — max 10MB
        </p>
      </div>

      {error && (
        <p className="mt-4 text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</p>
      )}
    </div>
  )
}
