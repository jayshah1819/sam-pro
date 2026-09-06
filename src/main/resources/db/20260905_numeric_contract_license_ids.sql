-- One-time MySQL migration for numeric contract/vendor/software/license IDs.
-- The affected tables are snapshotted as backup_numeric_ids_* before execution.

SET FOREIGN_KEY_CHECKS = 0;

ALTER TABLE software_products ADD COLUMN software_id_new INT NULL;
SET @software_number = 299;
UPDATE software_products
SET software_id_new = (@software_number := @software_number + 1)
ORDER BY software_id;

ALTER TABLE entitlements ADD COLUMN software_id_new INT NULL;
UPDATE entitlements e
JOIN software_products s ON s.id = e.software_product_id
SET e.software_id_new = s.software_id_new;

ALTER TABLE installations ADD COLUMN software_id_new INT NULL;
UPDATE installations i
JOIN software_products s ON s.id = i.software_product_id
SET i.software_id_new = s.software_id_new;

UPDATE software_products
SET software_id = software_id_new;

ALTER TABLE entitlements
    DROP FOREIGN KEY FK3ouxrw0adq5jkksxl9xdc5vw7,
    DROP INDEX idx_entitlements_software_product_id,
    DROP COLUMN software_product_id,
    CHANGE COLUMN software_id_new software_id INT NOT NULL,
    ADD INDEX idx_entitlements_software_id (software_id),
    ADD CONSTRAINT fk_entitlements_software_id
        FOREIGN KEY (software_id) REFERENCES software_products (software_id);

ALTER TABLE installations
    DROP FOREIGN KEY FKl5a7is6ayw05ekt31ynb09hdm,
    DROP INDEX idx_installations_software_id,
    DROP COLUMN software_product_id,
    CHANGE COLUMN software_id_new software_id INT NOT NULL,
    ADD INDEX idx_installations_software_id (software_id),
    ADD CONSTRAINT fk_installations_software_id
        FOREIGN KEY (software_id) REFERENCES software_products (software_id);

ALTER TABLE software_products
    DROP PRIMARY KEY,
    DROP COLUMN id,
    DROP COLUMN software_id_new,
    ADD PRIMARY KEY (software_id),
    AUTO_INCREMENT = 306;

ALTER TABLE entitlements ADD COLUMN license_id_new INT NULL;
SET @license_number = 499;
UPDATE entitlements
SET license_id_new = (@license_number := @license_number + 1)
ORDER BY license_id;
UPDATE entitlements SET license_id = license_id_new;
ALTER TABLE entitlements
    DROP INDEX uq_entitlements_license_id,
    DROP PRIMARY KEY,
    DROP COLUMN id,
    DROP COLUMN license_id_new,
    ADD PRIMARY KEY (license_id),
    MODIFY COLUMN license_id INT NOT NULL AUTO_INCREMENT,
    AUTO_INCREMENT = 506;

ALTER TABLE software_products MODIFY COLUMN software_id INT NOT NULL AUTO_INCREMENT;

SET FOREIGN_KEY_CHECKS = 1;

-- Add the human-facing license name to each contract license row.
ALTER TABLE entitlements ADD COLUMN license_name VARCHAR(255) NULL;
UPDATE entitlements e
JOIN software_products s ON s.software_id = e.software_id
SET e.license_name = s.name
WHERE e.license_name IS NULL OR TRIM(e.license_name) = '';
ALTER TABLE entitlements MODIFY COLUMN license_name VARCHAR(255) NOT NULL;