'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@/lib/crm/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface BranchMetrics {
  branchId: string
  branchName: string
  code: string
  NL: number
  CT: number
  SU: number
  ENR: number
  conversionRate: number
  confirmedRate: number
  showUpRate: number
  enrolmentRate: number
}

interface MetricsResponse {
  range: { from: string; to: string }
  main: BranchMetrics
  regions: { A: BranchMetrics; B: BranchMetrics; C: BranchMetrics }
  branches: BranchMetrics[]
  regionMap: { A: string[]; B: string[]; C: string[] }
}

type Preset = 'today' | 'yesterday' | '7d' | 'this_week' | '30d'

const PRESETS: Array<{ key: Preset; label: string }> = [
  { key: 'today',     label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: '7d',        label: 'Last 7 Days' },
  { key: 'this_week', label: 'This Week (Mon)' },
  { key: '30d',       label: 'Last 30 Days' },
]

// ─── Component ────────────────────────────────────────────────────────────────

export function DashboardClient() {
  const [preset, setPreset] = useState<Preset>('today')

  const { data, isLoading } = useQuery<MetricsResponse>({
    queryKey: ['crm', 'dashboard', 'leads-metrics', preset],
    queryFn: async () => {
      const res = await fetch(`/api/crm/dashboard/leads-metrics?preset=${preset}`)
      if (!res.ok) throw new Error('Failed to load metrics')
      return res.json()
    },
  })

  const rangeLabel = useMemo(() => {
    if (!data) return ''
    const from = new Date(data.range.from)
    const to = new Date(data.range.to)
    const fmt = (d: Date) =>
      d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    return fmt(from) === fmt(to) ? fmt(from) : `${fmt(from)} – ${fmt(to)}`
  }, [data])

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Leads Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {rangeLabel || 'Select a range'} · Opportunities created in range
          </p>
        </div>
        <div className="rounded-full bg-slate-100 p-1 text-sm dark:bg-slate-800">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPreset(p.key)}
              className={cn(
                'rounded-full px-3 py-1.5 transition',
                preset === p.key
                  ? 'bg-white text-indigo-700 shadow-sm dark:bg-slate-900 dark:text-indigo-400'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : !data ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
          Failed to load metrics.
        </div>
      ) : (
        <>
          <MetricsBlock title="Main" subtitle="Overall pipeline" metrics={data.main} accent="indigo" />

          <div className="grid gap-5 lg:grid-cols-3">
            <MetricsBlock
              title="Region A"
              subtitle={data.regionMap.A.join(' · ')}
              metrics={data.regions.A}
              accent="rose"
              compact
            />
            <MetricsBlock
              title="Region B"
              subtitle={data.regionMap.B.join(' · ')}
              metrics={data.regions.B}
              accent="amber"
              compact
            />
            <MetricsBlock
              title="Region C"
              subtitle={data.regionMap.C.join(' · ')}
              metrics={data.regions.C}
              accent="emerald"
              compact
            />
          </div>

          <BranchBarChart branches={data.branches} />

          <BranchTable branches={data.branches} />
        </>
      )}
    </div>
  )
}

// ─── Metrics block (Main or per-region) ───────────────────────────────────────

const ACCENT_CLASSES = {
  indigo:  'text-indigo-600 dark:text-indigo-400',
  rose:    'text-rose-600 dark:text-rose-400',
  amber:   'text-amber-600 dark:text-amber-400',
  emerald: 'text-emerald-600 dark:text-emerald-400',
} as const
type Accent = keyof typeof ACCENT_CLASSES

