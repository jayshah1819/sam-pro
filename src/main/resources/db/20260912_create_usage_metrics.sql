CREATE TABLE usage_metrics (
    record_id INT NOT NULL AUTO_INCREMENT,
    tenant_id BIGINT NOT NULL,
    vendor_id INT NOT NULL,
    billing_month DATE NOT NULL,
    usage_units DECIMAL(18,4) NULL,
    unit_cost DECIMAL(15,4) NULL,
    PRIMARY KEY (record_id),
    INDEX idx_usage_metrics_tenant_id (tenant_id),
    INDEX idx_usage_metrics_vendor_id (vendor_id)
);
