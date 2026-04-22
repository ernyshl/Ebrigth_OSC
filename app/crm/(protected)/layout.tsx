import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/crm/auth'
import { prisma } from '@/lib/crm/db'
import { CrmProviders } from '@/components/crm/providers'
import { CrmShell } from '@/components/crm/shell'

export const metadata = {
  title: 'Ebright CRM',
  description: 'Customer Relationship Management — Ebright',
}

export default async function CrmProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth.api.getSession({ headers: await headers() })

  // DEV-ONLY: allow preview without auth. Remove CRM_PREVIEW_MODE from .env for prod.
  const previewMode = process.env.CRM_PREVIEW_MODE === 'true'

  if (!session && !previewMode) {
    redirect('/crm/login')
  }

  // Load ticket-module role + branch assignments so the shell can filter nav.
  // Swallow DB errors — a flaky connection shouldn't crash the whole page.
  let tktRole: string | null = null
  let tktBranchIds: string[] = []
  if (session?.user?.id) {
    try {
      const profile = await prisma.tkt_user_profile.findUnique({
        where: { user_id: session.user.id },
        include: { branches: { select: { branch_id: true } } },
      })
      tktRole = profile?.role ?? null
      tktBranchIds = profile?.branches.map((b) => b.branch_id) ?? []
    } catch (e) {
      console.warn('[CRM layout] Failed to load tkt profile:', (e as Error).message)
    }
  }

  const sessionProp = session
    ? {
        user: {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name ?? null,
          tktRole,
          tktBranchIds,
        },
      }
    : {
        user: {
          id: 'preview-user',
          email: 'preview@ebright.my',
          name: 'Preview User',
          tktRole: 'super_admin' as const,
          tktBranchIds: [],
        },
      }

  return (
    <CrmProviders session={sessionProp}>
      <CrmShell session={sessionProp}>{children}</CrmShell>
    </CrmProviders>
  )
}