function MetricsBlock({
  title,
  subtitle,
  metrics,
  accent,
  compact = false,
}: {
  title: string
  subtitle?: string
  metrics: BranchMetrics
  accent: Accent
  compact?: boolean
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-4 flex items-baseline justify-between gap-2">
        <div>
          <h2 className={cn('text-lg font-bold', ACCENT_CLASSES[accent])}>{title}</h2>
          {subtitle && <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">{subtitle}</p>}
        </div>
      </div>

      <div className={cn('grid gap-3', compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4')}>
        <Stat label="NL" value={metrics.NL} bold />
        <Stat label="CT" value={metrics.CT} bold />
        <Stat label="SU" value={metrics.SU} bold />
        <Stat label="ENR" value={metrics.ENR} bold />
      </div>

      <div className={cn('mt-3 grid gap-3', compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4')}>
        <Stat label="Conversion Rate" value={pct(metrics.conversionRate)} hint="ENR / NL" />
        <Stat label="Confirmed Rate" value={pct(metrics.confirmedRate)} hint="CT / NL" />
        <Stat label="Show Up Rate"   value={pct(metrics.showUpRate)}    hint="SU / CT" />
        <Stat label="Enrolment Rate" value={pct(metrics.enrolmentRate)} hint="ENR / SU" />
      </div>
    </div>
  )
}

function Stat({ label, value, hint, bold }: { label: string; value: string | number; hint?: string; bold?: boolean }) {
  return (
    <div className="rounded-md border border-slate-200 px-3 py-2 dark:border-slate-700">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className={cn('mt-0.5', bold ? 'text-2xl font-bold' : 'text-xl font-semibold', 'text-slate-900 dark:text-slate-100')}>
        {value}
      </div>
      {hint && <div className="text-[10px] text-slate-400 dark:text-slate-500">{hint}</div>}
    </div>
  )
}

function pct(v: number): string {
  if (!isFinite(v) || v === 0) return '—'
  return `${(v * 100).toFixed(2)}%`
}

// ─── Bar chart (NL per branch) ────────────────────────────────────────────────

function BranchBarChart({ branches }: { branches: BranchMetrics[] }) {
  const max = Math.max(1, ...branches.map((b) => b.NL))

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">New Leads by Branch</h2>
        <div className="flex items-center gap-4 text-[11px] text-slate-500 dark:text-slate-400">
          <LegendDot color="bg-rose-500" label="Region A" />
          <LegendDot color="bg-amber-500" label="Region B" />
          <LegendDot color="bg-emerald-500" label="Region C" />
        </div>
      </div>

      {branches.every((b) => b.NL === 0) ? (
        <p className="py-10 text-center text-sm text-slate-400">No leads in this range.</p>
      ) : (
        <div className="space-y-1.5">
          {branches.map((b, i) => {
            const regionIndex =
              i < 7  ? 'A' :
              i < 14 ? 'B' :
                       'C'
            const barColor =
              regionIndex === 'A' ? 'bg-rose-500' :
              regionIndex === 'B' ? 'bg-amber-500' :
                                    'bg-emerald-500'
            const pctWidth = (b.NL / max) * 100
            return (
              <div key={b.branchId} className="flex items-center gap-3">
                <div className="w-16 truncate font-mono text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  {b.code || '—'}
                </div>
                <div className="flex-1 truncate text-xs text-slate-700 dark:text-slate-300">
                  {b.branchName.replace(/^.*?-\s*/, '')}
                </div>
                <div className="h-5 flex-[2] rounded-full bg-slate-100 dark:bg-slate-700">
                  <div
                    className={cn(barColor, 'h-full rounded-full transition-all')}
                    style={{ width: `${pctWidth}%` }}
                  />
                </div>
                <div className="w-10 text-right font-mono text-xs font-semibold tabular-nums text-slate-800 dark:text-slate-200">
                  {b.NL}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn('h-2.5 w-2.5 rounded-full', color)} />
      {label}
    </span>
  )
}

// ─── Per-branch table ─────────────────────────────────────────────────────────

function BranchTable({ branches }: { branches: BranchMetrics[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
      <table className="w-full text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
          <tr>
            <th className="px-4 py-2.5">Branch</th>
            <th className="px-4 py-2.5">Code</th>
            <th className="px-4 py-2.5 text-right">NL</th>
            <th className="px-4 py-2.5 text-right">CT</th>
            <th className="px-4 py-2.5 text-right">SU</th>
            <th className="px-4 py-2.5 text-right">ENR</th>
            <th className="px-4 py-2.5 text-right">Conv</th>
            <th className="px-4 py-2.5 text-right">Enrol</th>
          </tr>
        </thead>
        <tbody>
          {branches.map((b) => (
            <tr
              key={b.branchId}
              className="border-b border-slate-100 text-slate-800 last:border-0 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700/50"
            >
              <td className="px-4 py-2.5 font-medium">{b.branchName.replace(/^.*?-\s*/, '')}</td>
              <td className="px-4 py-2.5 font-mono text-xs text-slate-500 dark:text-slate-400">{b.code || '—'}</td>
              <td className="px-4 py-2.5 text-right font-mono tabular-nums">{b.NL}</td>
              <td className="px-4 py-2.5 text-right font-mono tabular-nums">{b.CT}</td>
              <td className="px-4 py-2.5 text-right font-mono tabular-nums">{b.SU}</td>
              <td className="px-4 py-2.5 text-right font-mono tabular-nums">{b.ENR}</td>
              <td className="px-4 py-2.5 text-right font-mono tabular-nums text-indigo-600 dark:text-indigo-400">
                {pct(b.conversionRate)}
              </td>
              <td className="px-4 py-2.5 text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                {pct(b.enrolmentRate)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-5">
      <div className="h-56 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="h-48 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
        <div className="h-48 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
        <div className="h-48 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
      </div>
      <div className="h-72 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
    </div>
  )
}
