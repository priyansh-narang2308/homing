-- +goose Up

-- 1. Add idempotency_key to emails
ALTER TABLE emails ADD COLUMN idempotency_key TEXT;
CREATE UNIQUE INDEX emails_user_idempotency_idx ON emails (user_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

-- 2. Update status constraint to include 'dlq'
ALTER TABLE emails DROP CONSTRAINT IF EXISTS emails_status_check;
ALTER TABLE emails ADD CONSTRAINT emails_status_check CHECK (status IN ('queued', 'sending', 'sent', 'failed', 'dlq'));

-- 3. Create email_events table for delivery intelligence lifecycle audit
CREATE TABLE email_events (
    id          UUID PRIMARY KEY,
    email_id    UUID        NOT NULL REFERENCES emails (id) ON DELETE CASCADE,
    event_type  TEXT        NOT NULL,
    attempt     INT         NOT NULL DEFAULT 1,
    worker_id   TEXT        NOT NULL DEFAULT '',
    details     TEXT        NOT NULL DEFAULT '',
    metadata    JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX email_events_email_id_created_at_idx ON email_events (email_id, created_at ASC);

-- +goose Down
DROP TABLE IF EXISTS email_events;
DROP INDEX IF EXISTS emails_user_idempotency_idx;
ALTER TABLE emails DROP COLUMN IF EXISTS idempotency_key;
ALTER TABLE emails DROP CONSTRAINT IF EXISTS emails_status_check;
ALTER TABLE emails ADD CONSTRAINT emails_status_check CHECK (status IN ('queued', 'sending', 'sent', 'failed'));
