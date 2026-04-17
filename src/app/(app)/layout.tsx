import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppSidebar } from '@/components/AppSidebar'
import { ErrorBoundary } from '@/components/ErrorBoundary'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single()

  const displayName = profile?.display_name || user.email?.split('@')[0] || 'User'

  return (
    <div className="min-h-screen flex bg-[#F8F7F4]">
      <AppSidebar displayName={displayName} />
      <main className="flex-1 md:ml-64 min-h-screen">
        <div className="p-4 md:p-8 max-w-6xl mx-auto">
          <ErrorBoundary>{children}</ErrorBoundary>
        </div>
      </main>
    </div>
  )
}
