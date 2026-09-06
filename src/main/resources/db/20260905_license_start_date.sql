ALTER TABLE entitlements
    ADD COLUMN start_date DATE NULL;

UPDATE entitlements e
LEFT JOIN contracts c ON c.contract_id = e.contract_id
SET e.start_date = COALESCE(c.start_date, CURRENT_DATE)
WHERE e.start_date IS NULL;

ALTER TABLE entitlements
    MODIFY COLUMN start_date DATE NOT NULL;
