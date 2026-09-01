CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE user_role           AS ENUM ('employee', 'partner', 'admin');
CREATE TYPE user_status         AS ENUM ('active', 'suspended', 'closed');
CREATE TYPE link_status         AS ENUM ('active', 'ended');
CREATE TYPE partner_status      AS ENUM ('pending', 'approved', 'rejected', 'suspended', 'closed');
CREATE TYPE account_owner       AS ENUM ('employee', 'partner', 'system');
CREATE TYPE account_status      AS ENUM ('active', 'suspended', 'closed');
CREATE TYPE token_status        AS ENUM ('active', 'consumed', 'expired', 'cancelled');
CREATE TYPE operation_kind      AS ENUM ('topup', 'payment', 'compensation', 'closure_forfeit');
CREATE TYPE entry_direction     AS ENUM ('debit', 'credit');
CREATE TYPE entry_mode          AS ENUM ('qr_scan', 'short_code');
CREATE TYPE batch_status        AS ENUM ('draft', 'validated', 'rejected');
CREATE TYPE service_mode        AS ENUM ('physical', 'online', 'both');
CREATE TYPE highlight_placement AS ENUM ('minister_pick', 'public_featured');

CREATE TABLE cities (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    department  TEXT NOT NULL,

    CONSTRAINT cities_name_department_unique UNIQUE (name, department)
);

CREATE INDEX idx_cities_name ON cities (name);

