CREATE TABLE finance_monthly_actual (
    finance_monthly_actual_id BIGINT NOT NULL AUTO_INCREMENT,
    tenant_id BIGINT NOT NULL,
    software_code VARCHAR(100) NOT NULL,
    year INT NOT NULL,
    month INT NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    PRIMARY KEY (finance_monthly_actual_id),
    UNIQUE KEY uq_finance_monthly_actual (tenant_id, software_code, year, month),
    INDEX idx_finance_monthly_actual_tenant_id (tenant_id),
    INDEX idx_finance_monthly_actual_software_code (software_code)
);
