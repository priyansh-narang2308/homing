-- +goose Up

CREATE TABLE email_templates (
    id           UUID PRIMARY KEY,
    user_id      UUID NOT NULL REFERENCES neon_auth."user" (id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    slug         TEXT NOT NULL,
    description  TEXT NOT NULL DEFAULT '',
    subject      TEXT NOT NULL,
    html_content TEXT NOT NULL,
    sample_vars  JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT email_templates_user_slug_unique UNIQUE (user_id, slug)
);

CREATE INDEX email_templates_user_slug_idx ON email_templates (user_id, slug);
CREATE INDEX email_templates_user_created_idx ON email_templates (user_id, created_at DESC);

-- +goose Down
DROP TABLE IF EXISTS email_templates;
