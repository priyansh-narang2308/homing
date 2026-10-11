export type EmailStatus = 'queued' | 'sending' | 'sent' | 'failed' | 'dlq'

export type EmailEventType =
  | 'queued'
  | 'claimed'
  | 'sent'
  | 'retry_scheduled'
  | 'failed'
  | 'dlq_moved'
  | 'replayed'

export interface EmailEvent {
  id: string
  email_id: string
  event_type: EmailEventType
  attempt: number
  worker_id: string
  details: string
  metadata?: Record<string, unknown>
  created_at: string
}

export interface Email {
  id: string
  from: string
  to: string
  subject: string
  status: EmailStatus
  attempts: number
  last_error?: string
  sent_at?: string
  idempotency_key?: string
  events?: EmailEvent[]
  created_at: string
  updated_at: string
}

export interface ApiKey {
  id: string
  name: string
  prefix: string
  last_used_at: string | null
  created_at: string
}

export interface CreatedApiKey extends ApiKey {
  key: string
}

export interface Usage {
  used: number
  // 0 means no daily limit
  limit: number
  resets_at: string
}

export interface Page<T> {
  data: T[]
  next_cursor: string | null
}
