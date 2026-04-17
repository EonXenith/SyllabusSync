import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function DELETE() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Delete storage files
    const { data: files } = await adminClient.storage
      .from('syllabuses')
      .list(user.id, { limit: 1000 })

    if (files && files.length > 0) {
      // List all files recursively
      const allFiles: string[] = []
      for (const item of files) {
        const { data: subFiles } = await adminClient.storage
          .from('syllabuses')
          .list(`${user.id}/${item.name}`, { limit: 1000 })
        if (subFiles) {
          for (const sub of subFiles) {
            allFiles.push(`${user.id}/${item.name}/${sub.name}`)
          }
        }
      }
      if (allFiles.length > 0) {
        await adminClient.storage.from('syllabuses').remove(allFiles)
      }
    }

    // Delete all user data (cascade handles most, but be explicit)
    await adminClient.from('calendar_events').delete().eq('user_id', user.id)
    await adminClient.from('syllabuses').delete().eq('user_id', user.id)
    await adminClient.from('courses').delete().eq('user_id', user.id)
    await adminClient.from('profiles').delete().eq('id', user.id)

    // Delete the auth user
    const { error } = await adminClient.auth.admin.deleteUser(user.id)

    if (error) {
      return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
