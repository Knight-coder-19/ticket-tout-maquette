CREATE UNIQUE INDEX uq_topup_reference
    ON topups (employer_id, reference)
    WHERE reference IS NOT NULL;
