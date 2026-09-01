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
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT NOT NULL,
    department TEXT NOT NULL
);

CREATE UNIQUE INDEX uq_cities_name_department ON cities (name, department);

CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         CITEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          user_role NOT NULL,
    status        user_status NOT NULL DEFAULT 'active',
    last_login_at TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE employers (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    legal_name    TEXT NOT NULL,
    ifu           TEXT UNIQUE,
    contact_email CITEXT,
    contact_phone TEXT,
    status        user_status NOT NULL DEFAULT 'active',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE accounts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_type      account_owner NOT NULL,
    owner_id        UUID,
    system_code     TEXT UNIQUE,
    payment_handle  TEXT UNIQUE,
    balance_settled BIGINT NOT NULL DEFAULT 0,
    balance_held    BIGINT NOT NULL DEFAULT 0,
    status          account_status NOT NULL DEFAULT 'active',
    version         BIGINT NOT NULL DEFAULT 0,
    opened_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at       TIMESTAMPTZ,
    CONSTRAINT settled_never_negative CHECK (balance_settled >= 0),
    CONSTRAINT held_never_negative    CHECK (balance_held >= 0),
    CONSTRAINT held_within_settled    CHECK (balance_held <= balance_settled),
    CONSTRAINT system_account_shape   CHECK (
        (owner_type = 'system' AND owner_id IS NULL AND system_code IS NOT NULL)
        OR
        (owner_type <> 'system' AND owner_id IS NOT NULL AND system_code IS NULL)
    )
);

CREATE INDEX idx_accounts_owner ON accounts (owner_type, owner_id);

