ALTER TABLE compensations
    ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TRIGGER no_update_on_compensations
    BEFORE UPDATE ON compensations
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE TRIGGER no_delete_on_compensations
    BEFORE DELETE ON compensations
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE TRIGGER no_truncate_on_compensations
    BEFORE TRUNCATE ON compensations
    EXECUTE FUNCTION forbid_mutation();

CREATE TRIGGER no_truncate_on_audit_log
    BEFORE TRUNCATE ON audit_log
    EXECUTE FUNCTION forbid_mutation();

REVOKE UPDATE, DELETE, TRUNCATE ON compensations FROM cartepro_app;
