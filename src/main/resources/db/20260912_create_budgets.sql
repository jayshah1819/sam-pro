CREATE TABLE budgets (
    budget_id INT NOT NULL AUTO_INCREMENT,
    tenant_id BIGINT NOT NULL,
    vendor_id INT NOT NULL,
    fiscal_year INT NOT NULL,
    budgeted_monthly_cost DECIMAL(15,2) NULL,
    budgeted_annual_cost DECIMAL(15,2) NULL,
    PRIMARY KEY (budget_id),
    INDEX idx_budgets_tenant_id (tenant_id),
    INDEX idx_budgets_vendor_id (vendor_id)
);
