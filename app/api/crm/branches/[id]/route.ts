import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/crm/auth'
import { prisma } from '@/lib/crm/db'
import { updateBranch } from '@/server/actions/branches'

async function resolveSession() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user?.id) return null
  const ub = await prisma.crm_user_branch.findFirst({
    where: { userId: session.user.id },
    select: { tenantId: true, role: true },
  })
  if (!ub) return null
  return { tenantId: ub.tenantId, userId: session.user.id, role: ub.role }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await resolveSession()
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await req.json()
    const branch = await updateBranch(ctx.tenantId, ctx.userId, id, body)
    return NextResponse.json(branch)
  } catch (err) {
    console.error('[PATCH /api/crm/branches/[id]]', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
