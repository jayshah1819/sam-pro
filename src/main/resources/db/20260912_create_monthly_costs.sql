CREATE TABLE monthly_costs (
    record_id INT NOT NULL AUTO_INCREMENT,
    tenant_id BIGINT NOT NULL,
    vendor_id INT NOT NULL,
    billing_month DATE NOT NULL,
    seats_billed INT NULL,
    unit_price_actual DECIMAL(15,2) NULL,
    actual_cost DECIMAL(15,2) NOT NULL,
    invoice_id VARCHAR(100) NULL,
    recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (record_id),
    INDEX idx_monthly_costs_tenant_id (tenant_id),
    INDEX idx_monthly_costs_vendor_id (vendor_id)
);
