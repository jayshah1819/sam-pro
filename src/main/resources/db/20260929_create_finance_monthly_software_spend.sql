CREATE TABLE finance_monthly_software_spend (
    finance_monthly_software_spend_id BIGINT NOT NULL AUTO_INCREMENT,
    tenant_id BIGINT NOT NULL,
    software_code VARCHAR(100) NOT NULL,
    year INT NOT NULL,
    month INT NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    PRIMARY KEY (finance_monthly_software_spend_id),
    UNIQUE KEY uq_finance_monthly_software_spend (tenant_id, software_code, year, month),
    INDEX idx_finance_monthly_software_spend_tenant_id (tenant_id),
    INDEX idx_finance_monthly_software_spend_software_code (software_code)
);
