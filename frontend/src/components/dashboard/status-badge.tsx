import type { EmailStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

const styles: Record<EmailStatus, string> = {
  sent: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
  failed: 'border-red-400/20 bg-red-400/10 text-red-300',
  sending: 'border-amber-400/20 bg-amber-400/10 text-amber-300',
  queued: 'border-cf-border bg-cf-fg/5 text-cf-fg-muted',
  dlq: 'border-orange-500/30 bg-orange-500/15 text-orange-300',
}

export function StatusBadge({ status }: { status: EmailStatus }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center rounded-md border px-2 text-xs font-medium',
        status === 'dlq' ? 'uppercase font-mono tracking-wider' : 'capitalize',
        styles[status],
      )}
    >
      {status === 'dlq' ? 'DLQ' : status}
    </span>
  )
}
