CREATE TYPE attempt_outcome AS ENUM ('settled', 'insufficient_funds');

CREATE TABLE payment_attempts (
    id           UUID PRIMARY KEY,
    employee_id  UUID NOT NULL REFERENCES employees (id),
    partner_id   UUID NOT NULL REFERENCES partners (id),
    amount       BIGINT NOT NULL,
    outcome      attempt_outcome NOT NULL,
    operation_id UUID UNIQUE REFERENCES ledger_operations (id),
    occurred_at  TIMESTAMPTZ NOT NULL,
    recorded_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT attempt_amount_is_positive CHECK (amount > 0),
    CONSTRAINT settled_attempt_has_operation CHECK (
        (outcome = 'settled'  AND operation_id IS NOT NULL)
        OR
        (outcome <> 'settled' AND operation_id IS NULL)
    )
);

CREATE INDEX idx_attempts_timeline ON payment_attempts (occurred_at, id);
CREATE INDEX idx_attempts_employee ON payment_attempts (employee_id, occurred_at DESC);
CREATE INDEX idx_attempts_partner ON payment_attempts (partner_id, occurred_at DESC);

CREATE TRIGGER no_update_on_payment_attempts
    BEFORE UPDATE ON payment_attempts
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE TRIGGER no_delete_on_payment_attempts
    BEFORE DELETE ON payment_attempts
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE TRIGGER no_truncate_on_payment_attempts
    BEFORE TRUNCATE ON payment_attempts
    EXECUTE FUNCTION forbid_mutation();

GRANT SELECT, INSERT ON payment_attempts TO cartepro_app;
REVOKE UPDATE, DELETE, TRUNCATE ON payment_attempts FROM cartepro_app;