CREATE TABLE users (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email          CITEXT      NOT NULL UNIQUE,
    password_hash  TEXT        NOT NULL,
    role           user_role   NOT NULL,
    status         user_status NOT NULL DEFAULT 'active',
    last_login_at  TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE employers (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    legal_name     TEXT        NOT NULL,
    ifu            TEXT UNIQUE,
    contact_email  CITEXT,
    contact_phone  TEXT,
    status         user_status NOT NULL DEFAULT 'active',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE accounts (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_type       account_owner  NOT NULL,
    owner_id         UUID,
    system_code      TEXT UNIQUE,
    payment_handle   TEXT UNIQUE,
    opening_balance  BIGINT         NOT NULL DEFAULT 0,
    balance_settled  BIGINT         NOT NULL DEFAULT 0,
    balance_held     BIGINT         NOT NULL DEFAULT 0,
    status           account_status NOT NULL DEFAULT 'active',
    version          BIGINT         NOT NULL DEFAULT 0,
    opened_at        TIMESTAMPTZ    NOT NULL DEFAULT now(),
    closed_at        TIMESTAMPTZ,

    CONSTRAINT accounts_settled_non_negative CHECK (balance_settled >= 0),
    CONSTRAINT accounts_held_non_negative    CHECK (balance_held >= 0),
    CONSTRAINT accounts_held_lte_settled     CHECK (balance_held <= balance_settled),
    CONSTRAINT accounts_opening_non_negative CHECK (opening_balance >= 0),
    CONSTRAINT accounts_opening_system_only  CHECK (owner_type = 'system' OR opening_balance = 0),
    CONSTRAINT accounts_owner_coherence CHECK (
        (owner_type =  'system' AND owner_id IS     NULL AND system_code IS NOT NULL) OR
        (owner_type <> 'system' AND owner_id IS NOT NULL AND system_code IS     NULL)
    )
);

CREATE INDEX idx_accounts_owner ON accounts (owner_type, owner_id);

CREATE TABLE employees (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL UNIQUE REFERENCES users (id),
    last_name   TEXT        NOT NULL,
    first_name  TEXT        NOT NULL,
    phone       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE employment_links (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id   UUID        NOT NULL REFERENCES employees (id),
    employer_id   UUID        NOT NULL REFERENCES employers (id),
    employer_ref  TEXT        NOT NULL,
    account_id    UUID        NOT NULL REFERENCES accounts (id),
    status        link_status NOT NULL DEFAULT 'active',
    started_at    DATE        NOT NULL,
    ended_at      DATE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT employment_ended_after_started
        CHECK (ended_at IS NULL OR ended_at >= started_at),
    CONSTRAINT employment_status_matches_dates
        CHECK ((status = 'ended') = (ended_at IS NOT NULL))
);

CREATE UNIQUE INDEX uq_active_employment
    ON employment_links (employee_id) WHERE status = 'active';

CREATE UNIQUE INDEX uq_employer_ref
    ON employment_links (employer_id, employer_ref);

CREATE INDEX idx_employment_account ON employment_links (account_id);

CREATE TABLE partners (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID           NOT NULL UNIQUE REFERENCES users (id),
    account_id     UUID           NOT NULL UNIQUE REFERENCES accounts (id),
    legal_name     TEXT           NOT NULL,
    trade_name     TEXT           NOT NULL,
    category       TEXT           NOT NULL,
    ifu            TEXT,
    service_mode   service_mode   NOT NULL DEFAULT 'physical',
    website_url    TEXT,
    city_id        UUID REFERENCES cities (id),
    district       TEXT,
    address_line   TEXT,
    latitude       NUMERIC(9,6),
    longitude      NUMERIC(9,6),
    status         partner_status NOT NULL DEFAULT 'pending',
    submitted_at   TIMESTAMPTZ    NOT NULL DEFAULT now(),
    reviewed_by    UUID REFERENCES users (id),
    reviewed_at    TIMESTAMPTZ,
    review_reason  TEXT,

    CONSTRAINT physical_needs_city
        CHECK (service_mode = 'online' OR city_id IS NOT NULL)
);

CREATE INDEX idx_partners_catalog
    ON partners (status, city_id, service_mode, trade_name, id);

CREATE INDEX idx_partners_review ON partners (status, submitted_at);

CREATE TABLE payment_tokens (
    jti          UUID PRIMARY KEY,
    account_id   UUID         NOT NULL REFERENCES accounts (id),
    amount       BIGINT       NOT NULL,
    short_code   TEXT         NOT NULL,
    status       token_status NOT NULL DEFAULT 'active',
    issued_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    expires_at   TIMESTAMPTZ  NOT NULL,
    resolved_at  TIMESTAMPTZ,

    CONSTRAINT tokens_amount_positive        CHECK (amount > 0),
    CONSTRAINT tokens_expires_after_issue    CHECK (expires_at > issued_at),
    CONSTRAINT tokens_resolved_matches_status
        CHECK ((status = 'active') = (resolved_at IS NULL))
);

CREATE UNIQUE INDEX uq_active_short_code
    ON payment_tokens (short_code) WHERE status = 'active';

CREATE INDEX idx_tokens_expiry
    ON payment_tokens (expires_at) WHERE status = 'active';

CREATE INDEX idx_tokens_account_active
    ON payment_tokens (account_id) WHERE status = 'active';

CREATE TABLE ledger_operations (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kind         operation_kind NOT NULL,
    amount       BIGINT         NOT NULL,
    memo         TEXT,
    created_by   UUID REFERENCES users (id),
    occurred_at  TIMESTAMPTZ    NOT NULL,
    recorded_at  TIMESTAMPTZ    NOT NULL DEFAULT now(),

    CONSTRAINT operations_amount_positive CHECK (amount > 0)
);

CREATE INDEX idx_operations_occurred ON ledger_operations (occurred_at DESC, id);

CREATE TABLE ledger_entries (
    seq           BIGSERIAL PRIMARY KEY,
    operation_id  UUID            NOT NULL REFERENCES ledger_operations (id),
    account_id    UUID            NOT NULL REFERENCES accounts (id),
    direction     entry_direction NOT NULL,
    amount        BIGINT          NOT NULL,
    recorded_at   TIMESTAMPTZ     NOT NULL DEFAULT now(),
    prev_hash     BYTEA           NOT NULL,
    hash          BYTEA           NOT NULL UNIQUE,

    CONSTRAINT entries_amount_positive CHECK (amount > 0),
    CONSTRAINT entries_hash_is_sha256  CHECK (octet_length(hash) = 32),
    CONSTRAINT entries_prev_is_sha256  CHECK (octet_length(prev_hash) = 32)
);

CREATE INDEX idx_entries_account   ON ledger_entries (account_id, seq);
CREATE INDEX idx_entries_operation ON ledger_entries (operation_id);

CREATE TABLE topup_batches (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employer_id   UUID         NOT NULL REFERENCES employers (id),
    file_name     TEXT         NOT NULL,
    file_hash     BYTEA        NOT NULL,
    line_count    INT          NOT NULL,
    total_amount  BIGINT       NOT NULL,
    status        batch_status NOT NULL DEFAULT 'draft',
    uploaded_by   UUID         NOT NULL REFERENCES users (id),
    uploaded_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    validated_at  TIMESTAMPTZ,

    CONSTRAINT batches_hash_is_sha256 CHECK (octet_length(file_hash) = 32)
);

CREATE UNIQUE INDEX uq_batch_file ON topup_batches (employer_id, file_hash);

CREATE TABLE payments (
    operation_id  UUID PRIMARY KEY REFERENCES ledger_operations (id),
    token_jti     UUID        NOT NULL UNIQUE REFERENCES payment_tokens (jti),
    partner_id    UUID        NOT NULL REFERENCES partners (id),
    from_account  UUID        NOT NULL REFERENCES accounts (id),
    entry_mode    entry_mode  NOT NULL,
    scanned_at    TIMESTAMPTZ NOT NULL,
    synced_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_partner ON payments (partner_id, scanned_at DESC);

CREATE TABLE topups (
    operation_id  UUID PRIMARY KEY REFERENCES ledger_operations (id),
    batch_id      UUID REFERENCES topup_batches (id),
    employer_id   UUID NOT NULL REFERENCES employers (id),
    to_account    UUID NOT NULL REFERENCES accounts (id),
    reference     TEXT
);

CREATE UNIQUE INDEX uq_topup_reference
    ON topups (employer_id, reference) WHERE reference IS NOT NULL;

CREATE INDEX idx_topups_batch ON topups (batch_id);

CREATE TABLE compensations (
    operation_id           UUID PRIMARY KEY REFERENCES ledger_operations (id),
    original_operation_id  UUID NOT NULL REFERENCES ledger_operations (id),
    reason                 TEXT NOT NULL,
    approved_by            UUID NOT NULL REFERENCES users (id),

    CONSTRAINT compensations_reason_not_blank CHECK (btrim(reason) <> ''),
    CONSTRAINT compensations_not_self CHECK (operation_id <> original_operation_id)
);

CREATE UNIQUE INDEX uq_compensation_original ON compensations (original_operation_id);

CREATE TABLE partner_highlights (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id  UUID                NOT NULL REFERENCES partners (id),
    placement   highlight_placement NOT NULL,
    position    INT                 NOT NULL,
    created_by  UUID                NOT NULL REFERENCES users (id),
    created_at  TIMESTAMPTZ         NOT NULL DEFAULT now(),
    removed_at  TIMESTAMPTZ,

    CONSTRAINT highlights_position_positive CHECK (position >= 0)
);

CREATE UNIQUE INDEX uq_highlight_active_partner
    ON partner_highlights (placement, partner_id) WHERE removed_at IS NULL;

CREATE UNIQUE INDEX uq_highlight_active_position
    ON partner_highlights (placement, position) WHERE removed_at IS NULL;

CREATE TABLE sessions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID        NOT NULL REFERENCES users (id),
    token_hash    BYTEA       NOT NULL UNIQUE,
    ip_address    INET,
    user_agent    TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at    TIMESTAMPTZ NOT NULL,
    revoked_at    TIMESTAMPTZ
);

CREATE INDEX idx_sessions_user ON sessions (user_id) WHERE revoked_at IS NULL;

CREATE TABLE api_clients (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employer_id   UUID        NOT NULL REFERENCES employers (id),
    client_id     TEXT        NOT NULL UNIQUE,
    secret_hash   TEXT        NOT NULL,
    label         TEXT        NOT NULL,
    status        user_status NOT NULL DEFAULT 'active',
    last_used_at  TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id    UUID REFERENCES users (id),
    action      TEXT        NOT NULL,
    entity_type TEXT        NOT NULL,
    entity_id   UUID,
    payload     JSONB,
    ip_address  INET,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_entity ON audit_log (entity_type, entity_id, created_at DESC);
CREATE INDEX idx_audit_actor  ON audit_log (actor_id, created_at DESC);

CREATE FUNCTION forbid_mutation() RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Table % immuable : ni UPDATE ni DELETE.', TG_TABLE_NAME
        USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ledger_entries_immutable
    BEFORE UPDATE OR DELETE ON ledger_entries
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE TRIGGER trg_ledger_operations_immutable
    BEFORE UPDATE OR DELETE ON ledger_operations
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE TRIGGER trg_payments_immutable
    BEFORE UPDATE OR DELETE ON payments
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE TRIGGER trg_topups_immutable
    BEFORE UPDATE OR DELETE ON topups
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE TRIGGER trg_compensations_immutable
    BEFORE UPDATE OR DELETE ON compensations
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE TRIGGER trg_audit_log_immutable
    BEFORE UPDATE OR DELETE ON audit_log
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cartepro_app') THEN
        RAISE NOTICE 'cartepro_app absent : GRANT et REVOKE non appliques';
        RETURN;
    END IF;

    EXECUTE 'GRANT USAGE ON SCHEMA public TO cartepro_app';
    EXECUTE 'GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA public TO cartepro_app';
    EXECUTE 'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO cartepro_app';
    EXECUTE 'GRANT UPDATE ON
                 accounts, users, employees, employers, employment_links,
                 partners, partner_highlights, payment_tokens, topup_batches,
                 sessions, api_clients
             TO cartepro_app';

    EXECUTE 'REVOKE UPDATE, DELETE, TRUNCATE ON
                 ledger_entries, ledger_operations, payments,
                 topups, compensations, audit_log
             FROM cartepro_app';
END;
$$;

INSERT INTO accounts (owner_type, owner_id, system_code, opening_balance, balance_settled, balance_held)
VALUES
    ('system', NULL, 'MINISTRY_ISSUANCE', 1000000000000, 1000000000000, 0),
    ('system', NULL, 'CLOSURE_FORFEIT',   0, 0, 0);
