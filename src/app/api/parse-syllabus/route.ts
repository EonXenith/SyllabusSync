import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { ExtractedEvent } from '@/types'

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function callGemini(contents: unknown[]): Promise<string> {
  const url = `${GEMINI_URL}?key=${process.env.GEMINI_API_KEY}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 4096,
      },
    }),
  })

  if (!res.ok) {
    const errBody = await res.text()
    throw new Error(`Gemini API error ${res.status}: ${errBody}`)
  }

  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

const SYSTEM_PROMPT = `You are a helpful assistant that extracts due dates and deadlines from class syllabuses.
Read the following syllabus and return a JSON array of calendar events.
For each event, include:

"title": the assignment or exam name (string)
"event_type": one of "assignment", "exam", "quiz", "reading", "project", "other"
"date": the due date in YYYY-MM-DD format. If you cannot determine the exact date, use null.
"date_confidence": "high", "medium", or "low"

high = exact date is clearly stated
medium = date was inferred from week number or relative reference
low = date is missing, ambiguous, or guessed

"raw_date_text": the original date text from the syllabus (e.g., "Week 8", "March 15th")
"notes": any relevant context (e.g., "worth 20% of grade", "in-class")

Current year: ${new Date().getFullYear()}
Return ONLY a valid JSON array. No explanation, no markdown fences, no prose. Start your response with [ and end with ].`

function deduplicateEvents(events: ExtractedEvent[]): ExtractedEvent[] {
  const result: ExtractedEvent[] = []

  for (const event of events) {
    const isDuplicate = result.some((existing) => {
      if (existing.title === event.title && existing.date === event.date) {
        return true
      }
      if (existing.date && event.date) {
        const d1 = new Date(existing.date).getTime()
        const d2 = new Date(event.date).getTime()
        const daysDiff = Math.abs(d1 - d2) / (1000 * 60 * 60 * 24)
        const titleSimilar =
          existing.title.toLowerCase().includes(event.title.toLowerCase()) ||
          event.title.toLowerCase().includes(existing.title.toLowerCase())
        if (daysDiff <= 2 && titleSimilar) {
          return true
        }
      }
      return false
    })

    if (!isDuplicate) {
      result.push(event)
    }
  }

  return result
}

async function extractWithAI(
  text: string,
  isRetry = false
): Promise<ExtractedEvent[]> {
  const inputText = isRetry ? text.slice(0, 3000) : text
  console.log('[parse] Calling Gemini with text length:', inputText.length, 'isRetry:', isRetry)

  const raw = await callGemini([
    { role: 'user', parts: [{ text: SYSTEM_PROMPT + '\n\n' + inputText }] },
  ])

  console.log('[parse] Gemini response length:', raw.length, 'first 100 chars:', raw.slice(0, 100))
  const clean = raw.replace(/```json|```/g, '').trim()
  return JSON.parse(clean)
}

async function extractWithVision(
  base64Data: string,
  mimeType: string
): Promise<ExtractedEvent[]> {
  console.log('[parse] Calling Gemini vision with mimeType:', mimeType, 'base64 length:', base64Data.length)

  const raw = await callGemini([
    {
      role: 'user',
      parts: [
        { inlineData: { mimeType, data: base64Data } },
        { text: SYSTEM_PROMPT + '\n\nExtract all assignments, exams, and due dates from this syllabus image.' },
      ],
    },
  ])

  console.log('[parse] Gemini vision response length:', raw.length)
  const clean = raw.replace(/```json|```/g, '').trim()
  return JSON.parse(clean)
}

async function updateParseStatus(syllabusId: string, status: string) {
  await getSupabaseAdmin()
    .from('syllabuses')
    .update({ parse_status: status })
    .eq('id', syllabusId)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { syllabusId, courseId, fileUrl, fileType } = body
    console.log('[parse] Starting parse:', { syllabusId, courseId, fileUrl, fileType })

    if (!syllabusId || !courseId || !fileUrl || !fileType) {
      console.log('[parse] Missing required fields')
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Download file from Supabase Storage
    console.log('[parse] Downloading file from storage:', fileUrl)
    const { data: fileData, error: downloadError } = await getSupabaseAdmin().storage
      .from('syllabuses')
      .download(fileUrl)

    if (downloadError || !fileData) {
      console.log('[parse] Download failed:', downloadError?.message)
      await updateParseStatus(syllabusId, 'failed')
      return NextResponse.json({ error: 'file_not_found' }, { status: 500 })
    }

    console.log('[parse] File downloaded, type:', fileData.constructor.name, 'size:', fileData.size)

    let parsed: ExtractedEvent[] = []
    let warning: string | undefined

    if (fileType === 'pdf') {
      console.log('[parse] Processing PDF...')
      let text = ''
      try {
        const arrayBuf = await fileData.arrayBuffer()
        console.log('[parse] arrayBuffer obtained, byteLength:', arrayBuf.byteLength)
        const buffer = Buffer.from(arrayBuf)
        console.log('[parse] Buffer created, length:', buffer.length)

        const { PDFParse } = await import('pdf-parse')
        console.log('[parse] pdf-parse imported')
        const parser = new PDFParse({ data: new Uint8Array(buffer) })
        console.log('[parse] PDFParse constructor OK')
        const pdfData = await parser.getText()
        console.log('[parse] getText() OK, text length:', pdfData.text?.length)
        text = pdfData.text
        await parser.destroy()
      } catch (pdfErr) {
        console.error('[parse] PDF text extraction error:', pdfErr instanceof Error ? pdfErr.message : pdfErr)
        console.error('[parse] PDF error stack:', pdfErr instanceof Error ? pdfErr.stack : 'no stack')
        await updateParseStatus(syllabusId, 'failed')
        return NextResponse.json({ error: 'extraction_failed', details: String(pdfErr) }, { status: 500 })
      }

      const wordCount = text.split(/\s+/).filter(Boolean).length
      console.log('[parse] PDF word count:', wordCount)

      if (wordCount < 50) {
        // Scanned PDF - use vision
        console.log('[parse] Low word count, falling back to vision')
        const arrayBuf = await fileData.arrayBuffer()
        const base64 = Buffer.from(arrayBuf).toString('base64')
        warning = 'This appears to be a scanned PDF. OCR extraction may be limited.'
        try {
          parsed = await extractWithVision(base64, 'application/pdf')
        } catch (visionErr) {
          console.error('[parse] Vision extraction failed:', visionErr instanceof Error ? visionErr.message : visionErr)
          await updateParseStatus(syllabusId, 'failed')
          return NextResponse.json({ events: [], error: 'parse_failed' })
        }
      } else {
        try {
          parsed = await extractWithAI(text)
        } catch (aiErr) {
          console.error('[parse] AI extraction failed (first try):', aiErr instanceof Error ? aiErr.message : aiErr)
          try {
            parsed = await extractWithAI(text, true)
          } catch (retryErr) {
            console.error('[parse] AI extraction failed (retry):', retryErr instanceof Error ? retryErr.message : retryErr)
            await updateParseStatus(syllabusId, 'failed')
            return NextResponse.json({ events: [], error: 'parse_failed' })
          }
        }
      }
    } else if (fileType === 'docx') {
      console.log('[parse] Processing DOCX...')
      let text = ''
      try {
        const arrayBuf = await fileData.arrayBuffer()
        const buffer = Buffer.from(arrayBuf)
        console.log('[parse] DOCX buffer length:', buffer.length)
        const mammoth = await import('mammoth')
        console.log('[parse] mammoth imported')
        const result = await mammoth.extractRawText({ buffer })
        text = result.value
        console.log('[parse] DOCX text extracted, length:', text.length)
      } catch (docxErr) {
        console.error('[parse] DOCX extraction error:', docxErr instanceof Error ? docxErr.message : docxErr)
        await updateParseStatus(syllabusId, 'failed')
        return NextResponse.json({ error: 'extraction_failed', details: String(docxErr) }, { status: 500 })
      }

      try {
        parsed = await extractWithAI(text)
      } catch (aiErr) {
        console.error('[parse] AI extraction failed for DOCX (first try):', aiErr instanceof Error ? aiErr.message : aiErr)
        try {
          parsed = await extractWithAI(text, true)
        } catch (retryErr) {
          console.error('[parse] AI extraction failed for DOCX (retry):', retryErr instanceof Error ? retryErr.message : retryErr)
          await updateParseStatus(syllabusId, 'failed')
          return NextResponse.json({ events: [], error: 'parse_failed' })
        }
      }
    } else if (['jpg', 'jpeg', 'png'].includes(fileType)) {
      console.log('[parse] Processing image:', fileType)
      try {
        const arrayBuf = await fileData.arrayBuffer()
        const buffer = Buffer.from(arrayBuf)
        const base64 = buffer.toString('base64')
        const mimeType = fileType === 'png' ? 'image/png' : 'image/jpeg'
        parsed = await extractWithVision(base64, mimeType)
      } catch (imgErr) {
        console.error('[parse] Image extraction error:', imgErr instanceof Error ? imgErr.message : imgErr)
        await updateParseStatus(syllabusId, 'failed')
        return NextResponse.json({ events: [], error: 'parse_failed' })
      }
    } else {
      console.log('[parse] Unsupported file type:', fileType)
      await updateParseStatus(syllabusId, 'failed')
      return NextResponse.json(
        { error: 'Unsupported file type' },
        { status: 400 }
      )
    }

    // Deduplicate
    console.log('[parse] Events before dedup:', parsed.length)
    parsed = deduplicateEvents(parsed)
    console.log('[parse] Events after dedup:', parsed.length)

    // Update syllabus status
    await updateParseStatus(syllabusId, 'done')

    if (parsed.length === 0) {
      return NextResponse.json({
        events: [],
        syllabusId,
        warning: warning || 'no_events_found',
      })
    }

    console.log('[parse] Returning', parsed.length, 'events')
    return NextResponse.json({
      events: parsed,
      syllabusId,
      ...(warning ? { warning } : {}),
    })
  } catch (outerErr) {
    console.error('[parse] Unhandled outer error:', outerErr instanceof Error ? outerErr.message : outerErr)
    console.error('[parse] Outer error stack:', outerErr instanceof Error ? outerErr.stack : 'no stack')
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
