import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/crm/auth'
import { prisma } from '@/lib/crm/db'
import { getContactsByTenant } from '@/server/queries/contacts'
import { CreateContactSchema } from '@/lib/crm/validations/contact'
import { createContact } from '@/server/actions/contacts'
import { createHash } from 'crypto'

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function resolveTenantId(req: NextRequest): Promise<string | null> {
  // Try API key first
  const apiKey = req.headers.get('x-api-key')
  if (apiKey) {
    const hashed = createHash('sha256').update(apiKey, 'utf8').digest('hex')
    const keyRecord = await prisma.crm_api_key.findUnique({
      where: { hashedKey: hashed },
      select: { tenantId: true, revokedAt: true },
    })
    if (keyRecord && !keyRecord.revokedAt) return keyRecord.tenantId
  }

  // Fall back to session
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user?.id) return null

  const userBranch = await prisma.crm_user_branch.findFirst({
    where: { userId: session.user.id },
    select: { tenantId: true },
  })
  return userBranch?.tenantId ?? null
}

// ─── GET /api/crm/contacts ────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const tenantId = await resolveTenantId(req)
    if (!tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sp = req.nextUrl.searchParams
    const result = await getContactsByTenant(tenantId, {
      search: sp.get('search') ?? undefined,
      branchId: sp.get('branchId') ?? undefined,
      stageId: sp.get('stageId') ?? undefined,
      leadSourceId: sp.get('leadSourceId') ?? undefined,
      assignedUserId: sp.get('assignedUserId') ?? undefined,
      tagId: sp.get('tagId') ?? undefined,
      page: sp.get('page') ? Number(sp.get('page')) : undefined,
      pageSize: sp.get('pageSize') ? Number(sp.get('pageSize')) : undefined,
      sortBy: sp.get('sortBy') ?? undefined,
      sortDir: (sp.get('sortDir') as 'asc' | 'desc') ?? undefined,
    })

    return NextResponse.json(result)
  } catch (err) {
    console.error('[GET /api/crm/contacts]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── POST /api/crm/contacts ───────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const tenantId = await resolveTenantId(req)
    if (!tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = CreateContactSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', issues: parsed.error.issues },
        { status: 400 },
      )
    }

    const branchId = body.branchId
    if (!branchId || typeof branchId !== 'string') {
      return NextResponse.json({ error: 'branchId is required' }, { status: 400 })
    }

    const result = await createContact(branchId, parsed.data)
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ contactId: result.contactId }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/crm/contacts]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
