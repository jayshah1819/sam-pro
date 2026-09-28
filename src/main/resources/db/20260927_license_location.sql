-- Standalone licenses (no contract_id) previously had no way to store a department.
ALTER TABLE entitlements
    ADD COLUMN location VARCHAR(255) NULL;