CREATE TABLE employees (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL UNIQUE REFERENCES users (id),
    last_name  TEXT NOT NULL,
    first_name TEXT NOT NULL,
    phone      TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE employment_links (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees (id),
    employer_id UUID NOT NULL REFERENCES employers (id),
    employer_ref TEXT NOT NULL,
    account_id  UUID NOT NULL REFERENCES accounts (id),
    status      link_status NOT NULL DEFAULT 'active',
    started_at  DATE NOT NULL,
    ended_at    DATE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ended_after_started CHECK (ended_at IS NULL OR ended_at >= started_at),
    CONSTRAINT ended_link_has_date CHECK (status = 'active' OR ended_at IS NOT NULL)
);

CREATE UNIQUE INDEX uq_active_employment ON employment_links (employee_id) WHERE status = 'active';
CREATE UNIQUE INDEX uq_employer_ref ON employment_links (employer_id, employer_ref) WHERE status = 'active';
CREATE INDEX idx_employment_links_employer ON employment_links (employer_id);

CREATE TABLE partners (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL UNIQUE REFERENCES users (id),
    account_id    UUID NOT NULL UNIQUE REFERENCES accounts (id),
    legal_name    TEXT NOT NULL,
    trade_name    TEXT NOT NULL,
    category      TEXT NOT NULL,
    ifu           TEXT,
    service_mode  service_mode NOT NULL DEFAULT 'physical',
    website_url   TEXT,
    city_id       UUID REFERENCES cities (id),
    district      TEXT,
    address_line  TEXT,
    latitude      NUMERIC(9,6),
    longitude     NUMERIC(9,6),
    status        partner_status NOT NULL DEFAULT 'pending',
    submitted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_by   UUID REFERENCES users (id),
    reviewed_at   TIMESTAMPTZ,
    review_reason TEXT,
    CONSTRAINT physical_needs_city CHECK (service_mode = 'online' OR city_id IS NOT NULL),
    CONSTRAINT reviewed_is_complete CHECK (
        (reviewed_by IS NULL AND reviewed_at IS NULL)
        OR
        (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
    )
);

CREATE INDEX idx_partners_catalog ON partners (service_mode, city_id, category) WHERE status = 'approved';

CREATE TABLE partner_highlights (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID NOT NULL REFERENCES partners (id),
    placement  highlight_placement NOT NULL,
    position   INT NOT NULL,
    created_by UUID NOT NULL REFERENCES users (id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    removed_at TIMESTAMPTZ,
    CONSTRAINT position_is_positive CHECK (position > 0)
);

CREATE UNIQUE INDEX uq_active_highlight_partner ON partner_highlights (placement, partner_id) WHERE removed_at IS NULL;
CREATE UNIQUE INDEX uq_active_highlight_position ON partner_highlights (placement, position) WHERE removed_at IS NULL;

CREATE TABLE payment_tokens (
    jti         UUID PRIMARY KEY,
    account_id  UUID NOT NULL REFERENCES accounts (id),
    amount      BIGINT NOT NULL,
    short_code  TEXT NOT NULL,
    status      token_status NOT NULL DEFAULT 'active',
    issued_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at  TIMESTAMPTZ NOT NULL,
    resolved_at TIMESTAMPTZ,
    CONSTRAINT token_amount_is_positive CHECK (amount > 0),
    CONSTRAINT token_expires_after_issue CHECK (expires_at > issued_at),
    CONSTRAINT resolved_token_has_date CHECK (status = 'active' OR resolved_at IS NOT NULL)
);

CREATE UNIQUE INDEX uq_active_short_code ON payment_tokens (short_code) WHERE status = 'active';
CREATE INDEX idx_tokens_expiry ON payment_tokens (expires_at) WHERE status = 'active';
CREATE INDEX idx_tokens_account ON payment_tokens (account_id, issued_at DESC);

CREATE TABLE ledger_operations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kind        operation_kind NOT NULL,
    amount      BIGINT NOT NULL,
    memo        TEXT,
    created_by  UUID REFERENCES users (id),
    occurred_at TIMESTAMPTZ NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT operation_amount_is_positive CHECK (amount > 0)
);

CREATE INDEX idx_operations_occurred ON ledger_operations (occurred_at DESC);

CREATE TABLE ledger_entries (
    seq          BIGSERIAL PRIMARY KEY,
    operation_id UUID NOT NULL REFERENCES ledger_operations (id),
    account_id   UUID NOT NULL REFERENCES accounts (id),
    direction    entry_direction NOT NULL,
    amount       BIGINT NOT NULL,
    recorded_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    prev_hash    BYTEA NOT NULL,
    hash         BYTEA NOT NULL UNIQUE,
    CONSTRAINT entry_amount_is_positive CHECK (amount > 0),
    CONSTRAINT prev_hash_is_32_bytes CHECK (octet_length(prev_hash) = 32),
    CONSTRAINT hash_is_32_bytes CHECK (octet_length(hash) = 32)
);

CREATE INDEX idx_entries_account ON ledger_entries (account_id, seq);
CREATE INDEX idx_entries_operation ON ledger_entries (operation_id);

CREATE TABLE payments (
    operation_id UUID PRIMARY KEY REFERENCES ledger_operations (id),
    token_jti    UUID NOT NULL UNIQUE REFERENCES payment_tokens (jti),
    partner_id   UUID NOT NULL REFERENCES partners (id),
    from_account UUID NOT NULL REFERENCES accounts (id),
    entry_mode   entry_mode NOT NULL,
    scanned_at   TIMESTAMPTZ NOT NULL,
    synced_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_partner ON payments (partner_id, scanned_at DESC);

CREATE TABLE topup_batches (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employer_id  UUID NOT NULL REFERENCES employers (id),
    file_name    TEXT NOT NULL,
    file_hash    BYTEA NOT NULL,
    line_count   INT NOT NULL,
    total_amount BIGINT NOT NULL,
    status       batch_status NOT NULL DEFAULT 'draft',
    uploaded_by  UUID NOT NULL REFERENCES users (id),
    uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    validated_at TIMESTAMPTZ,
    CONSTRAINT batch_totals_are_positive CHECK (line_count >= 0 AND total_amount >= 0),
    CONSTRAINT batch_file_hash_is_32_bytes CHECK (octet_length(file_hash) = 32)
);

CREATE UNIQUE INDEX uq_batch_file ON topup_batches (employer_id, file_hash);

CREATE TABLE topups (
    operation_id UUID PRIMARY KEY REFERENCES ledger_operations (id),
    batch_id     UUID REFERENCES topup_batches (id),
    employer_id  UUID NOT NULL REFERENCES employers (id),
    to_account   UUID NOT NULL REFERENCES accounts (id),
    reference    TEXT
);

CREATE INDEX idx_topups_batch ON topups (batch_id);

CREATE TABLE compensations (
    operation_id          UUID PRIMARY KEY REFERENCES ledger_operations (id),
    original_operation_id UUID NOT NULL REFERENCES ledger_operations (id),
    reason                TEXT NOT NULL,
    approved_by           UUID NOT NULL REFERENCES users (id),
    CONSTRAINT compensation_is_not_self CHECK (operation_id <> original_operation_id)
);

CREATE INDEX idx_compensations_original ON compensations (original_operation_id);

CREATE TABLE sessions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users (id),
    token_hash   BYTEA NOT NULL UNIQUE,
    ip_address   INET,
    user_agent   TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at   TIMESTAMPTZ NOT NULL,
    revoked_at   TIMESTAMPTZ
);

CREATE INDEX idx_sessions_user ON sessions (user_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_sessions_expiry ON sessions (expires_at) WHERE revoked_at IS NULL;

CREATE TABLE api_clients (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employer_id  UUID NOT NULL REFERENCES employers (id),
    client_id    TEXT NOT NULL UNIQUE,
    secret_hash  TEXT NOT NULL,
    label        TEXT NOT NULL,
    status       user_status NOT NULL DEFAULT 'active',
    last_used_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id    UUID REFERENCES users (id),
    action      TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id   UUID,
    payload     JSONB,
    ip_address  INET,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_entity ON audit_log (entity_type, entity_id, created_at DESC);
CREATE INDEX idx_audit_actor ON audit_log (actor_id, created_at DESC);

CREATE FUNCTION forbid_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'table % is append-only: % is forbidden', TG_TABLE_NAME, TG_OP
        USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER no_update_on_ledger_entries
    BEFORE UPDATE ON ledger_entries
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE TRIGGER no_delete_on_ledger_entries
    BEFORE DELETE ON ledger_entries
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE TRIGGER no_truncate_on_ledger_entries
    BEFORE TRUNCATE ON ledger_entries
    EXECUTE FUNCTION forbid_mutation();

CREATE TRIGGER no_update_on_ledger_operations
    BEFORE UPDATE ON ledger_operations
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE TRIGGER no_delete_on_ledger_operations
    BEFORE DELETE ON ledger_operations
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE TRIGGER no_truncate_on_ledger_operations
    BEFORE TRUNCATE ON ledger_operations
    EXECUTE FUNCTION forbid_mutation();

CREATE TRIGGER no_update_on_audit_log
    BEFORE UPDATE ON audit_log
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE TRIGGER no_delete_on_audit_log
    BEFORE DELETE ON audit_log
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cartepro_app') THEN
        CREATE ROLE cartepro_app LOGIN;
    END IF;
END
$$;

GRANT SELECT, INSERT ON ledger_entries, ledger_operations, audit_log TO cartepro_app;
REVOKE UPDATE, DELETE, TRUNCATE ON ledger_entries FROM cartepro_app;
REVOKE UPDATE, DELETE, TRUNCATE ON ledger_operations FROM cartepro_app;
REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM cartepro_app;
GRANT USAGE, SELECT ON SEQUENCE ledger_entries_seq_seq TO cartepro_app;

INSERT INTO accounts (owner_type, owner_id, system_code, balance_settled, balance_held)
VALUES ('system', NULL, 'MINISTRY_ISSUANCE', 0, 0),
       ('system', NULL, 'CLOSURE_FORFEIT', 0, 0);
