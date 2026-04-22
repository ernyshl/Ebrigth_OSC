/**
 * Data-Studio-style lead metrics.
 *
 * Returns per-branch + per-region counts of opportunities currently in key
 * stages (NL, CT, SU, ENR) plus funnel conversion rates, all filtered by a
 * date range based on crm_opportunity.createdAt.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/crm/auth'
import { prisma } from '@/lib/crm/db'

async function resolveTenantId(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user?.id) {
    if (process.env.CRM_PREVIEW_MODE !== 'true') return null
  }
  // Try crm_user_branch first
  if (session?.user?.id) {
    const ub = await prisma.crm_user_branch.findFirst({
      where: { userId: session.user.id },
      select: { tenantId: true },
    })
    if (ub) return ub.tenantId
  }
  // Fallback: default tenant (preview or new users without a branch link)
  const tenant = await prisma.crm_tenant.findUnique({
    where: { slug: 'ebright-demo' },
    select: { id: true },
  })
  return tenant?.id ?? null
}

/** Branch short-code lookup — matches the Data Studio labels */
// Keys are stored branch names (prefixed after rename migration).
const BRANCH_CODES: Record<string, string> = {
  '01 Ebright English Speaking (Rimbayu)': 'RBY',
  '02 Ebright English Speaking (Klang)': 'KLG',
  '03 Ebright English Speaking (Shah Alam)': 'SHA',
  '04 Ebright English Speaking (Setia Alam)': 'SA',
  '05 Ebright English Speaking (Denai Alam)': 'DA',
  '06 Ebright English Speaking (Eco Grandeur)': 'EGR',
  '07 Ebright English Speaking (Subang Taipan)': 'ST',
  '08 Ebright English Speaking (Danau Kota)': 'DK',
  '09 Ebright English Speaking (Kota Damansara)': 'KD',
  '10 Ebright English Speaking (Ampang)': 'AMP',
  '11 Ebright English Speaking (Sri Petaling)': 'SP',
  '12 Ebright English Speaking (Bandar Tun Hussein Onn)': 'BTHO',
  '13 Ebright English Speaking (Kajang TTDI Grove)': 'KTG',
  '14 Ebright English Speaking (Taman Sri Gombak)': 'TSG',
  '15 Ebright English Speaking (Putrajaya)': 'PJY',
  '16 Ebright English Speaking (Kota Warisan)': 'KW',
  '17 Ebright English Speaking (Bandar Baru Bangi)': 'BBB',
  '18 Ebright English Speaking (Cyberjaya)': 'CJY',
  '19 Ebright English Speaking (Bandar Seri Putra)': 'BSP',
  '20 Ebright English Speaking (Dataran Puchong Utama)': 'DPU',
  '21 Ebright English Speaking (Online)': 'ONL',
}

const REGIONS: Record<'A' | 'B' | 'C', string[]> = {
  A: [
    '01 Ebright English Speaking (Rimbayu)',
    '02 Ebright English Speaking (Klang)',
    '03 Ebright English Speaking (Shah Alam)',
    '04 Ebright English Speaking (Setia Alam)',
    '05 Ebright English Speaking (Denai Alam)',
    '06 Ebright English Speaking (Eco Grandeur)',
    '07 Ebright English Speaking (Subang Taipan)',
  ],
  B: [
    '08 Ebright English Speaking (Danau Kota)',
    '09 Ebright English Speaking (Kota Damansara)',
    '10 Ebright English Speaking (Ampang)',
    '11 Ebright English Speaking (Sri Petaling)',
    '12 Ebright English Speaking (Bandar Tun Hussein Onn)',
    '13 Ebright English Speaking (Kajang TTDI Grove)',
    '14 Ebright English Speaking (Taman Sri Gombak)',
  ],
  C: [
    '15 Ebright English Speaking (Putrajaya)',
    '16 Ebright English Speaking (Kota Warisan)',
    '17 Ebright English Speaking (Bandar Baru Bangi)',
    '18 Ebright English Speaking (Cyberjaya)',
    '19 Ebright English Speaking (Bandar Seri Putra)',
    '20 Ebright English Speaking (Dataran Puchong Utama)',
    '21 Ebright English Speaking (Online)',
  ],
}

// Stage-name detection
const STAGE_PATTERN = {
  NL:  /^new lead$/i,
  CT:  /^confirmed for trial$/i,
  SU:  /^show[- ]up$/i,
  ENR: /^enrolled$/i,
}

