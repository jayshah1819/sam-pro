CREATE TABLE inventory_item (
    inventory_item_id BIGINT NOT NULL AUTO_INCREMENT,
    tenant_id BIGINT NOT NULL,
    company_group VARCHAR(255) NULL,
    company_name_division VARCHAR(255) NULL,
    system_functionality VARCHAR(255) NULL,
    manufacturer_name VARCHAR(255) NULL,
    vendor_name VARCHAR(255) NULL,
    software_name VARCHAR(255) NULL,
    total_software_spend DECIMAL(15,2) NULL,
    currency VARCHAR(10) NULL,
    software_code VARCHAR(100) NOT NULL,
    comments TEXT NULL,
    PRIMARY KEY (inventory_item_id),
    UNIQUE KEY uq_inventory_item_software_code (tenant_id, software_code),
    INDEX idx_inventory_item_tenant_id (tenant_id),
    INDEX idx_inventory_item_software_code (software_code)
);
