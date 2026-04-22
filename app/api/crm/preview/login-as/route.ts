import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/crm/db'

const Schema = z.object({ userId: z.string().min(1) })

export async function POST(req: NextRequest) {
  if (process.env.CRM_PREVIEW_MODE !== 'true') {
    return NextResponse.json({ error: 'Preview mode disabled' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = Schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 422 })
  }

  const user = await prisma.crm_auth_user.findUnique({
    where: { id: parsed.data.userId },
    select: { id: true, email: true, name: true },
  })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const res = NextResponse.json({ success: true, user })
  res.cookies.set('crm_preview_user', user.id, {
    path: '/',
    httpOnly: false,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
  })
  res.cookies.set('crm_preview_exit', '', { path: '/', maxAge: 0 })
  return res
}
