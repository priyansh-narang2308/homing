-- +goose Up

CREATE TABLE webhook_endpoints (
    id          UUID PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES neon_auth."user" (id) ON DELETE CASCADE,
    url         TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    secret      TEXT NOT NULL,
    events      TEXT NOT NULL DEFAULT '*',
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX webhook_endpoints_user_id_idx ON webhook_endpoints (user_id, created_at DESC);

CREATE TABLE webhook_deliveries (
    id             UUID PRIMARY KEY,
    endpoint_id    UUID NOT NULL REFERENCES webhook_endpoints (id) ON DELETE CASCADE,
    user_id        UUID NOT NULL REFERENCES neon_auth."user" (id) ON DELETE CASCADE,
    event_type     TEXT NOT NULL,
    payload        JSONB NOT NULL DEFAULT '{}'::jsonb,
    response_code  INT NOT NULL DEFAULT 0,
    response_body  TEXT NOT NULL DEFAULT '',
    error          TEXT NOT NULL DEFAULT '',
    latency_ms     INT NOT NULL DEFAULT 0,
    status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'delivered', 'failed')),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX webhook_deliveries_endpoint_id_idx ON webhook_deliveries (endpoint_id, created_at DESC);
CREATE INDEX webhook_deliveries_user_id_idx ON webhook_deliveries (user_id, created_at DESC);

-- +goose Down
DROP TABLE IF EXISTS webhook_deliveries;
DROP TABLE IF EXISTS webhook_endpoints;