interface BranchMetrics {
  branchId: string
  branchName: string
  code: string
  NL: number
  CT: number
  SU: number
  ENR: number
  conversionRate: number   // ENR / NL
  confirmedRate: number    // CT / NL
  showUpRate: number       // SU / CT
  enrolmentRate: number    // ENR / SU
}

function zero(): Omit<BranchMetrics, 'branchId' | 'branchName' | 'code'> {
  return {
    NL: 0, CT: 0, SU: 0, ENR: 0,
    conversionRate: 0, confirmedRate: 0, showUpRate: 0, enrolmentRate: 0,
  }
}

function computeRates(m: Pick<BranchMetrics, 'NL' | 'CT' | 'SU' | 'ENR'>) {
  return {
    conversionRate: m.NL ? m.ENR / m.NL : 0,
    confirmedRate:  m.NL ? m.CT / m.NL  : 0,
    showUpRate:     m.CT ? m.SU / m.CT  : 0,
    enrolmentRate:  m.SU ? m.ENR / m.SU : 0,
  }
}

function parseDateRange(sp: URLSearchParams): { from: Date; to: Date } {
  const preset = sp.get('preset') ?? 'today'
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  const endOfToday = new Date(today.getTime() + 24 * 3600 * 1000 - 1)

  if (preset === 'custom') {
    const fromStr = sp.get('from') ?? today.toISOString()
    const toStr = sp.get('to') ?? endOfToday.toISOString()
    return { from: new Date(fromStr), to: new Date(toStr) }
  }

  switch (preset) {
    case 'yesterday': {
      const from = new Date(today.getTime() - 24 * 3600 * 1000)
      const to = new Date(today.getTime() - 1)
      return { from, to }
    }
    case '7d': {
      const from = new Date(today.getTime() - 6 * 24 * 3600 * 1000)
      return { from, to: endOfToday }
    }
    case 'this_week': {
      // Monday start
      const dow = today.getDay() // 0=Sun
      const daysBack = dow === 0 ? 6 : dow - 1
      const from = new Date(today.getTime() - daysBack * 24 * 3600 * 1000)
      return { from, to: endOfToday }
    }
    case '30d': {
      const from = new Date(today.getTime() - 29 * 24 * 3600 * 1000)
      return { from, to: endOfToday }
    }
    default: // today
      return { from: today, to: endOfToday }
  }
}

