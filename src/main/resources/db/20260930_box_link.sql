ALTER TABLE entitlements
    ADD COLUMN box_link VARCHAR(1024) NULL;

ALTER TABLE contracts
    ADD COLUMN box_link VARCHAR(1024) NULL;
