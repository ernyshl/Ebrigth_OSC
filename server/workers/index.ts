/**
 * Workers entry point.
 *
 * Starts all BullMQ workers and sets up repeatable scheduled jobs.
 * Run via: npm run worker  (i.e. tsx server/workers/index.ts)
 *
 * Handles SIGTERM for graceful shutdown.
 */

import { automationWorker } from './automationWorker'
import { messageSenderWorker } from './messageSenderWorker'
import { reminderWorker, scheduleReminderScan } from './reminderWorker'
import { digestWorker, scheduleDigest } from './digestWorker'
import { ticketEmailWorker, startTicketEmailWorker } from './ticketEmailWorker'
import { staleTicketWorker, startStaleTicketWorker } from './staleTicketWorker'

const workers = [
  automationWorker,
  messageSenderWorker,
  reminderWorker,
  digestWorker,
  ticketEmailWorker,
  staleTicketWorker,
]

async function main() {
  console.log('[workers] Starting CRM workers...')

  // Set up repeatable scheduled jobs
  await scheduleReminderScan()
  await scheduleDigest()
  startTicketEmailWorker()
  await startStaleTicketWorker()

  console.log('[workers] All workers started:')
  console.log('  - automationWorker    (crm.automation)')
  console.log('  - messageSenderWorker (crm.message_sender)')
  console.log('  - reminderWorker      (crm.reminder) — hourly scan')
  console.log('  - digestWorker        (crm.digest)   — daily at 08:00 KL')
  console.log('  - ticketEmailWorker   (tkt.email_sender)')
  console.log('  - staleTicketWorker   (tkt.stale_reminder) — hourly scan')
}

// ─── Graceful shutdown ─────────────────────────────────────────────────────────

async function shutdown(signal: string) {
  console.log(`\n[workers] Received ${signal} — shutting down gracefully...`)

  await Promise.allSettled(workers.map((w) => w.close()))

  console.log('[workers] All workers closed. Exiting.')
  process.exit(0)
}

process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))

main().catch((err) => {
  console.error('[workers] Fatal startup error:', err)
  process.exit(1)
})
