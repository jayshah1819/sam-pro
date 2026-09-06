ALTER TABLE entitlements
    MODIFY COLUMN contract_id INT NULL;

ALTER TABLE vendors
    ADD COLUMN address VARCHAR(255) NULL;