export async function GET(req: NextRequest) {
  try {
    const tenantId = await resolveTenantId()
    if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { from, to } = parseDateRange(req.nextUrl.searchParams)

    // Grab all stages — need id → category AND per-pipeline order of each category
    const stages = await prisma.crm_stage.findMany({
      where: { tenantId },
      select: { id: true, name: true, order: true, pipelineId: true },
    })

    // Map stage.id → { pipelineId, order, category }
    interface StageInfo {
      pipelineId: string
      order: number
      category?: keyof typeof STAGE_PATTERN
    }
    const stageInfo = new Map<string, StageInfo>()
    for (const s of stages) {
      let cat: keyof typeof STAGE_PATTERN | undefined
      for (const [k, re] of Object.entries(STAGE_PATTERN) as Array<[keyof typeof STAGE_PATTERN, RegExp]>) {
        if (re.test(s.name)) { cat = k; break }
      }
      stageInfo.set(s.id, { pipelineId: s.pipelineId, order: s.order, category: cat })
    }

    // Per-pipeline category order (e.g., NL=0, CT=5, SU=7, ENR=9 for lead pipelines)
    const categoryOrderByPipeline = new Map<
      string,
      { NL?: number; CT?: number; SU?: number; ENR?: number }
    >()
    for (const s of stages) {
      if (!s.pipelineId) continue
      const info = stageInfo.get(s.id)
      if (!info?.category) continue
      const bucket = categoryOrderByPipeline.get(s.pipelineId) ?? {}
      bucket[info.category] = s.order
      categoryOrderByPipeline.set(s.pipelineId, bucket)
    }

    // Fetch branches (just the ones we care about)
    const branches = await prisma.crm_branch.findMany({
      where: { tenantId, name: { in: Object.keys(BRANCH_CODES) } },
      select: { id: true, name: true },
    })

    // Count opportunities per (branchId, category) in the date range
    const opps = await prisma.crm_opportunity.findMany({
      where: {
        tenantId,
        deletedAt: null,
        createdAt: { gte: from, lte: to },
        branchId: { in: branches.map((b) => b.id) },
      },
      select: { id: true, branchId: true, stageId: true, createdAt: true },
    })

    // Initialise per-branch metrics
    const branchMetrics = new Map<string, BranchMetrics>()
    for (const b of branches) {
      branchMetrics.set(b.id, {
        branchId: b.id,
        branchName: b.name,
        code: BRANCH_CODES[b.name] ?? '',
        ...zero(),
      })
    }

    // Cumulative counting: an opp currently in stage with order >= N is counted
    // as having "reached" every category with order <= N.
    //
    // NL  = every opportunity (reached order 0 = entered the pipeline)
    // CT  = opps whose current stage.order >= CT stage.order
    // SU  = opps whose current stage.order >= SU stage.order
    // ENR = opps whose current stage.order >= ENR stage.order
    //
    // This makes the rates match what the user expects:
    //   Conversion   = ENR / NL   (end-to-end)
    //   Confirmed    = CT  / NL   (% reached CT)
    //   Show Up Rate = SU  / CT   (of those who confirmed, how many showed up)
    //   Enrolment    = ENR / SU   (of those who showed up, how many enrolled)
    for (const o of opps) {
      const m = branchMetrics.get(o.branchId)
      if (!m) continue

      const info = stageInfo.get(o.stageId)
      if (!info) continue

      const catOrders = categoryOrderByPipeline.get(info.pipelineId)
      if (!catOrders) continue

      // NL: every opp that entered the pipeline
      m.NL += 1

      if (catOrders.CT !== undefined && info.order >= catOrders.CT) m.CT += 1
      if (catOrders.SU !== undefined && info.order >= catOrders.SU) m.SU += 1
      if (catOrders.ENR !== undefined && info.order >= catOrders.ENR) m.ENR += 1
    }

    for (const m of branchMetrics.values()) {
      Object.assign(m, computeRates(m))
    }

    // Aggregate by region
    function aggregate(names: string[]): BranchMetrics {
      const list = branches
        .filter((b) => names.includes(b.name))
        .map((b) => branchMetrics.get(b.id))
        .filter((x): x is BranchMetrics => !!x)
      const NL  = list.reduce((s, x) => s + x.NL, 0)
      const CT  = list.reduce((s, x) => s + x.CT, 0)
      const SU  = list.reduce((s, x) => s + x.SU, 0)
      const ENR = list.reduce((s, x) => s + x.ENR, 0)
      return {
        branchId: '',
        branchName: '',
        code: '',
        NL, CT, SU, ENR,
        ...computeRates({ NL, CT, SU, ENR }),
      }
    }

    const regionA = aggregate(REGIONS.A)
    const regionB = aggregate(REGIONS.B)
    const regionC = aggregate(REGIONS.C)
    const main: BranchMetrics = {
      branchId: '',
      branchName: '',
      code: '',
      NL:  regionA.NL + regionB.NL + regionC.NL,
      CT:  regionA.CT + regionB.CT + regionC.CT,
      SU:  regionA.SU + regionB.SU + regionC.SU,
      ENR: regionA.ENR + regionB.ENR + regionC.ENR,
      conversionRate: 0, confirmedRate: 0, showUpRate: 0, enrolmentRate: 0,
    }
    Object.assign(main, computeRates(main))

    // Sort branches by region for the per-branch breakdown
    const orderedBranches = [...REGIONS.A, ...REGIONS.B, ...REGIONS.C]
      .map((name) => {
        const b = branches.find((x) => x.name === name)
        return b ? branchMetrics.get(b.id) : null
      })
      .filter((x): x is BranchMetrics => !!x)

    return NextResponse.json({
      range: { from: from.toISOString(), to: to.toISOString() },
      main,
      regions: { A: regionA, B: regionB, C: regionC },
      branches: orderedBranches,
      regionMap: {
        A: REGIONS.A.map((n) => BRANCH_CODES[n] ?? n),
        B: REGIONS.B.map((n) => BRANCH_CODES[n] ?? n),
        C: REGIONS.C.map((n) => BRANCH_CODES[n] ?? n),
      },
    })
  } catch (e) {
    console.error('[GET leads-metrics]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
