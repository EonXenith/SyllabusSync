import { NextResponse } from 'next/server'

export async function GET() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`
  const res = await fetch(url)
  const data = await res.json()
  return NextResponse.json(data)
}
